#!/usr/bin/env node
// Lokaal groen, in CI rood: code die een bestand noemt dat hier wel op schijf
// staat, maar niet in git (genegeerd of nooit toegevoegd). CI checkt alleen uit
// wat getrackt is, dus daar ontbreekt het. Incident: een test las
// .harness/supergoal/context/snap-normal.json (gitignored) en faalde 14x in CI.
//
// Gekeken wordt naar letterlijke strings op de regels die deze wijziging
// toevoegt, die als pad gelezen naar iets binnen de repo wijzen dat bestaat en
// niet getrackt is. Wat niet bestaat (een URL-pad, een tabelnaam) telt dus niet.
// node_modules, virtualenvs en build-uitvoer zijn bedoeld ongetrackt en tellen
// niet mee. Een pad dat de code tijdens het draaien opbouwt, ziet deze check niet.
// In een test blokkeert het, elders is het advies.
//
//   node untracked-refs.mjs {files}
import fs from 'node:fs';
import path from 'node:path';
import { addedLines, git, isTest, top as gitTop, warn } from './_lib.mjs';

const root = gitTop() || process.cwd();
const BUILT = /(^|\/)(node_modules|\.venv|venv|\.tox|dist|build|coverage|\.next|\.nuxt|\.cache|__pycache__|\.pytest_cache|\.mypy_cache|\.ruff_cache|\.git|\.e2e)(\/|$)/;
const tracked = new Set(git(['ls-files', '-z'], { cwd: root }).split('\0').filter(Boolean));
const trackedDirs = new Set();
for (const f of tracked) for (let d = path.posix.dirname(f); d !== '.'; d = path.posix.dirname(d)) trackedDirs.add(d);
// check-ignore noemt het pad alleen als het genegeerd wordt.
const isIgnored = (rel) => git(['check-ignore', '--', rel], { cwd: root }).trim() === rel;

// Strings die op een pad lijken: een / of een extensie, geen spaties, geen URL.
const STRING = /(["'`])([^"'`\s$<>{}|*?]{3,200})\1/g;
const looksLikePath = (s) => !s.includes('://') && !s.startsWith('//') && (s.includes('/') || /\.[A-Za-z0-9]{1,6}$/.test(s)) && !/^\.+$/.test(s);

// Documentatie noemt paden, maar draait niet.
const DOCS = /\.(md|mdx|rst|txt|adoc)$/i;

const blocking = [];
const advice = [];
for (const file of process.argv.slice(2)) {
  if (!fs.existsSync(path.join(root, file)) || BUILT.test(file) || DOCS.test(file)) continue;
  const rel0 = path.relative(root, path.resolve(root, file)).split(path.sep).join('/');
  const seen = new Set();
  for (const line of addedLines(rel0)) {
    for (const m of line.matchAll(STRING)) {
      const s = m[2].replace(/^\.\//, '');
      if (!looksLikePath(s) || seen.has(s)) continue;
      seen.add(s);
      // Vanaf de map van het bestand, en een pad met een / ook vanaf de repo-root. Een
      // kale naam (".env") zonder map is meestal een bestand dat de code zelf ergens maakt.
      const here = path.dirname(path.join(root, rel0));
      for (const base of s.includes('/') ? [root, here] : [here]) {
        const abs = path.resolve(base, s.startsWith('/') ? s.slice(1) : s);
        const rel = path.relative(root, abs).split(path.sep).join('/');
        if (!rel || rel.startsWith('..') || BUILT.test(rel) || !fs.existsSync(abs)) continue;
        if (tracked.has(rel) || trackedDirs.has(rel)) break;
        const why = isIgnored(rel) ? 'genegeerd door .gitignore' : 'niet getrackt';
        (isTest(rel0) ? blocking : advice).push(`${rel0}: "${m[2]}" wijst naar ${rel} (${why}); in CI bestaat dat niet`);
        break;
      }
    }
  }
}
for (const a of advice) warn(a);
if (blocking.length) {
  for (const b of blocking) console.log(b);
  console.log('Commit het bestand (git add -f als het genegeerd is), maak het in de test zelf aan, of gebruik een fixture die in git staat.');
  process.exit(1);
}
