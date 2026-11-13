#!/usr/bin/env node
// Gestapelde of verouderde branch. Blokkeert bij een échte inhoudsconflict met
// de base (git merge-tree, exact, geen heuristiek), en met --max-behind ook als
// de achterstand boven de drempel komt: de groene tests zeggen dan weinig meer
// over de code waar de branch in landt. Achterstand daaronder, en overlap met
// bestanden die op de base veranderd zijn, worden advies: zo'n overlap kan een
// al gefixte bug terugbrengen zonder dat git een conflict ziet.
//
// Gebruik: node stale-branch.mjs [branch] [--max-behind <n>]
//   branch        de doelbranch (bijv. origin/main); zonder argument POORT_BASE_REF,
//                 anders origin/main. Een kale SHA (zoals de merge-base) werkt niet:
//                 die loopt nooit achter. Dan volgt een waarschuwing en de default.
//   --max-behind  rood boven n commits achterstand; zonder de vlag alleen advies
// POORT_OFFLINE=1 slaat de fetch over. Resultaat hangt van de remote af: zet
// "cache": false en "required": false op deze check.
import { spawnSync } from 'node:child_process';
import { git, lines, warn } from './_lib.mjs';

const argv = process.argv.slice(2);
// --max-behind 5 en --max-behind=5.
const eqAt = argv.findIndex((a) => a.startsWith('--max-behind='));
if (eqAt >= 0) argv.splice(eqAt, 1, '--max-behind', argv[eqAt].slice('--max-behind='.length));
const maxAt = argv.indexOf('--max-behind');
const maxRaw = maxAt >= 0 ? argv[maxAt + 1] : undefined;
const maxBehind = maxAt < 0 ? Infinity : maxRaw?.trim() ? Number(maxRaw) : NaN;
if (maxAt >= 0 && !(Number.isInteger(maxBehind) && maxBehind >= 0)) {
  console.log(`--max-behind wil een aantal commits, geen "${argv[maxAt + 1] ?? ''}"`);
  process.exit(2);
}
let arg = argv.filter((_, i) => maxAt < 0 || (i !== maxAt && i !== maxAt + 1))[0];
// Hex en geen ref (een branch mag "cafe1234" heten): een SHA.
if (arg && /^[0-9a-f]{7,40}$/i.test(arg) && !git(['rev-parse', '--symbolic-full-name', arg]).trim()) {
  warn(`stale-branch verwacht een branchnaam (bijv. origin/main), geen SHA (${arg.slice(0, 12)}); ${process.env.POORT_BASE_REF || 'origin/main'} gebruikt`);
  arg = null;
}
const baseRef = arg || process.env.POORT_BASE_REF || 'origin/main';
if (!process.env.POORT_OFFLINE && baseRef.startsWith('origin/')) {
  // Expliciete refspec: een smalle fetch-refspec werkt de remote-branch anders niet
  // bij, en dan telt de check de achterstand op een oude base.
  const b = baseRef.slice(7);
  const f = spawnSync('git', ['fetch', '--quiet', 'origin', `+refs/heads/${b}:refs/remotes/origin/${b}`], { timeout: 30000 });
  if (f.status !== 0) warn(`${baseRef} niet opgehaald; de achterstand telt tegen de laatst bekende stand`);
}
if (!git(['rev-parse', '--verify', '--quiet', baseRef]).trim()) {
  warn(`base ${baseRef} niet gevonden; stale-branch overgeslagen`);
  process.exit(0);
}

const behind = Number(git(['rev-list', '--count', `HEAD..${baseRef}`]).trim() || 0);
if (!behind) process.exit(0);

const mt = spawnSync('git', ['merge-tree', '--write-tree', '--name-only', '--no-messages', 'HEAD', baseRef], { encoding: 'utf8' });
if (mt.status === 1) {
  const files = lines(mt.stdout).slice(1);
  console.log(`Conflict met ${baseRef} (${behind} commits achter) in:`);
  for (const f of files) console.log(`  ${f}`);
  console.log(`Rebase eerst: git fetch && git rebase ${baseRef}`);
  process.exit(1);
}
// 0 is schoon, 1 een conflict; al het andere is een mislukte merge-tree, bijv.
// een git ouder dan 2.38 zonder --write-tree. Dan is de check rood, niet stil groen.
if (mt.status !== 0) {
  console.log(`git merge-tree faalde (${mt.status === null ? String(mt.error?.message || mt.signal) : `exit ${mt.status}`}); stale-branch heeft git 2.38 of nieuwer nodig.`);
  const err = String(mt.stderr || '').trim();
  if (err) console.log(err.split('\n').slice(0, 5).join('\n'));
  process.exit(1);
}

if (behind > maxBehind) {
  console.log(`${behind} commits achter ${baseRef}; de grens is ${maxBehind}.`);
  console.log(`Rebase eerst: git fetch && git rebase ${baseRef}`);
  process.exit(1);
}

const mb = git(['merge-base', 'HEAD', baseRef]).trim();
const theirs = new Set(lines(git(['diff', '--name-only', `${mb}..${baseRef}`])));
const overlap = lines(git(['diff', '--name-only', `${mb}..HEAD`])).filter((f) => theirs.has(f));
if (overlap.length) {
  warn(`${behind} commits achter ${baseRef}; ${overlap.length} bestand(en) ook daar gewijzigd (${overlap.slice(0, 3).join(', ')}${overlap.length > 3 ? ', …' : ''}). Merge is schoon, maar rebase en hertest: een fix op de base kan stil terugdraaien.`);
} else {
  warn(`${behind} commits achter ${baseRef}; geen overlap. Rebase vóór review.`);
}
