#!/usr/bin/env node
// Alle open PR's van één auteur samen tegen de base. Elke PR kan los groen zijn
// terwijl de combinatie stuk is: PR A hernoemt een functie, PR B roept de oude
// naam aan, git ziet geen conflict. Die fout komt anders pas na de merge boven.
//
// Maakt wegwerp-merges (merge-tree + commit-tree, geen hooks, niets aan de
// branches) van de base plus de PR's op nummer, de huidige branch als laatste,
// en draait de stappen op het eindresultaat in een tijdelijke worktree. Alleen
// fouten die de base niet al heeft tellen. Is er zo'n fout, dan loopt de check
// de tussenstanden af om te zeggen welke PR hem inbrengt en met welke andere.
//
// Rood als de huidige branch meedoet; breuk tussen andere PR's is advies, net
// als bij ci-parity: blokkeer alleen wat deze wijziging open zet. Met de hand
// gedraaid buiten poort, zonder eigen branch in de stapel, is alles rood.
//
// Gebruik: node integration.mjs [--base origin/main] [--author <login>] [--no-cache]
//   --base         doelbranch; zonder vlag POORT_BASE_REF, anders origin/main
//   --base-branch  branchnaam voor de PR-lijst als --base een SHA is (backtest)
//   --author       zonder vlag @me, de gebruiker van gh
// Stappen uit poort.config.json:
//   "integration": {
//     "link": ["web/node_modules"],    wat een verse worktree mist, uit deze worktree
//     "steps": [{ "id", "run", "match", "exits", "when", "cwd", "deleted", "needs", "needsHint", "timeout" }]
//   }
// `run` kent {files} (alles wat de stapel wijzigt, gefilterd op `when`), {base} en
// {poort}. `match` is een regex per uitvoerregel; de capture-groepen vormen de
// fout, dus laat regelnummers erbuiten: die schuiven tussen de merges. `exits`:
// de exitcodes van een volledige run met fouten (standaard [1]); een andere code
// is een afgebroken run, die nooit groen is, ook niet als de base hetzelfde zegt.
// Een groen resultaat blijft geldig zolang base en PR's dezelfde commits zijn.
// POORT_OFFLINE=1 slaat de check over. Hangt van de remote af: zet "cache": false.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { git, lines, top, warn } from './_lib.mjs';
import { isWindows, shellBin, shellCmd, shellSync } from './_shell.mjs';

// In een pre-push vanuit een linked worktree zet git GIT_DIR. Dan zou elke checkout
// hier de HEAD en index van de aanroeper verplaatsen in plaats van de tijdelijke worktree.
for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete process.env[k];

const POORT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MAX_SHOWN = 10;
const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const fail = (msg) => {
  console.log(msg);
  process.exit(1);
};

function args(argv) {
  const opt = (k) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    base: opt('--base') || process.env.POORT_BASE_REF || 'origin/main',
    baseBranch: opt('--base-branch'),
    author: opt('--author') || '@me',
    noCache: argv.includes('--no-cache'),
  };
}

function readConfig(root) {
  const file = process.env.POORT_CONFIG || path.join(root, 'poort.config.json');
  const cfg = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).integration : null;
  if (!cfg?.steps?.length) fail('integration: geen stappen; zet "integration": { "steps": [...] } in poort.config.json');
  for (const s of cfg.steps) if (!s.id || !s.run || !s.match) fail(`integration: stap ${s.id || '?'} heeft id, run en match nodig`);
  return { link: cfg.link || [], steps: cfg.steps.map((s) => ({ ...s, whenRe: [].concat(s.when ?? '.').map((w) => new RegExp(w)), matchRe: new RegExp(s.match) })) };
}

// ---------- de stapel ----------

function openPrs({ author, branch }) {
  const r = spawnSync(process.env.POORT_GH || 'gh', ['pr', 'list', '--state', 'open', '--author', author, '--base', branch, '--limit', '100', '--json', 'number,headRefName,headRefOid'], { encoding: 'utf8', timeout: 30000 });
  if (r.status !== 0) fail(`integration: open PR's niet opgehaald (${String(r.stderr || r.error?.message || '').trim().split('\n')[0]}). Niet gecontroleerd is niet groen; zonder netwerk: POORT_OFFLINE=1.`);
  return JSON.parse(r.stdout || '[]').sort((a, b) => a.number - b.number);
}

