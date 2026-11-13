#!/usr/bin/env node
// Draaien de checks op dezelfde Node en Python als CI? Een ander Node-major of
// Python-minor geeft fouten die alleen daar optreden: `fetch is not defined` op
// Node 20 terwijl lokaal Node 24 draait, een dependency die een andere TypeScript
// kiest. De versies komen uit de workflows (node-version, node-version-file,
// python-version, python-version-file van de setup-stappen).
//
//   node toolchain.mjs [--python <pad naar python>] {files}
//
// Zonder --python: de venv van de repo (.venv of venv in de root), anders python3.
// Een versie als 3.x of 20.x vergelijkt alleen de cijfers vóór de x; een lijst
// (meerdere regels of [a, b]) is goed als één ervan klopt.
// Alleen de runtimes die de wijziging raakt: .py voor Python, JS/TS en
// package.json voor Node. Een versie uit een expressie (matrix) wordt overgeslagen.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { top as gitTop } from './_lib.mjs';
import { workflows } from './_workflow.mjs';

const root = gitTop() || process.cwd();
const argv = process.argv.slice(2);
const pyAt = argv.indexOf('--python');
const venv = ['.venv/bin/python', 'venv/bin/python', '.venv/Scripts/python.exe', 'venv/Scripts/python.exe'].map((p) => path.join(root, p)).find((p) => fs.existsSync(p));
const python = pyAt >= 0 ? argv[pyAt + 1] : venv || 'python3';
const files = pyAt < 0 ? argv : argv.filter((_, i) => i !== pyAt && i !== pyAt + 1);

const wants = { node: new Set(), python: new Set() };
const readVersionFile = (f) => {
  try {
    return fs.readFileSync(path.join(root, f), 'utf8').trim().split('\n')[0].replace(/^v/, '');
  } catch {
    return null;
  }
};
for (const w of workflows(root)) {
  for (const job of w.jobs) {
    for (const s of job.steps) {
      const m = String(s.uses || '').match(/^actions\/setup-(node|python)@/);
      if (!m || !s.with || typeof s.with !== 'object') continue;
      const tool = m[1];
      const v = s.with[`${tool}-version`] ?? readVersionFile(s.with[`${tool}-version-file`] || '');
      if (!v || String(v).includes('${{')) continue;
      for (const one of String(v).replace(/^\[|\]$/g, '').split(/[\s,]+/).filter(Boolean)) wants[tool].add(one.replace(/^["']|["']$/g, '').replace(/^v/, ''));
    }
  }
}

const touches = {
  node: files.some((f) => /\.([mc]?[jt]sx?|vue|svelte)$|(^|\/)package(-lock)?\.json$|(^|\/)(pnpm-lock\.yaml|yarn\.lock)$/.test(f)),
  python: files.some((f) => /\.py$|(^|\/)(requirements[^/]*\.txt|pyproject\.toml|uv\.lock|poetry\.lock)$/.test(f)),
};
const local = {
  node: process.versions.node,
  python: (spawnSync(python, ['--version'], { encoding: 'utf8' }).stdout || '').trim().replace(/^Python /, ''),
};
// Node: hetzelfde major. Python: hetzelfde major.minor. "lts/*" en dergelijke: niet te vergelijken.
const same = (tool, want, have) => {
  if (!/^\d/.test(want)) return true;
  const n = tool === 'node' ? 1 : 2;
  const w = want.split('.').slice(0, n);
  const x = w.findIndex((p) => !/^\d+$/.test(p)); // 3.x: alleen wat vóór de x staat
  const parts = x < 0 ? w : w.slice(0, x);
  return parts.join('.') === have.split('.').slice(0, parts.length).join('.');
};
const HINT = {
  node: (v) => `fnm use ${v.split('.')[0]} (brew install fnm), nvm use ${v.split('.')[0]} of volta pin node@${v.split('.')[0]}`,
  python: (v) => `uv venv --python ${v} (of pyenv local ${v}) en de checks die venv laten gebruiken`,
};
const bad = [];
for (const tool of ['node', 'python']) {
  if (!touches[tool] || !wants[tool].size) continue;
  if (!local[tool]) {
    bad.push(`${tool}: CI draait ${[...wants[tool]].join(' / ')}, maar ${tool === 'python' ? python : 'node'} is hier niet te vinden`);
    continue;
  }
  if (![...wants[tool]].some((v) => same(tool, v, local[tool]))) {
    const v = [...wants[tool]][0];
    bad.push(`${tool}: CI draait ${[...wants[tool]].join(' / ')}, hier ${local[tool]}. Wissel: ${HINT[tool](v)}`);
  }
}
if (bad.length) {
  for (const b of bad) console.log(b);
  console.log('Een andere versie dan CI geeft fouten die alleen daar optreden (fetch, TypeScript-versie, syntax).');
  process.exit(1);
}
