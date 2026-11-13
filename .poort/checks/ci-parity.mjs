#!/usr/bin/env node
// Welke CI-jobs vangt poort lokaal? Elke job die op een pull request of push
// draait, hoort gedekt te zijn door een check of bewust uitgezonderd met reden.
//
//   node ci-parity.mjs            als check: blokkeert alleen wat deze wijziging
//                                 open zet (een job die je toevoegt of verandert,
//                                 dekking die je uit de config haalt, een
//                                 verwijzing die je breekt); wat al open stond
//                                 is advies
//   poort parity                  het hele overzicht, exit 1 bij iets open
//   poort parity --fix            zet een ci-job-check in poort.config.json voor
//                                 elke open job die ci-job kan naspelen
//
// Dekking in poort.config.json:
//   check:  "ci": "ci.yml#backend"            hele job
//           "ci": ["ci.yml#frontend:Build"]   één stap (naam zoals GitHub hem toont)
//           * is een wildcard in elk deel; een ci-job-check dekt zijn eigen job
//   top:    "ciWaive": { "release.yml#*": "publiceert, geen code-check" }
// Stappen die alleen de runner klaarzetten (checkout, setup-*, cache) tellen niet
// mee. Een aggregaat-job (needs, en stappen die alleen needs.* lezen) is gedekt
// als al zijn needs het zijn. Een job die pas na een merge draait (push op een
// vaste branch zonder PR-trigger, of een `if:` op main of een tag) hoeft niet.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { baseRev, diffArgs, git, lines, top as gitTop, warn } from './_lib.mjs';
import { jobAfterMerge, pickMatrix, pushFilter, readJobs, SETUP, stepLabel, triggers, workflowAfterMerge, workflows } from './_workflow.mjs';

const TRIGGERS = new Set(['pull_request', 'pull_request_target', 'push', 'merge_group']);
const FIX = process.argv.includes('--fix');
const ALL = FIX || process.env.POORT_PARITY_ALL === '1';

const root = gitTop() || process.cwd();
const cfgFile = process.env.POORT_CONFIG ? path.resolve(process.env.POORT_CONFIG) : path.join(root, 'poort.config.json');
const cfgRel = path.relative(root, cfgFile).split(path.sep).join('/');
let cfgText;
let cfg;
try {
  cfgText = fs.readFileSync(cfgFile, 'utf8');
  cfg = JSON.parse(cfgText);
} catch (e) {
  console.log(`ci-parity: ${path.basename(cfgFile)} niet leesbaar (${e.message})`);
  process.exit(2);
}

