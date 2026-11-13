#!/usr/bin/env node
// Kwetsbare dependencies, met dezelfde scanner als CI. Zonder `--` leest de check
// de scanners uit de workflows:
//   - een trivy-stap met scan-type fs of config, met de scanners, severity,
//     ignore-unfixed, het ignore-bestand, skip-dirs en exit-code van die stap.
//     Exit-code 0 (de default van trivy-action) is alleen een rapport: niets
//     om lokaal te spiegelen. Image-scans vragen een docker build en blijven in CI;
//   - een `run`-stap van één regel die met npm, pnpm of yarn audit, pip-audit of
//     uv audit begint (ook via uvx, npx, uv run, poetry run of pipx run). Die draait
//     letterlijk, in zijn working-directory. Een stap met een ${{ }}-expressie,
//     meerdere regels of continue-on-error slaat de check zichtbaar over.
// Genegeerde paden (.env, node_modules, .venv) slaat trivy over: een verse
// checkout in CI heeft ze niet, dus een vondst daarin zou alleen hier rood zijn.
//
//   node deps-audit.mjs                scanners uit de workflows
//   node deps-audit.mjs -- <commando>  een eigen scanner
//
// Raakt de wijziging (de diff met de base die poort zet; in de commit-hook de
// gestagede diff) een manifest, lockfile, Dockerfile of ignore-bestand, dan
// blokkeert een bevinding: die heb jij erin gezet. Anders is het advies: de
// CVE-feed vond iets nieuws in wat er al stond, en CI wordt daarop rood. Een
// scanner die hier ontbreekt, blokkeert ook alleen dan.
// De uitkomst hangt van de CVE-feed af: zet "cache": false. Eén scan per dag per
// inhoud van de dependency-bestanden; daarna leest de check zijn eigen uitslag.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { diffArgs, git, lines, top as gitTop, warn } from './_lib.mjs';
import { hasCommand, shellBin } from './_shell.mjs';
import { workflows } from './_workflow.mjs';

const DEPS =
  /(^|\/)(package(-lock)?\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|requirements[^/]*\.(txt|in)|requirements\/[^/]+\.(txt|in)|constraints[^/]*\.txt|pyproject\.toml|poetry\.lock|uv\.lock|Pipfile(\.lock)?|go\.(mod|sum)|Cargo\.(toml|lock)|Gemfile(\.lock)?|composer\.(json|lock)|Dockerfile[^/]*|\.trivyignore(\.yaml)?|trivy\.yaml)$/;
const AUDIT = /^(?:(uvx|npx(?:\s+-y)?|uv\s+run|poetry\s+run|pipx\s+run)\s+)?(npm audit|pnpm audit|yarn (?:npm )?audit|pip-audit|uv audit)\b/;

const root = gitTop() || process.cwd();
const argv = process.argv.slice(2);
const dash = argv.indexOf('--');
const own = dash < 0 ? null : argv.slice(dash + 1).join(' ');
const extraDeps = new Set(); // ignore-bestanden die een trivy-stap noemt

const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
// Wat git negeert, als globs voor trivy: **/<naam> per genegeerde map of bestand.
function ignoredGlobs() {
  const dirs = new Set();
  const files = new Set();
  for (const p of lines(git(['ls-files', '-oi', '--exclude-standard', '--directory'], { cwd: root }))) {
    const name = path.posix.basename(p.replace(/\/$/, ''));
    (p.endsWith('/') ? dirs : files).add(`**/${name}`);
  }
  return [...[...dirs].map((d) => `--skip-dirs ${q(d)}`), ...[...files].map((f) => `--skip-files ${q(f)}`)];
}