const hasCommit = (sha) => spawnSync('git', ['cat-file', '-e', `${sha}^{commit}`]).status === 0;

// Op nummer, de huidige branch als laatste: dan is elke fout die hij inbrengt
// een fout van hem, en heeft zijn lokale commit voorrang op wat er gepusht is.
function buildStack(prs, baseSha) {
  const head = git(['rev-parse', 'HEAD']).trim();
  const branch = git(['branch', '--show-current']).trim();
  const merged = spawnSync('git', ['merge-base', '--is-ancestor', head, baseSha]).status === 0;
  const items = prs.filter((p) => merged || p.headRefName !== branch).map((p) => ({ label: `#${p.number}`, sha: p.headRefOid, number: p.number, head: false }));
  const own = prs.find((p) => p.headRefName === branch);
  if (!merged) items.push({ label: own ? `#${own.number}` : `HEAD (${branch || head.slice(0, 8)})`, sha: head, head: true });
  const missing = items.filter((i) => !hasCommit(i.sha) && i.number);
  if (missing.length) spawnSync('git', ['fetch', '--quiet', 'origin', ...missing.map((i) => `refs/pull/${i.number}/head`)], { timeout: 120000 });
  for (const i of items) if (!hasCommit(i.sha)) fail(`integration: commit ${i.sha.slice(0, 8)} van ${i.label} niet opgehaald.`);
  return items;
}