const glob = (p) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
// "ci.yml#job:Stap" -> { wf, job, step } als regexen; step null = hele job.
function selector(s) {
  const m = String(s).match(/^([^#]+)#([^:]+)(?::(.+))?$/);
  if (!m) return null;
  return { text: s, wf: glob(m[1]), job: glob(m[2]), step: m[3] ? glob(m[3]) : null };
}

// ---------- wat deze wijziging raakt ----------

const here = git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root }).trim();
const touched = new Set([
  ...lines(git([...diffArgs(), '--name-only'], { cwd: root })),
  ...(process.env.POORT_STAGED ? [] : lines(git(['ls-files', '-o', '--exclude-standard'], { cwd: root }))),
]);
const touchedWf = new Set([...touched].filter((f) => f.startsWith('.github/workflows/')).map((f) => path.basename(f)));

// Jobs die nieuw of anders zijn dan op de base. Een job die door andere triggers
// nu ineens op een PR of push draait (andere PR/push-triggers, of hij draaide eerst
// pas na een merge) telt ook. removed: jobs die deze wijziging weghaalt, ook met
// een hele workflow (een verwijzing ernaar breek jij).
const base = baseRev();
const all = workflows(root);
const changedJobs = new Set();
const removed = [];
const prPush = (on) => JSON.stringify(on.filter((t) => TRIGGERS.has(t)).sort());
for (const file of touchedWf) {
  const w = all.find((x) => x.file === file);
  const old = base ? git(['show', `${base}:.github/workflows/${file}`], { cwd: root }) : '';
  const oldJobs = old ? readJobs(old) : [];
  if (!w) {
    oldJobs.forEach((j) => removed.push({ file, id: j.id }));
    continue;
  }
  const was = new Map(oldJobs.map((j) => [j.id, j.source]));
  const sameOn = old && prPush(triggers(old)) === prPush(w.on);
  const afterBefore = old ? afterMerge({ file, on: triggers(old), push: pushFilter(old), jobs: oldJobs }) : new Set();
  const afterNow = afterMerge(w);
  for (const j of w.jobs) {
    if (!sameOn || was.get(j.id) !== j.source || (afterBefore.has(j.id) && !afterNow.has(j.id))) changedJobs.add(`${file}#${j.id}`);
  }
  for (const id of was.keys()) if (!w.jobs.some((j) => j.id === id)) removed.push({ file, id });
}

// ---------- dekking per job ----------

// ci-job kan een job naspelen als hij statisch is (geen services, container of
// secrets), alleen run- en setup-stappen heeft, en een eventuele matrix een
// variant voor dit OS heeft.
const replayable = (job) =>
  job.static &&
  (!job.matrix || (!job.matrix.unreadable && pickMatrix(job.matrix.axes, { platform: process.platform }))) &&
  job.steps.every((s) => s.run || SETUP.test(s.uses || ''));

// Na een merge: de workflow zelf, een job met een if op main/tag, of een job die
// er een nodig heeft (een deploy na een build-na-merge).
function afterMerge(w) {
  const after = new Set();
  if (workflowAfterMerge(w, here)) w.jobs.forEach((j) => after.add(j.id));
  for (let grew = true; grew; ) {
    grew = false;
    for (const j of w.jobs) {
      // Een job met always()/cancelled()/failure() draait ook als zijn need oversloeg.
      const inherits = !/always\(\)|cancelled\(\)|failure\(\)/.test(String(j.if || '')) && j.needs.some((n) => after.has(n));
      if (!after.has(j.id) && (jobAfterMerge(j, here) || inherits)) {
        after.add(j.id);
        grew = true;
      }
    }
  }
  return after;
}

// De dekking van alle workflows onder één config: { rows, bad }.
// bad: { text, sel? }, sel is de job waar een kapotte verwijzing naar wijst.
function coverage(conf) {
  const claims = [];
  const bad = [];
  for (const c of conf.checks || []) {
    for (const s of [].concat(c.ci || [])) {
      const sel = selector(s);
      if (sel) claims.push({ ...sel, by: c.id });
      else bad.push({ text: `${c.id}: "ci": "${s}" is geen <workflow>#<job>[:<stap>]` });
    }
    // Een ci-job-check draait de job zelf: dat is dekking, als ci-job hem kan naspelen.
    const run = String(c.run || '');
    if (run.includes('ci-job.mjs')) {
      const arg = (k) => run.match(new RegExp(`--${k}[ =]["']?([^\\s"']+)`))?.[1];
      const wf = path.basename(arg('workflow') || 'ci.yml');
      const job = arg('job');
      if (job) claims.push({ text: `${wf}#${job}`, wf: glob(wf), job: glob(job), step: null, by: `${c.id} (ci-job)`, auto: true });
    }
  }
  const waivers = [];
  for (const [s, why] of Object.entries(conf.ciWaive || {})) {
    const sel = selector(s);
    if (!sel) bad.push({ text: `ciWaive: "${s}" is geen <workflow>#<job>[:<stap>]` });
    else if (!String(why || '').trim()) bad.push({ text: `ciWaive: "${s}" heeft geen reden` });
    else waivers.push({ ...sel, why });
  }

  const used = new Set();
  const hit = (list, wf, job, stepName = null) =>
    list.filter((x) => x.wf.test(wf) && x.job.test(job.id) && (stepName === null ? x.step === null : x.step?.test(stepName)));
  const mark = (xs) => xs.forEach((x) => used.add(x));
  const rows = [];
  for (const w of all) {
    const relevant = w.on.some((t) => TRIGGERS.has(t));
    const after = afterMerge(w);
    for (const job of w.jobs) {
      const key = `${w.file}#${job.id}`;
      // Ook buiten PR/push: een verwijzing ernaar is niet verouderd.
      const canReplay = replayable(job);
      const whole = hit(claims, w.file, job).filter((x) => !(x.auto && !canReplay));
      const unreplayable = hit(claims, w.file, job).filter((x) => x.auto && !canReplay);
      const waived = hit(waivers, w.file, job);
      mark(whole);
      mark(unreplayable);
      mark(waived);
      const stepsReal = job.steps.filter((s) => !(s.uses && SETUP.test(s.uses)));
      const stepHits = stepsReal.map((s) => {
        const label = stepLabel(s);
        const c = hit(claims, w.file, job, label);
        const v = hit(waivers, w.file, job, label);
        mark(c);
        mark(v);
        return { label, by: c[0]?.by, why: v[0]?.why };
      });
      if (!relevant) continue;
      // Aggregaat: draait ook als een need faalt (always()/!cancelled()) en kijkt alleen
      // naar de uitslag van zijn needs. Een herbruikbare workflow (uses) is geen aggregaat.
      const aggregate =
        job.needs.length > 0 &&
        !job.uses &&
        /always\(\)|cancelled\(\)/.test(String(job.if || '')) &&
        stepsReal.every((s) => !s.uses && /\bneeds\./.test(String(s.run || '')));
      const at = { key, file: w.file, job, canReplay };
      let row;
      if (whole.length) row = { ...at, ok: true, text: `gedekt door ${[...new Set(whole.map((x) => x.by))].join(', ')}` };
      else if (waived.length) row = { ...at, ok: true, text: `uitgezonderd: ${waived[0].why}`, quiet: true };
      else if (after.has(job.id)) row = { ...at, ok: true, text: 'draait pas na een merge', quiet: true };
      else if (aggregate) row = { ...at, aggregate: job.needs.map((n) => `${w.file}#${n}`) };
      else if (stepHits.some((s) => s.by || s.why)) {
        const open = stepHits.filter((s) => !s.by && !s.why).map((s) => s.label);
        row = open.length
          ? { ...at, ok: false, text: `stappen niet gedekt: ${open.join('; ')}` }
          : { ...at, ok: true, text: `per stap gedekt (${[...new Set(stepHits.map((s) => s.by).filter(Boolean))].join(', ') || 'uitgezonderd'})` };
      } else {
        const hint = canReplay && job.steps.some((s) => s.run) ? ' · kan lokaal met ci-job (poort parity --fix)' : '';
        const why = unreplayable.length
          ? ` (${unreplayable[0].by} kan deze job niet naspelen: ${job.matrix?.unreadable || 'matrix zonder variant voor dit OS, services, secrets of een uses-stap'})`
          : '';
        row = { ...at, ok: false, text: 'niet gedekt' + why + (job.steps.length || job.uses ? '' : ' (job zonder stappen)') + (why ? '' : hint) };
      }
      rows.push(row);
    }
  }
  // Aggregaten na de rest: gedekt als elke need gedekt, uitgezonderd of na-merge is.
  const status = new Map();
  for (let pass = 0; pass < rows.length; pass++) {
    for (const r of rows) status.set(r.key, r.aggregate ? status.get(r.key) : r.ok);
    for (const r of rows.filter((x) => x.aggregate)) {
      const open = r.aggregate.filter((n) => status.get(n) !== true);
      r.ok = !open.length;
      r.text = open.length ? `aggregaat; needs niet gedekt: ${open.join(', ')}` : 'aggregaat van gedekte jobs';
      status.set(r.key, r.ok);
    }
  }
  for (const x of [...claims, ...waivers]) {
    if (!used.has(x)) bad.push({ text: `${x.by ? `${x.by}: "ci"` : 'ciWaive'} "${x.text}" wijst naar geen bestaande job of stap`, sel: x, id: `stale:${x.text}` });
  }
  return { rows, bad };
}

const { rows, bad } = coverage(cfg);

// ---------- --fix: een ci-job-check per open job die ci-job kan naspelen ----------

if (FIX) {
  const ids = new Set((cfg.checks || []).map((c) => c.id));
  const venv = ['.venv', 'venv'].find((d) => fs.existsSync(path.join(root, d, 'bin', 'python')));
  const added = [];
  const skipped = [];
  for (const r of rows.filter((x) => !x.ok && !x.aggregate)) {
    const runs = r.job.steps.map((s) => String(s.run || '')).join('\n');
    if (!r.canReplay || !r.job.steps.some((s) => s.run)) skipped.push(`${r.key}: ci-job kan hem niet naspelen; dek hem met een eigen check of zet hem met reden in ciWaive`);
    else if (r.text.startsWith('stappen niet gedekt')) skipped.push(`${r.key}: al deels per stap gedekt; dek de rest per stap`);
    else if (/\bsudo\b|\bapt(-get)?\s+install\b|\bbrew\s+install\b|\bnpm\s+(i|install)\s+(-g|--global)\b|\|\s*(ba|z)?sh\b|\b(cargo|go|gem|pipx)\s+install\b|\bdocker\s+(run|compose)\b/.test(runs))
      skipped.push(`${r.key}: installeert of start iets buiten de repo; dek hem met een eigen check`);
    else if (/\bpip3?\s+install\b/.test(runs) && !venv) skipped.push(`${r.key}: installeert met pip; maak eerst een .venv, anders komt dat in je systeem-Python`);
    else {
      const stem = r.file.replace(/\.ya?ml$/, '');
      let id = `ci-${r.job.id}`;
      for (let n = 2; ids.has(id); n++) id = n === 2 ? `ci-${stem}-${r.job.id}` : `ci-${stem}-${r.job.id}-${n}`;
      ids.add(id);
      const extra = venv && /\bpip3?\s+install\b|\bpython3?\b/.test(runs) ? ` --path ${venv}/bin` : '';
      (cfg.checks ||= []).push({
        id,
        tier: 'push',
        when: '.',
        $why: `Speelt CI-job ${r.key} lokaal na (poort parity --fix).`,
        run: `node {poort}/checks/ci-job.mjs --workflow .github/workflows/${r.file} --job ${r.job.id}${extra}`,
        timeout: 600,
      });
      added.push(`${id} → ${r.key}`);
    }
  }
  if (added.length) {
    const ind = cfgText.match(/^([ \t]+)"/m)?.[1] || '  ';
    fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, ind) + '\n');
  }
  console.log(`ci-parity --fix: ${added.length} check(s) toegevoegd aan ${path.basename(cfgFile)}`);
  for (const a of added) console.log(`  + ${a}`);
  for (const s of skipped) console.log(`  · ${s}`);
  console.log('');
  const again = spawnSync(process.execPath, [process.argv[1]], { cwd: process.cwd(), stdio: 'inherit', env: { ...process.env, POORT_PARITY_ALL: '1' } });
  process.exit(again.status ?? 1);
}