// Scanners uit de workflows: [{ label, cmd, cwd, needs }].
function fromWorkflows() {
  const out = [];
  for (const w of workflows(root)) {
    for (const job of w.jobs) {
      for (const s of job.steps) {
        const withMap = s.with && typeof s.with === 'object' ? s.with : {};
        const label = `${w.file}#${job.id}`;
        if (/^aquasecurity\/trivy-action@/.test(s.uses || '')) {
          const type = withMap['scan-type'] || 'image';
          if (type !== 'fs' && type !== 'config') continue;
          const exit = String(withMap['exit-code'] ?? '0');
          if (exit === '0') continue;
          const args = [type, `--exit-code ${q(exit)}`, '--quiet'];
          if (withMap.scanners && type === 'fs') args.push(`--scanners ${q(withMap.scanners)}`);
          if (withMap.severity) args.push(`--severity ${q(withMap.severity)}`);
          if (type === 'fs' && String(withMap['ignore-unfixed']) === 'true') args.push('--ignore-unfixed');
          if (withMap.trivyignores) {
            args.push(`--ignorefile ${q(withMap.trivyignores)}`);
            extraDeps.add(String(withMap.trivyignores).replace(/^\.\//, ''));
          }
          if (withMap['skip-dirs']) args.push(...String(withMap['skip-dirs']).split(',').map((d) => `--skip-dirs ${q(d.trim())}`));
          args.push('__IGNORED__', q(withMap['scan-ref'] || '.'));
          out.push({ label: `trivy ${type}${withMap.scanners ? ` (${withMap.scanners})` : ''} (${label})`, cmd: `trivy ${args.join(' ')}`, cwd: '.', needs: 'trivy' });
          continue;
        }
        const run = String(s.run || '').trim();
        const firstLine = run.split('\n').find((l) => l.trim() && !l.trim().startsWith('#'))?.trim() || '';
        const m = firstLine.match(AUDIT) || (run.includes('\n') && run.match(/\b(npm audit|pnpm audit|pip-audit|uv audit)\b/));
        if (!m) continue;
        const skip = run.includes('${{') ? 'een ${{ }}-expressie' : run.split('\n').filter((l) => l.trim()).length > 1 ? 'meerdere regels' : String(s['continue-on-error']) === 'true' ? 'continue-on-error (CI blijft groen)' : null;
        if (skip) {
          warn(`deps-audit: "${firstLine.slice(0, 60)}" (${label}) overgeslagen: ${skip}; die scan draait alleen in CI`);
          continue;
        }
        const cwd = s['working-directory'] || job.defaults?.run?.['working-directory'] || '.';
        out.push({ label: `${m[2]} (${label})`, cmd: run, cwd, needs: firstLine.split(/\s+/)[0] });
      }
    }
  }
  // Dezelfde scan in twee jobs hoeft maar één keer.
  return [...new Map(out.map((s) => [`${s.cwd}\0${s.cmd}`, s])).values()];
}

const scanners = own ? [{ label: own, cmd: own, cwd: '.' }] : fromWorkflows();
if (!scanners.length) {
  console.log('deps-audit: geen scanner in de workflows en geen commando na --; niets te controleren.');
  process.exit(0);
}
const isDep = (f) => DEPS.test(f) || extraDeps.has(f);
// De echte wijziging, niet {files}: bij --all of een gewijzigde config krijgt een
// check alle bestanden, en dan zou elke bestaande lockfile "door jou" lijken.
const touched = [
  ...lines(git([...diffArgs(), '--name-only'], { cwd: root })),
  ...(process.env.POORT_STAGED ? [] : lines(git(['ls-files', '-o', '--exclude-standard'], { cwd: root }))),
].filter(isDep);

const missing = scanners.filter((s) => s.needs && !hasCommand(q(s.needs)));
if (missing.length) {
  const msg = `CI scant met ${[...new Set(missing.map((s) => s.needs))].join(', ')}, maar dat staat hier niet: installeer het (bijv. brew install ${missing[0].needs}).`;
  if (touched.length) {
    console.log(`deps-audit: ${msg}`);
    process.exit(1);
  }
  warn(`deps-audit: ${msg} Deze wijziging raakt geen dependencies, dus nu advies.`);
  process.exit(0);
}

// Sleutel: datum (UTC), scanners en de inhoud van elk dependency-bestand.
const depFiles = lines(git(['ls-files', '-co', '--exclude-standard'], { cwd: root })).filter(isDep).sort();
const h = createHash('sha256').update(`${new Date().toISOString().slice(0, 10)}\0`);
for (const s of scanners) h.update(`${s.cwd}\0${s.cmd}\0`);
for (const f of depFiles) {
  try {
    h.update(`${f}\0`).update(fs.readFileSync(path.join(root, f)));
  } catch {}
}
const cacheDir = path.join(path.resolve(root, git(['rev-parse', '--git-common-dir'], { cwd: root }).trim() || '.git'), 'poort', 'deps-audit');
const cacheFile = path.join(cacheDir, h.digest('hex').slice(0, 32) + '.json');

let result;
try {
  result = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
} catch {
  result = { failed: [] };
  const skipIgnored = ignoredGlobs().join(' ');
  for (const s of scanners) {
    const cmd = s.cmd.replace('__IGNORED__', skipIgnored);
    const r = spawnSync(shellBin('bash'), ['-o', 'pipefail', '-c', cmd], { windowsHide: true, cwd: path.join(root, s.cwd), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) result.failed.push({ label: s.label, cmd: s.cmd.replace(' __IGNORED__', ''), out: `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-40).join('\n') });
  }
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(result));
  // Uitslagen van eerdere dagen hebben geen waarde meer.
  for (const f of fs.readdirSync(cacheDir)) {
    const p = path.join(cacheDir, f);
    if (Date.now() - fs.statSync(p).mtimeMs > 2 * 86400000) fs.rmSync(p, { force: true });
  }
}

if (!result.failed.length) process.exit(0);
for (const f of result.failed) {
  console.log(`✗ ${f.label}\n  $ ${f.cmd}\n${f.out.replace(/^/gm, '  ')}`);
}
if (touched.length) {
  console.log(`deps-audit: kwetsbare dependencies, en deze wijziging raakt ${touched.slice(0, 3).join(', ')}. Werk de dependency bij of leg de uitzondering met reden vast in het ignore-bestand.`);
  process.exit(1);
}
warn(`deps-audit: ${result.failed.map((f) => f.label).join(', ')} vindt kwetsbaarheden in wat er al stond (niet door deze wijziging); CI wordt hierop rood. Details: het log van deze check.`);