const mergeTree = (...a) => spawnSync('git', ['merge-tree', '--write-tree', '--name-only', '--no-messages', ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// Eén merge-stap zonder worktree. Geeft { commit, conflict? }. Een conflict in één
// bestand mag de rest van de PR niet aan de stappen onttrekken: #899 en #900
// botsten in een Vue-bestand én braken een Python-aanroep. Daarom wint bij een
// conflict de stapel voor die regels; zonder commit lukte zelfs dat niet.
function mergeCommit(ours, theirs) {
  const r = mergeTree(ours, theirs);
  if (r.status !== 0 && r.status !== 1) fail(`integration: git merge-tree faalde (${String(r.stderr || r.error?.message).trim().split('\n')[0]}); dit vraagt git 2.38 of nieuwer.`);
  const conflict = r.status === 1 ? lines(r.stdout).slice(1) : undefined;
  const forced = conflict ? mergeTree('-X', 'ours', ours, theirs) : r;
  if (forced.status !== 0) return { conflict };
  const tree = forced.stdout.trim().split('\n')[0];
  const c = spawnSync('git', ['-c', 'user.name=poort', '-c', 'user.email=poort@localhost', 'commit-tree', tree, '-p', ours, '-p', theirs, '-m', 'poort integration'], { encoding: 'utf8' });
  if (c.status !== 0) fail(`integration: git commit-tree faalde (${c.stderr.trim()})`);
  return { commit: c.stdout.trim(), conflict };
}

function mergeAll(baseSha, items) {
  let tip = baseSha;
  let conflict = false;
  for (const i of items) {
    const m = mergeCommit(tip, i.sha);
    conflict ||= Boolean(m.conflict);
    tip = m.commit || tip;
  }
  return { tip, conflict };
}

// De tussenstanden, op volgorde. Een conflict wordt gemeld; een PR die ook dan
// niet past, valt eruit.
function layer(baseSha, items) {
  const layers = [];
  const conflicts = [];
  let tip = baseSha;
  for (const item of items) {
    const m = mergeCommit(tip, item.sha);
    if (m.conflict) {
      const partner = mergeCommit(baseSha, item.sha).conflict ? 'de base' : layers.find((l) => mergeAll(baseSha, [l.item, item]).conflict)?.item.label;
      conflicts.push({ item, files: m.conflict, partner: partner || 'de stapel', tested: Boolean(m.commit) });
    }
    if (!m.commit) continue;
    tip = m.commit;
    layers.push({ item, commit: tip });
  }
  return { layers, conflicts, tip };
}

// ---------- de stappen ----------

// Eigen process-groep, zodat een timeout de hele boom stopt. Daardoor bereikt
// een stop van poort ze niet vanzelf: de opruimstap stopt wat hier nog draait.
const running = new Set();
// Windows kent geen procesgroepen: taskkill /T volgt de boom vanaf de shell.
const killGroup = (pid) => {
  if (isWindows) {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    return;
  }
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {}
};

function runShell(cmd, { cwd, env, timeout }) {
  return new Promise((resolve) => {
    const p = spawn(shellBin(), ['-c', shellCmd(cmd)], { cwd, env, detached: !isWindows, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    running.add(p.pid);
    let out = '';
    let timedOut = false;
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    const t = setTimeout(() => {
      timedOut = true;
      killGroup(p.pid);
    }, timeout * 1000);
    p.on('exit', () => {
      killGroup(p.pid);
      setTimeout(() => [p.stdout, p.stderr].forEach((s) => s.destroy()), 1000).unref();
    });
    p.on('close', (code) => {
      clearTimeout(t);
      running.delete(p.pid);
      resolve({ code, out, timedOut });
    });
  });
}

function linkDeps(root, link, wt) {
  for (const l of link) {
    const dest = path.join(wt, l);
    if (!fs.existsSync(path.join(root, l)) || fs.existsSync(dest)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const src = path.join(root, l);
    fs.symlinkSync(src, dest, isWindows && fs.statSync(src).isDirectory() ? 'junction' : undefined);
  }
}

function parseRun(step, r, wt) {
  if (r.timedOut) return { broken: `${step.id}: niet klaar binnen ${step.timeout || 600}s`, findings: new Set() };
  if (r.code === null) return { broken: `${step.id}: gestopt voor hij klaar was`, findings: new Set() };
  const clean = r.out.replaceAll(wt + path.sep, '');
  const out = clean.split('\n');
  const warns = out.filter((l) => l.startsWith('poort:warn '));
  if (r.code === 0) return { findings: new Set(), warns };
  const tail = out.join('\n').trim().split('\n').slice(-15).join('\n');
  // Geen regelnummers, dus een tweede gelijke fout in een bestand telt apart:
  // anders verstopt hij zich achter dezelfde fout op de base.
  const counts = new Map();
  const findings = new Set(out.flatMap((l) => {
    const m = l.match(step.matchRe);
    if (!m) return [];
    const f = m.length > 1 ? m.slice(1).filter(Boolean).join(': ') : m[0];
    counts.set(f, (counts.get(f) || 0) + 1);
    return [counts.get(f) === 1 ? f : `${f} (${counts.get(f)}x)`];
  }));
  if (!findings.size) return { broken: `${step.id}: exit ${r.code} zonder herkenbare fout\n${tail}`, findings };
  const complete = (step.exits || [1]).includes(r.code);
  return { findings, warns, aborted: complete ? null : `${step.id}: afgebroken met exit ${r.code}\n${tail}` };
}

// Draait een stap op een commit in de tijdelijke worktree; per stap en tree
// hooguit één keer, ook als de zoektocht er twee keer langskomt.
function makeRunner({ baseSha, baseRef, files, wt }) {
  const seen = new Map();
  const checkout = (commit) => {
    const r = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', 'checkout', '--quiet', '--force', '--detach', commit], { cwd: wt, encoding: 'utf8' });
    if (r.status !== 0) fail(`integration: checkout van de wegwerp-merge faalde (${r.stderr.trim()})`);
  };
  const command = (step, cwd) => {
    const paths = files.filter((f) => step.whenRe.some((re) => re.test(f))).filter((f) => step.deleted || fs.existsSync(path.join(wt, f)));
    if (step.run.includes('{files}') && !paths.length) return null;
    const rel = paths.map((f) => path.relative(cwd, path.join(wt, f)));
    return step.run.replaceAll('{files}', rel.map(shq).join(' ')).replaceAll('{base}', baseSha).replaceAll('{poort}', shq(POORT));
  };
  return async (step, commit) => {
    const key = `${step.id} ${git(['rev-parse', `${commit}^{tree}`]).trim()}`;
    if (seen.has(key)) return seen.get(key);
    checkout(commit);
    const cwd = path.join(wt, step.cwd || '.');
    const cmd = command(step, cwd);
    const env = { ...process.env, POORT_BASE: baseSha, POORT_BASE_REF: baseRef, POORT_STAGED: '' };
    const r = cmd === null ? { findings: new Set() } : parseRun(step, await runShell(cmd, { cwd, env, timeout: step.timeout || 600 }), wt);
    seen.set(key, r);
    return r;
  };
}

async function partners(step, hits, { item, earlier, baseSha, run, broken }) {
  const out = [];
  let left = hits;
  const take = async (commit, who) => {
    if (!left.length) return;
    const r = await run(step, commit);
    if (r.broken) broken.push(r.broken);
    const found = left.filter((f) => r.findings.has(f));
    left = left.filter((f) => !r.findings.has(f));
    if (found.length) out.push({ step: step.id, item, who, findings: found });
  };
  await take(mergeAll(baseSha, [item]).tip, null);
  for (const e of earlier) await take(mergeAll(baseSha, [e, item]).tip, e.label);
  if (left.length) out.push({ step: step.id, item, who: 'de stapel ervoor', findings: left });
  return out;
}

// Wie brengt deze fouten in? De eerste tussenstand waar ze opduiken wijst de PR
// aan; die PR op de base alleen en daarna met elk van zijn voorgangers wijst de
// partner aan. Blijft er iets over, dan heeft het de hele stapel nodig.
async function attribute(step, fresh, { layers, baseSha, run, broken }) {
  const left = new Set(fresh);
  const blames = [];
  for (const [k, { item, commit }] of layers.entries()) {
    if (!left.size) break;
    const r = await run(step, commit);
    // Deze tussenstand zegt niets: stop, anders schuift de schuld door naar de volgende PR.
    if (r.broken) {
      broken.push(r.broken);
      break;
    }
    const hits = [...left].filter((f) => r.findings.has(f));
    if (!hits.length) continue;
    for (const f of hits) left.delete(f);
    blames.push(...(await partners(step, hits, { item, earlier: layers.slice(0, k).map((l) => l.item), baseSha, run, broken })));
  }
  return blames;
}

async function runSteps({ steps, run, tip, baseSha, layers, files, wt }) {
  const blames = [];
  const broken = [];
  for (const step of steps) {
    if (!files.some((f) => step.whenRe.some((re) => re.test(f)))) continue;
    if (step.needs && shellSync(step.needs, { cwd: path.join(wt, step.cwd || '.') }).status !== 0) {
      broken.push(`${step.id}: kon niet draaien: ${step.needsHint || step.needs}`);
      continue;
    }
    const full = await run(step, tip);
    if (full.broken) {
      broken.push(full.broken);
      continue;
    }
    // Afgebroken (exit buiten 0/1): nooit groen, ook niet als er daarnaast een
    // nieuwe bevinding is die op een andere PR valt.
    if (full.aborted) broken.push(full.aborted);
    for (const w of full.warns || []) console.log(w);
    if (!full.findings.size) continue;
    const onBase = await run(step, baseSha);
    if (onBase.broken) {
      broken.push(`${step.id} draait niet op de base: ${onBase.broken}`);
      continue;
    }
    const fresh = [...full.findings].filter((f) => !onBase.findings.has(f));
    if (fresh.length) blames.push(...(await attribute(step, fresh, { layers, baseSha, run, broken })));
  }
  return { blames, broken };
}

// ---------- rapport ----------

function describe({ item, who, step, findings }) {
  const head = who ? `${item.label} breekt samen met ${who}` : `${item.label} breekt ook zonder de andere PR's`;
  const shown = findings.slice(0, MAX_SHOWN).map((f) => `  ${f}`);
  const more = findings.length > MAX_SHOWN ? [`  … en ${findings.length - MAX_SHOWN} meer`] : [];
  return [`${head} (${step}):`, ...shown, ...more];
}

function report({ conflicts, blames, broken, hasHead }) {
  const blocks = (item) => item.head || (!hasHead && !process.env.POORT_TIER);
  const block = [...broken];
  for (const c of conflicts) {
    const msg = `${c.item.label} conflicteert met ${c.partner} in ${c.files.slice(0, 3).join(', ')}${c.files.length > 3 ? ', …' : ''}${c.tested ? '' : '; niet meegetest'}`;
    if (blocks(c.item)) block.push(msg);
    else warn(msg);
  }
  for (const b of blames) {
    if (blocks(b.item)) block.push(...describe(b));
    else warn(describe(b).join(' '));
  }
  return block;
}

// ---------- verloop ----------

function withWorktree(commit, fn) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'poort-integration-'));
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    for (const pid of running) killGroup(pid);
    spawnSync('git', ['worktree', 'remove', '--force', dir]);
    fs.rmSync(dir, { recursive: true, force: true });
    spawnSync('git', ['worktree', 'prune']);
  };
  // Ook via fail() en een stop van buiten mag er geen worktree blijven staan.
  process.once('exit', cleanup);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(sig, () => process.exit(1));
  const r = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', 'worktree', 'add', '--quiet', '--detach', dir, commit], { encoding: 'utf8' });
  if (r.status !== 0) fail(`integration: tijdelijke worktree niet gemaakt (${r.stderr.trim()})`);
  return fn(dir).finally(cleanup);
}

function receiptPath(root, baseSha, items, steps, link) {
  const store = path.join(path.resolve(root, git(['rev-parse', '--git-common-dir']).trim()), 'poort', 'integration');
  const config = steps.map(({ whenRe, matchRe, ...s }) => s);
  const hash = createHash('sha256').update(JSON.stringify([baseSha, items.map((i) => i.sha), config, link]));
  // Ook de helpers die stappen via {poort} aanroepen, zoals tests-affected.
  const checks = path.join(POORT, 'checks');
  for (const f of fs.readdirSync(checks).sort()) hash.update(fs.readFileSync(path.join(checks, f)));
  return path.join(store, hash.digest('hex').slice(0, 24));
}

function resolveBase(base) {
  if (base.startsWith('origin/')) {
    // Via FETCH_HEAD (per worktree): een smalle fetch-refspec werkt origin/<base> niet
    // bij, en honderd worktrees op één .git botsen op de ref-lock. Een oude base is
    // geen controle, dus een mislukte fetch is rood.
    const f = spawnSync('git', ['fetch', '--quiet', 'origin', `refs/heads/${base.slice(7)}`], { encoding: 'utf8', timeout: 60000 });
    if (f.status !== 0) fail(`integration: ${base} niet opgehaald (${String(f.stderr || f.error?.message || '').trim().split('\n')[0]}). Niet gecontroleerd is niet groen; zonder netwerk: POORT_OFFLINE=1.`);
    return git(['rev-parse', 'FETCH_HEAD']).trim();
  }
  const sha = git(['rev-parse', '--verify', '--quiet', `${base}^{commit}`]).trim();
  if (!sha) fail(`integration: base ${base} niet gevonden.`);
  return sha;
}

async function main() {
  const opts = args(process.argv.slice(2));
  if (process.env.POORT_OFFLINE) {
    warn('integration overgeslagen: POORT_OFFLINE');
    return;
  }
  const root = top();
  const { link, steps } = readConfig(root);
  const baseSha = resolveBase(opts.base);
  const items = buildStack(openPrs({ author: opts.author, branch: opts.baseBranch || opts.base.replace(/^origin\//, '') }), baseSha);
  const { layers, conflicts, tip } = layer(baseSha, items);
  console.log(`integration: ${opts.base} (${baseSha.slice(0, 8)}) + ${items.map((i) => i.label).join(' + ') || "geen PR's"}`);

  // Niets gecombineerd: de samenvoeging is precies wat de andere checks al zien.
  const same = git(['rev-parse', `${tip}^{tree}`]).trim() === git(['rev-parse', 'HEAD^{tree}']).trim();
  if (!conflicts.length && (same || !layers.length)) {
    console.log('integration: niets te combineren');
    return;
  }
  const receipt = receiptPath(root, baseSha, items, steps, link);
  if (!opts.noCache && !conflicts.length && fs.existsSync(receipt)) {
    process.stdout.write(fs.readFileSync(receipt, 'utf8'));
    console.log('integration: al groen voor deze commits');
    return;
  }

  const files = git(['diff', '--name-only', '--no-renames', '-z', baseSha, tip]).split('\0').filter(Boolean);
  const { blames, broken } = !files.length ? { blames: [], broken: [] } : await withWorktree(tip, async (wt) => {
    linkDeps(root, link, wt);
    return runSteps({ steps, run: makeRunner({ baseSha, baseRef: opts.base, files, wt }), tip, baseSha, layers, files, wt });
  });

  const block = report({ conflicts, blames, broken, hasHead: items.some((i) => i.head) });
  if (block.length) fail(block.join('\n'));
  if (!conflicts.length) {
    fs.mkdirSync(path.dirname(receipt), { recursive: true });
    fs.writeFileSync(receipt, blames.map((b) => `poort:warn ${describe(b).join(' ')}\n`).join(''));
  }
  console.log(`integration: groen op ${layers.length} ${layers.length === 1 ? 'merge' : 'merges'}`);
}

await main();
