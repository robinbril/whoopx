#!/usr/bin/env node
// Draai de run-stappen van een goedkope CI-job lokaal, uit de workflow zelf:
// dezelfde code als in CI, dus lokaal en CI lopen nooit uit elkaar. Bedoeld
// voor statische jobs zonder services (repo-invariants, lint-scripts), niet
// voor jobs die een stack of secrets nodig hebben.
//
//   node ci-job.mjs --workflow .github/workflows/ci.yml --job invariants
//     [--base-ref origin/acceptance]   (default: POORT_BASE_REF, base uit
//                                       poort.config.json, origin/HEAD)
//     [--path backend/.venv/bin]       (vóór PATH, komma-gescheiden: dan vinden
//                                       de stappen python3 met de packages die
//                                       de CI-runner al heeft, zoals PyYAML)
//
// Wat lokaal anders gaat:
//   - `uses:`-stappen die de runner klaarzetten (checkout, cache, setup-*) slaan
//     we over: de werkboom en de tools zijn er al;
//   - een matrix-job draait één variant: het OS van deze machine (op een Mac de
//     ubuntu-variant als er geen macos is), de lokale Python- of Node-versie als
//     die erin staat, anders de eerste waarde; ${{ matrix.x }} is die waarde;
//   - ${{ github.event_name }} is "pull_request", ${{ github.base_ref }} de base
//     zonder origin/, ${{ github.event.pull_request.base.sha }} de merge-base;
//     env.X uit de job- en stap-env; secrets.* leeg (met waarschuwing);
//     github.event.pull_request.draft is "false" (een push staat voor een PR
//     die klaar is voor review);
//   - elke stap krijgt GITHUB_OUTPUT, GITHUB_ENV, GITHUB_PATH en
//     GITHUB_STEP_SUMMARY; latere stappen lezen steps.<id>.outcome, .conclusion
//     en .outputs.<naam>, en zien wat eerdere stappen in GITHUB_ENV/PATH zetten;
//   - `if:` met ==, !=, &&, ||, !, always() en success() wordt geëvalueerd; een
//     voorwaarde die we niet kunnen lezen, slaat de stap zichtbaar over;
//   - `git fetch --depth=N` zou een volledige clone shallow maken: een shim
//     haalt --depth en --shallow-* weg; met POORT_OFFLINE wordt fetch een no-op.
// Eén mislukte stap maakt de check rood, met de naam van de stap.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { warn } from './_lib.mjs';
import { shellBin, shellCmd, shellSync } from './_shell.mjs';
import { pickMatrix, readJob, SETUP } from './_workflow.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const workflow = opt('workflow', '.github/workflows/ci.yml');
const jobName = opt('job');
if (!jobName) {
  console.log('ci-job: geef --job <naam>');
  process.exit(2);
}
const git = (args) => spawnSync('git', args, { encoding: 'utf8' });
const top = git(['rev-parse', '--show-toplevel']).stdout.trim() || process.cwd();

// ---------- expressies en voorwaarden ----------

