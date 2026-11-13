// pytest's own --ignore paths (from pytest.ini's addopts), for tests-affected.
//
// `pytest tests` skips an ignored folder, but a file named on the command line
// is collected even inside one. tests-affected names the files its import graph
// reaches, so without this it ran tests the project deliberately leaves out of a
// normal run (e.g. a suite that needs a production copy). Respecting --ignore
// makes "the affected tests" mean the same as "the affected part of `pytest tests`".
//
// Reads pytest.ini only (the file pytest prefers); --ignore-glob is not handled.
import fs from 'node:fs';
import path from 'node:path';

/** The --ignore paths in <root>/pytest.ini's addopts, absolute. [] when there are none. */
export function pytestIgnores(root) {
  const ini = path.join(root, 'pytest.ini');
  if (!fs.existsSync(ini)) return [];
  const addopts = [];
  let inSection = false;
  let inAddopts = false;
  for (const raw of fs.readFileSync(ini, 'utf8').split('\n')) {
    const line = raw.replace(/\s+#.*$/, '');
    if (/^\s*\[/.test(line)) {
      inSection = /^\s*\[pytest\]\s*$/.test(line);
      inAddopts = false;
      continue;
    }
    if (!inSection || /^\s*[#;]/.test(raw)) continue;
    const m = line.match(/^addopts\s*=\s*(.*)$/);
    if (m) {
      inAddopts = true;
      addopts.push(m[1]);
    } else if (inAddopts && /^\s+\S/.test(line)) {
      addopts.push(line.trim()); // continuation line
    } else if (/^\S/.test(line)) {
      inAddopts = false;
    }
  }
  const words = addopts.join(' ').split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.startsWith('--ignore=')) out.push(w.slice('--ignore='.length));
    else if (w === '--ignore' && words[i + 1]) out.push(words[++i]);
  }
  return out.map((p) => path.resolve(root, p));
}

/** True when `file` is an ignored path or lies under one. */
export function isIgnored(file, ignores) {
  const f = path.resolve(file);
  return ignores.some((ig) => f === ig || f.startsWith(ig + path.sep));
}