// ---------- uitslag ----------

const width = Math.max(10, ...rows.map((r) => r.key.length));
const open = rows.filter((r) => !r.ok);
console.log(`ci-parity: ${rows.length} CI-jobs op pull request/push in ${all.filter((w) => w.on.some((t) => TRIGGERS.has(t))).length} workflow(s)`);
for (const r of rows) console.log(`  ${r.ok ? (r.quiet ? '−' : '✓') : '✗'} ${r.key.padEnd(width)}  ${r.text}`);
for (const b of bad) console.log(`  ✗ ${b.text}`);
if (!open.length && !bad.length) process.exit(0);

const HOW = 'Dek een job met "ci": "<workflow>#<job>" op een check, of zet hem met reden in "ciWaive".';
if (ALL) {
  console.log(`${open.length} job(s) open, ${bad.length} verwijzing(en) fout. ${HOW}`);
  process.exit(1);
}

// Als check: alleen wat deze wijziging open zet blokkeert. Een gewijzigde config
// telt tegen de config op de base: wat daar gedekt was en nu open is, zette jij
// open. Een config die nieuw is (net init) blokkeert geen job die al open stond,
// wel een kapotte verwijzing erin: die heb je net getypt.
let wasOpen = null;
if (touched.has(cfgRel)) {
  try {
    const old = coverage(JSON.parse(git(['show', `${base}:${cfgRel}`], { cwd: root })));
    wasOpen = { rows: new Set(old.rows.filter((r) => !r.ok).map((r) => r.key)), bad: new Set(old.bad.map((b) => b.id || b.text)) };
  } catch {
    wasOpen = { rows: new Set(open.map((r) => r.key)), bad: new Set() };
  }
}
const mine = open.filter((r) => changedJobs.has(r.key) || (wasOpen && !wasOpen.rows.has(r.key)));
const mineBad = bad.filter((b) => (wasOpen && !wasOpen.bad.has(b.id || b.text)) || (b.sel && removed.some((r) => b.sel.wf.test(r.file) && b.sel.job.test(r.id))));
const before = open.length - mine.length + bad.length - mineBad.length;
if (before) warn(`ci-parity: ${before} CI-job(s) of verwijzing(en) stonden al open; zie poort parity`);
if (mine.length || mineBad.length) {
  const what = [...mine.map((r) => r.key), ...mineBad.map((b) => b.text)];
  console.log(`Deze wijziging zet ${what.length} ding(en) open: ${what.join('; ')}. ${HOW}`);
  process.exit(1);
}