function baseRef() {
  const fromEnv = process.env.POORT_BASE_REF || opt('base-ref');
  if (fromEnv) return fromEnv;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(top, 'poort.config.json'), 'utf8'));
    if (cfg.base) return cfg.base;
  } catch {}
  return git(['rev-parse', '--abbrev-ref', 'origin/HEAD']).stdout.trim() || 'origin/main';
}
const BASE = baseRef();
const head = git(['rev-parse', 'HEAD']).stdout.trim();
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
const ctx = {
  'github.event_name': 'pull_request',
  'github.base_ref': BASE.replace(/^origin\//, ''),
  'github.head_ref': branch,
  'github.ref': `refs/heads/${branch}`,
  'github.ref_name': branch,
  'github.sha': head,
  'github.workspace': top,
  'github.event.pull_request.base.sha': git(['merge-base', 'HEAD', BASE]).stdout.trim(),
  'github.event.pull_request.base.ref': BASE.replace(/^origin\//, ''),
  'github.event.pull_request.head.sha': head,
  // Een lokale push staat voor een PR die klaar is voor review, geen draft.
  'github.event.pull_request.draft': 'false',
  'runner.os': process.platform === 'darwin' ? 'macOS' : 'Linux',
};
const unknown = new Set();
// steps.<id>.outcome, .conclusion en .outputs.<naam>: na elke stap gevuld, zoals
// de runner dat doet. Een stap die lokaal niet kon draaien (uses:) staat er niet
// in, dus wie naar zijn uitkomst vraagt, wordt zichtbaar overgeslagen.
const stepsCtx = {};
function lookup(name, env) {
  if (name in ctx) return ctx[name];
  if (name in stepsCtx) return stepsCtx[name];
  const out = /^steps\.([\w-]+)\.outputs\.[\w-]+$/.exec(name);
  if (out && `steps.${out[1]}.outcome` in stepsCtx) return '';
  if (name.startsWith('env.')) return env[name.slice(4)] ?? '';
  if (name.startsWith('secrets.')) {
    warn(`ci-job: ${name} is lokaal leeg`);
    return '';
  }
  unknown.add(name);
  return undefined;
}
const expand = (s, env) => String(s).replace(/\$\{\{\s*([\w.-]+)\s*\}\}/g, (_, n) => lookup(n, env) ?? '');

// Een `if:` als JS-expressie, alleen uit tokens die we kennen: contexten,
// stringliterals, ==, !=, &&, ||, !, haakjes, true/false en status-functies.
function evalIf(expr, env) {
  if (expr === undefined || expr === '') return true;
  const src = String(expr).replace(/^\$\{\{\s*|\s*\}\}$/g, '');
  const tokens = src.match(/'(?:[^']|'')*'|[\w.-]+\(\)|[\w.-]+|==|!=|&&|\|\||!|\(|\)|\s+/g);
  if (!tokens || tokens.join('') !== src) return null;
  let js = '';
  for (const t of tokens) {
    if (/^\s+$/.test(t)) js += ' ';
    else if (t.startsWith("'")) js += JSON.stringify(t.slice(1, -1).replace(/''/g, "'"));
    else if (['==', '!=', '&&', '||', '!', '(', ')'].includes(t)) js += t === '==' ? '===' : t === '!=' ? '!==' : t;
    else if (t === 'always()' || t === 'success()' || t === 'true') js += 'true';
    else if (t === 'failure()' || t === 'cancelled()' || t === 'false') js += 'false';
    else {
      const v = lookup(t, env);
      if (v === undefined) return null;
      js += JSON.stringify(v);
    }
  }
  try {
    return Boolean(Function(`"use strict"; return (${js});`)());
  } catch {
    return null;
  }
}

// GITHUB_OUTPUT en GITHUB_ENV: `naam=waarde` of `naam<<EINDE` … `EINDE`.
function readKeyValues(file) {
  const out = [];
  const ls = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (let i = 0; i < ls.length; i++) {
    const h = /^([^=<]+)<<(.+)$/.exec(ls[i]);
    if (h) {
      const body = [];
      while (++i < ls.length && ls[i] !== h[2]) body.push(ls[i]);
      out.push([h[1], body.join('\n')]);
    } else if (ls[i].includes('=')) {
      const at = ls[i].indexOf('=');
      out.push([ls[i].slice(0, at), ls[i].slice(at + 1)]);
    }
  }
  return out;
}

// ---------- git-shim: geen --depth op een volledige clone ----------

function gitShim() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poort-ci-job-'));
  const realGit = shellSync('command -v git', { encoding: 'utf8' }).stdout.trim();
  fs.writeFileSync(
    path.join(dir, 'git'),
    `#!/bin/sh
# poort ci-job: --depth/--shallow-* maken een volledige lokale clone shallow.
if [ "$1" = "fetch" ]; then
  [ -n "$POORT_OFFLINE" ] && exit 0
  shift
  n=$#
  while [ "$n" -gt 0 ]; do
    a=$1
    shift
    n=$((n - 1))
    case "$a" in
      --depth|--shallow-since|--shallow-exclude)
        if [ "$n" -gt 0 ]; then shift; n=$((n - 1)); fi ;;
      --depth=*|--shallow-*|--unshallow|--deepen*) ;;
      *) set -- "$@" "$a" ;;
    esac
  done
  set -- fetch "$@"
fi
exec ${JSON.stringify(realGit)} "$@"
`,
    { mode: 0o755 },
  );
  return dir;
}

// ---------- draaien ----------

const file = path.join(top, workflow);
if (!fs.existsSync(file)) {
  console.log(`ci-job: ${workflow} bestaat niet`);
  process.exit(1);
}
const job = readJob(fs.readFileSync(file, 'utf8'), jobName);
if (!job) {
  console.log(`ci-job: job "${jobName}" niet gevonden in ${workflow}`);
  process.exit(1);
}
if (job.matrix) {
  if (job.matrix.unreadable) {
    console.log(`ci-job: ${jobName} heeft een ${job.matrix.unreadable}; die kan ci-job niet naspelen`);
    process.exit(1);
  }
  const extraPath = String(opt('path', '')).split(',').filter(Boolean).map((p) => path.resolve(top, p));
  const py = spawnSync('python3', ['--version'], { encoding: 'utf8', env: { ...process.env, PATH: [...extraPath, process.env.PATH].join(path.delimiter) } });
  const pick = pickMatrix(job.matrix.axes, {
    platform: process.platform,
    python: (py.stdout || py.stderr || '').match(/(\d+\.\d+(?:\.\d+)?)/)?.[1],
    node: process.versions.node.split('.')[0],
  });
  if (!pick) {
    console.log(`ci-job: de matrix van ${jobName} heeft geen variant voor ${process.platform}`);
    process.exit(1);
  }
  for (const [k, v] of Object.entries(pick)) ctx[`matrix.${k}`] = v;
  const node = Object.entries(pick).find(([k]) => /node/i.test(k));
  if (node && String(node[1]).split('.')[0] !== process.versions.node.split('.')[0])
    warn(`ci-job: de matrix vraagt Node ${node[1]}, hier draait ${process.versions.node}`);
  console.log(`ci-job ${jobName}: matrix ${Object.entries(pick).map(([k, v]) => `${k}=${v}`).join(', ')}`);
}
const shim = gitShim();
const jobEnv = Object.fromEntries(Object.entries(job.env).map(([k, v]) => [k, expand(v, process.env)]));
const defaultDir = job.defaults?.run?.['working-directory'];
// Per stap eigen runner-bestanden; wat een stap in GITHUB_ENV of GITHUB_PATH
// zet, geldt voor de stappen erna, zoals in CI.
const runnerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'poort-ci-files-'));
const addedEnv = {};
let addedPath = [];
let ran = 0;
let failed = 0;
for (const [i, step] of job.steps.entries()) {
  const label = step.name || (step.uses ? step.uses : `stap ${i + 1}`);
  if (step.uses) {
    if (!SETUP.test(step.uses)) warn(`ci-job: "${label}" (uses: ${step.uses}) kan lokaal niet en is overgeslagen`);
    continue;
  }
  if (!step.run) continue;
  const env = { ...process.env, ...jobEnv, ...addedEnv, GITHUB_EVENT_NAME: ctx['github.event_name'], GITHUB_BASE_REF: ctx['github.base_ref'], GITHUB_SHA: head, GITHUB_WORKSPACE: top };
  // Eerst leegmaken: een onbekende expressie in de stap-env slaat de stap over.
  unknown.clear();
  for (const [k, v] of Object.entries(step.env && typeof step.env === 'object' ? step.env : {})) env[k] = expand(v, env);
  const cond = evalIf(step.if, env);
  if (cond === null || unknown.size) {
    warn(`ci-job: "${label}" overgeslagen: voorwaarde of expressie niet lokaal te bepalen (${[...unknown].join(', ') || step.if})`);
    continue;
  }
  if (!cond) {
    if (step.id) stepsCtx[`steps.${step.id}.outcome`] = stepsCtx[`steps.${step.id}.conclusion`] = 'skipped';
    continue;
  }
  const script = expand(step.run, env);
  if (unknown.size) {
    warn(`ci-job: "${label}" overgeslagen: onbekende expressie ${[...unknown].join(', ')}`);
    continue;
  }
  const cwd = path.join(top, step['working-directory'] || defaultDir || '.');
  const extra = shellCmd(String(opt('path', ''))).split(',').filter(Boolean).map((p) => path.resolve(top, p));
  // Op Windows heet de variabele Path, en een kopie van process.env maakt geen case-verschil goed.
  const pathKey = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  env[pathKey] = [shim, ...extra, ...addedPath, env[pathKey]].join(path.delimiter);
  const files = Object.fromEntries(['GITHUB_OUTPUT', 'GITHUB_ENV', 'GITHUB_PATH', 'GITHUB_STEP_SUMMARY'].map((k) => [k, path.join(runnerDir, `${i}-${k}`)]));
  for (const f of Object.values(files)) fs.writeFileSync(f, '');
  Object.assign(env, files);
  console.log(`▶ ${label}`);
  const r = spawnSync(shellBin('bash'), ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], { cwd, env, stdio: 'inherit', windowsHide: true });
  ran++;
  if (r.status !== 0) {
    failed++;
    console.log(`✗ ${label} (exit ${r.status})`);
    if (step['continue-on-error'] === 'true') failed--;
  }
  if (step.id) {
    const outcome = r.status === 0 ? 'success' : 'failure';
    stepsCtx[`steps.${step.id}.outcome`] = outcome;
    stepsCtx[`steps.${step.id}.conclusion`] = outcome === 'failure' && step['continue-on-error'] === 'true' ? 'success' : outcome;
    for (const [k, v] of readKeyValues(files.GITHUB_OUTPUT)) stepsCtx[`steps.${step.id}.outputs.${k}`] = v;
  }
  for (const [k, v] of readKeyValues(files.GITHUB_ENV)) addedEnv[k] = v;
  addedPath = [...fs.readFileSync(files.GITHUB_PATH, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).reverse(), ...addedPath];
}
fs.rmSync(shim, { recursive: true, force: true });
fs.rmSync(runnerDir, { recursive: true, force: true });
console.log(`ci-job ${jobName}: ${ran} stap(pen) gedraaid, ${failed} rood`);
// Niets gedraaid is geen bewijs: alles overgeslagen of de job niet te lezen.
if (!ran) console.log(`ci-job ${jobName}: geen enkele stap gedraaid; dat bewijst niets`);
process.exit(failed || !ran ? 1 : 0);
