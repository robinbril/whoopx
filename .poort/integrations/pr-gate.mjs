#!/usr/bin/env node
// PR-poort voor agents: blokkeert `gh pr create` / `gh pr ready` tot
// `poort verify` groen is voor precies de commit die gepusht wordt.
//
// Werkt als hook voor:
//   Claude Code  PreToolUse, matcher "Bash|PowerShell"  (stdin: {tool_input:{command}}; blokkeren = exit 2 + stderr)
//   Cursor       beforeShellExecution        (stdin: {command}; blokkeren = {"permission":"deny","user_message",...})
// Andere commando's laat hij ongemoeid door.
//
// Het commando wordt gelezen zoals de shell het ziet (quotes weg, delen aan
// elkaar), niet als ruwe tekst: `gh pr "create"` is ook een PR. Een subcommando
// uit een variabele (`gh pr $SUB`) kan een hook niet invullen; dat telt als PR.
// Deny by default: gh telt op elke plek in een commando, dus ook na een
// voorvoegsel dat de hook niet kent (timeout, nice, then, do); alleen na echo of
// printf is het tekst. Ook genest: `sh -c '...'` (en bash, zsh, dash, ksh),
// `eval`, `$(...)`, backticks, `<(...)` en groepering met `( ... )` of `{ ...; }`.
// Op Windows ook `pwsh -Command`, `-EncodedCommand`, `cmd /c`, `iex` en Start-Process.
// Een POST naar repos/<o>/<r>/pulls via `gh api` en de GraphQL-mutaties
// createPullRequest en markPullRequestReadyForReview tellen ook als PR.
// Gecontroleerd wordt de repo waar gh draait: cd en pushd ervoor tellen mee, een
// cd die de hook niet kan volgen blokkeert. Een PR voor een andere repo (-R,
// GH_REPO of een gh api-pad) gaat door: die repo heeft zijn eigen poort. VAR=x
// vóór gh (POORT_SKIP, een stack-adres) gaat mee naar `poort verify`.
// Niet afgedekt: een PR via de website, of een script dat uit een bestand of
// stdin naar een shell gaat.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Shell-woorden per commando. Scheidingstekens (; && || | & en een newline)
// beginnen een nieuw commando. `$(...)`, `<(...)`, `>(...)` en backticks horen
// bij het woord, zoals in de shell; hun inhoud is zelf een commando (subs). De
// regels van een heredoc zijn invoer, geen commando, en een # aan het begin van
// een woord begint commentaar. Geen volledige shell: genoeg voor wat agents typen.
// Binnen een substitutie is closer ')' of '`': daar stopt de scan (end).
function scan(s, start = 0, closer = null) {
  const out = [{ words: [], subs: [] }];
  let word = null;
  let depth = 0; // open ( binnen een $( ... )
  const heredocs = [];
  const add = (t) => (word = (word ?? '') + t);
  const end = () => {
    if (word !== null) out.at(-1).words.push(word);
    word = null;
  };
  // Een substitutie vanaf i met een opener van len tekens: tekst bij het woord, inhoud apart.
  const sub = (i, len) => {
    const inner = scan(s, i + len, s[i] === '`' ? '`' : ')');
    add(s.slice(i, inner.end + 1));
    out.at(-1).subs.push(s.slice(i + len, inner.end));
    return inner.end;
  };
  let i = start;
  for (; i < s.length; i++) {
    const ch = s[i];
    const next = s[i + 1];
    if (closer === '`' && ch === '`') break;
    if (ch === "'") {
      const j = s.indexOf("'", i + 1);
      add(s.slice(i + 1, j < 0 ? undefined : j));
      i = j < 0 ? s.length : j;
    } else if (ch === '"') {
      let t = '';
      for (i++; i < s.length && s[i] !== '"'; i++) {
        if (s[i] === '\\' && /["\\$`]/.test(s[i + 1] ?? '')) t += s[++i];
        else if (s[i] === '`' || (s[i] === '$' && s[i + 1] === '(')) {
          add(t);
          t = '';
          i = sub(i, s[i] === '`' ? 1 : 2);
        } else t += s[i];
      }
      add(t);
    } else if (ch === '\\' && next === '\n') i++; // de regel loopt door
    // Op Windows is een backslash in een pad een scheider: `cd C:\repo`, `.\gh.exe`.
    // Alleen daar: in `gh p\r create` blijft hij een escape, want Git Bash leest dat als pr.
    else if (ch === '\\' && process.platform === 'win32' && /^([A-Za-z]:|\.{1,2}$|\.{1,2}[\\/])/.test(word ?? '')) add(ch);
    else if (ch === '\\' && i + 1 < s.length) add(s[++i]);
    else if ((ch === '$' || ch === '<' || ch === '>') && next === '(') i = sub(i, 2);
    else if (ch === '`') i = sub(i, 1);
    else if (s.startsWith('<<<', i)) add('<<<'), (i += 2);
    else if (ch === '<' && next === '<') {
      const m = s.slice(i + 2).match(/^-?[ \t]*(?:'([^'\n]*)'|"([^"\n]*)"|\\?([^\s;&|<>()'"`]+))/);
      if (m) {
        end();
        heredocs.push({ marker: m[1] ?? m[2] ?? m[3], quoted: m[3] === undefined || m[0].includes('\\'), at: out.length - 1 });
        i += 1 + m[0].length;
      } else add('<<'), i++;
    } else if (ch === '#' && word === null) {
      while (i + 1 < s.length && s[i + 1] !== '\n') i++;
    } else if (closer === ')' && ch === '(') depth++, add(ch);
    else if (closer === ')' && ch === ')') {
      if (!depth) break;
      depth--;
      add(ch);
    } else if (/[;&|\n]/.test(ch)) {
      end();
      if (out.at(-1).words.length) out.push({ words: [], subs: [] });
      // De regels van een heredoc zijn invoer. Gaat die invoer naar een shell
      // (`bash <<EOF`), dan is het een script; zonder quotes rond de marker vult
      // de shell er $(...) en backticks in. Beide tellen als commando.
      if (ch === '\n') {
        for (const h of heredocs.splice(0)) {
          const body = heredocBody(s, i + 1, h.marker);
          if (!body) break; // geen eindmarkering: niets overslaan
          if (out.slice(h.at).some((c) => readsScript(c.words))) out[h.at].subs.push(body.text);
          else if (!h.quoted) out[h.at].subs.push(...substitutions(body.text));
          i = body.next - 1;
        }
      }
    } else if (/\s/.test(ch)) end();
    else add(ch);
  }
  end();
  return { cmds: out.filter((c) => c.words.length), end: i };
}

// De regels van een heredoc vanaf regelbegin j tot de eindmarkering, en de
// index erna; null zonder eindmarkering.
function heredocBody(s, j, marker) {
  for (let k = j; k < s.length; ) {
    const nl = s.indexOf('\n', k);
    const line = s.slice(k, nl < 0 ? s.length : nl);
    if (line.trim() === marker) return { text: s.slice(j, k), next: nl < 0 ? s.length : nl + 1 };
    k = nl < 0 ? s.length : nl + 1;
  }
  return null;
}

// De inhoud van elke $(...) en backtick in tekst die de shell invult.
function substitutions(text) {
  const out = [];
  for (let k = 0; k < text.length; k++) {
    if (text[k] === '\\') k++;
    else if (text[k] === '`' || (text[k] === '$' && text[k + 1] === '(')) {
      const len = text[k] === '`' ? 1 : 2;
      const inner = scan(text, k + len, len === 1 ? '`' : ')');
      out.push(text.slice(k + len, inner.end));
      k = inner.end;
    }
  }
  return out;
}

// Een shell zonder -c leest zijn script van stdin: `bash`, `sh -s`.
function readsScript(words) {
  const at = program(words);
  return isShell(words[at] ?? '') && commandFlag(words, at) < 0;
}

export function commands(command) {
  return scan(command).cmds.map((c) => c.words);
}

// Commando's zonder groepering: `( ... )`, `{ ...; }` en een `!` vooraan horen
// niet bij het commando. Per commando ook hoeveel subshells `(` er openen en `)`
// sluiten, zodat een cd in een subshell niet naar buiten lekt. Een `)` vast aan
// het laatste woord telt alleen als er een subshell open staat; anders is het
// tekst (`--title "fix (x)"`).
function* segments(command) {
  let open = 0;
  for (const { words: raw, subs } of scan(command).cmds) {
    const words = [...raw];
    let opens = 0;
    while (words.length && /^[({!]/.test(words[0])) {
      const lead = words[0].match(/^[({!]+/)[0];
      opens += lead.split('(').length - 1;
      words[0] = words[0].slice(lead.length);
      if (words[0]) break;
      words.shift();
    }
    open += opens;
    let closes = 0;
    while (words.length && /^[)}]+$/.test(words.at(-1))) closes += words.pop().split(')').length - 1;
    const tail = words.at(-1)?.match(/\)+$/)?.[0].length ?? 0;
    const strip = Math.min(tail, Math.max(open - closes, 0));
    if (strip) words[words.length - 1] = words.at(-1).slice(0, -strip);
    closes = Math.min(closes + strip, open);
    open -= closes;
    yield { words, subs, opens, closes };
  }
}

// Voorvoegsels die het eigenlijke commando starten, met hun opties die een
// losse waarde hebben (`xargs -I {} gh ...`, `sudo -u robin gh ...`).
const PREFIXES = { env: /^-[uC]$/, command: null, exec: /^-a$/, time: null, nohup: null, sudo: /^-[ugCDhpr]$/, xargs: /^-[ILnPsdEa]$/ };
// Shell-woorden die een commando inleiden: wat erna komt is het programma.
const KEYWORDS = new Set(['if', 'then', 'else', 'elif', 'do', 'while', 'until', '!', '{']);
// Index van het programma: na VAR=x, na if/then/do en na env/command/exec/time/nohup/sudo/xargs met hun opties.
function program(words) {
  let i = 0;
  let prefix = null;
  while (i < words.length) {
    const w = words[i];
    if (/^\w+=/.test(w) || KEYWORDS.has(w)) i++;
    else if (Object.hasOwn(PREFIXES, w)) (prefix = w), i++;
    else if (prefix && w.startsWith('-')) i += PREFIXES[prefix]?.test(w) ? 2 : 1;
    else break;
  }
  return i;
}
// Na echo of printf is alles tekst, ook `gh pr create`.
const isText = (words) => /^(echo|printf|print)$/.test(path.basename(words[program(words)] ?? ''));
// De naam achter een pad, met / of \: de hook kan op elk platform een Windows-pad zien.
const baseName = (w) => w.split(/[\\/]/).pop();
// Een woord dat een programma noemt (geen tekst met spaties): `gh`, `/usr/bin/gh`.
const named = (w, re) => !/\s/.test(w) && re.test(baseName(w));
const POWERSHELLS = /^(pwsh|powershell)(\.exe)?$/i;
const isShell = (w) => named(w, /^(sh|bash|zsh|dash|ksh)(\.exe)?$/i) || named(w, POWERSHELLS);
// De optie met het commando. POSIX: -c, ook samengesteld (-lc), hoofdlettergevoelig:
// bash -C is iets anders. PowerShell: -Command en elke afkorting daarvan.
function commandFlag(words, at) {
  const re = named(words[at], POWERSHELLS) ? /^-c(o(m(m(a(n(d)?)?)?)?)?)?$/i : /^-[a-zA-Z]*c[a-zA-Z]*$/;
  return words.findIndex((w, k) => k > at && re.test(w));
}

// Hoe diep `sh -c "bash -c '...'"` en `eval` worden uitgepakt. Dieper genest
// en met gh erin: dan telt het als PR, en is de map onbekend.
const MAX_NESTING = 4;
// Een nieuw commando binnen dit commando: de tekst na `sh -c` (ook bash, zsh,
// dash, ksh en samengestelde opties als -lc) of na `eval`; anders null. Net als
// gh telt een shell op elke plek, ook na een voorvoegsel als timeout.
function innerCommand(words) {
  if (isText(words)) return null;
  for (let at = program(words); at < words.length; at++) {
    if (isShell(words[at])) {
      const c = commandFlag(words, at);
      if (c >= 0) return words[c + 1] ?? '';
    }
    if (named(words[at], POWERSHELLS)) {
      const e = words.findIndex((w, k) => k > at && /^-e(c|n|nc|ncodedcommand)?$/i.test(w));
      if (e >= 0) return Buffer.from(words[e + 1] ?? '', 'base64').toString('utf16le');
    }
    if (named(words[at], /^cmd(\.exe)?$/i)) {
      const c = words.findIndex((w, k) => k > at && /^\/[ck]$/i.test(w));
      if (c >= 0) return words.slice(c + 1).join(' ');
    }
    // eval en iex plakken hun argumenten met spaties aan elkaar en lezen dat opnieuw.
    if (named(words[at], /^(eval|iex|invoke-expression)$/i)) return words.slice(at + 1).join(' ');
    if (named(words[at], /^start-process$/i)) return words.slice(at + 1).join(' ').replaceAll(',', ' ');
  }
  return null;
}
const tooDeep = (inner, depth) => depth >= MAX_NESTING && /\bgh\b/i.test(inner);

const dynamic = (w) => /[$`]/.test(w ?? '');
const isOption = (w) => /^-./.test(w);
// Waar een subcommando kan staan, vanaf from: elk woord dat geen optie is, tot en
// met het eerste dat niet direct na een optie staat. Of een optie een waarde
// heeft, weet de hook niet (`gh -H host pr create`), dus telt het woord erna mee.
function verbs(words, from = 0) {
  const out = [];
  for (let i = from; i < words.length; i++) {
    if (words[i] === '--') {
      if (i + 1 < words.length) out.push(i + 1);
      break;
    }
    if (isOption(words[i])) continue;
    out.push(i);
    if (i === from || !isOption(words[i - 1]) || words[i - 1].includes('=')) break;
  }
  return out;
}

// `gh api` opent een PR met een POST naar repos/<o>/<r>/pulls, of met de
// GraphQL-mutatie createPullRequest of markPullRequestReadyForReview. gh api
// doet een POST zodra er velden of --input bij staan, of met -X POST. Een pad
// uit een variabele kan de hook niet lezen: met een POST telt dat als PR.
const API_VALUE = /^(-[XfFHpqt]|--(method|field|raw-field|header|preview|jq|template|hostname|input|cache))$/;
function apiOpensPr(args) {
  if (args.some((w) => /\b(createPullRequest|markPullRequestReadyForReview)\b/.test(w))) return true;
  let method = null;
  let fields = false;
  let endpoint = null;
  for (let i = 0; i < args.length; i++) {
    const w = args[i];
    const m = w.match(/^(?:-X|--method=)(.+)$/);
    if (m) method = m[1];
    else if (API_VALUE.test(w)) {
      if (w === '-X' || w === '--method') method = args[i + 1] ?? '';
      if (/^(-[fF]|--field|--raw-field|--input)$/.test(w)) fields = true;
      i++;
    } else if (/^(-[fF].|--(field|raw-field|input)=)/.test(w)) fields = true;
    else if (!isOption(w)) endpoint ??= w;
  }
  const post = method === null ? fields : /^post$/i.test(method);
  return post && endpoint !== null && (dynamic(endpoint) || /^\/?repos\/[^/]+\/[^/]+\/pulls\/?(\?.*)?$/.test(endpoint));
}

// Opent `gh <rest>` een PR of zet het er een op 'ready'?
function ghOpensPr(rest) {
  for (const v of verbs(rest)) {
    if (rest[v] === 'api') {
      if (apiOpensPr(rest.slice(v + 1))) return true;
      continue;
    }
    if (rest[v] !== 'pr' && !dynamic(rest[v])) continue;
    for (const s of verbs(rest, v + 1)) {
      const sub = rest[s];
      // `gh pr ready --undo` zet een PR terug naar draft: niets om te bewaken. De
      // laatste --undo telt, zoals bij gh: `--undo --undo=false` is wel ready.
      if (sub === 'ready') {
        const undo = rest.filter((w) => w === '--undo' || w.startsWith('--undo=')).at(-1);
        if (undo && /^--undo(=(1|t|true))?$/i.test(undo)) continue;
      }
      if (/^(create|new|ready)$/.test(sub) || dynamic(sub)) return true;
    }
  }
  return false;
}

// Het gh-commando dat een PR opent of op 'ready' zet, als woordenlijst na gh;
// anders null. gh telt op elke plek, behalve na echo of printf.
function prWords(words) {
  if (isText(words)) return null;
  for (let g = program(words); g < words.length; g++) {
    // Geen named(): het standaardpad op Windows heeft spaties (Program Files\GitHub CLI).
    // PowerShell plakt haakjes aan het woord: `try {gh pr create} catch {}`.
    if (!/^gh(\.exe)?$/i.test(baseName(words[g].replace(/^[{(]+/, '')))) continue;
    const rest = /^[{(]/.test(words[g]) ? words.slice(g + 1).map((w) => w.replace(/[})]+$/, '')) : words.slice(g + 1);
    if (ghOpensPr(rest)) return rest;
  }
  return null;
}

// Ook binnen `sh -c '...'`, `bash -c`, `eval`, `$(...)`, backticks en `( ... )`.
export function prCommand(command, depth = 0) {
  for (const { words, subs } of segments(command)) {
    for (const inner of [...subs, innerCommand(words)]) {
      if (inner === null) continue;
      if (tooDeep(inner, depth)) return [];
      const nested = depth < MAX_NESTING ? prCommand(inner, depth + 1) : null;
      if (nested) return nested;
    }
    const rest = prWords(words);
    if (rest) return rest;
  }
  return null;
}

// De VAR=x die vóór het PR-commando staan, zoals POORT_SKIP/POORT_SKIP_REASON of
// het stack-adres uit urlEnv (`REFORGE_E2E_URL=... gh pr create`). De hook ziet
// alleen de tekst van het commando, niet de env waarin het straks draait. Een
// dynamische waarde ($VAR, $(...)) kan de hook niet invullen en blijft weg.
export function prefixEnv(command, depth = 0) {
  for (const { words, subs } of segments(command)) {
    for (const inner of [...subs, innerCommand(words)]) {
      if (inner === null || depth >= MAX_NESTING || !prCommand(inner, depth + 1)) continue;
      return prefixEnv(inner, depth + 1);
    }
    if (!prWords(words)) continue;
    const env = {};
    for (const w of words.slice(0, program(words))) {
      const m = w.match(/^(\w+)=(.*)$/s);
      if (m && !dynamic(m[2])) env[m[1]] = m[2];
    }
    return env;
  }
  return {};
}

// De map na een cd of pushd (of popd); dir zelf bij een ander commando.
function cdStep(words, dir) {
  let at = 0;
  while (at < words.length && (/^\w+=/.test(words[at]) || KEYWORDS.has(words[at]) || /^(builtin|command|time)$/.test(words[at]))) at++;
  const [cmd, ...args] = words.slice(at);
  if (cmd === 'popd') return null;
  if (cmd !== 'cd' && cmd !== 'pushd') return dir;
  const target = args.find((a) => !/^-[LPe@]+$/.test(a));
  if (target === undefined) return cmd === 'cd' ? os.homedir() : null; // kale pushd wisselt mappen
  if (target === '-' || dynamic(target)) return null;
  if (target === '~' || target.startsWith('~/')) return path.join(os.homedir(), target.slice(1));
  if (target.startsWith('~')) return null; // ~iemand
  if (path.isAbsolute(target)) return path.resolve(target);
  return dir === null ? null : path.resolve(dir, target);
}

// De map waarin het PR-commando draait: de map van de hook plus elke cd of
// pushd ervoor. null als een stap niet te volgen is (variabele, cd -, popd):
// dan weet de hook niet welke repo hij moet controleren. Een cd in een subshell
// `( ... )` geldt alleen daarbinnen; in `sh -c '...'` en `$(...)` telt de cd
// erbinnen mee voor een PR daarbinnen.
export function prCwd(command, cwd) {
  return walkCwd(command, cwd, false);
}

// Dezelfde map, maar naar beste weten: een stap die de hook niet kan volgen
// laat de map staan in plaats van null te geven. Alleen voor informatie; de
// poort zelf gebruikt prCwd en blokkeert dan.
export function prDir(command, cwd) {
  return walkCwd(command, cwd, true);
}

function walkCwd(command, cwd, lenient, depth = 0) {
  let dir = cwd;
  const saved = [];
  for (const { words, subs, opens, closes } of segments(command)) {
    for (let k = 0; k < opens; k++) saved.push(dir);
    for (const inner of [...subs, innerCommand(words)]) {
      if (inner === null) continue;
      if (tooDeep(inner, depth)) return lenient ? dir : null;
      if (depth < MAX_NESTING && prCommand(inner, depth + 1)) return walkCwd(inner, dir, lenient, depth + 1);
    }
    if (prWords(words)) return dir;
    dir = cdStep(words, dir) ?? (lenient ? dir : null);
    for (let k = 0; k < closes; k++) dir = saved.pop();
  }
  return dir;
}

// De waarde van -R/--repo in een gh-commando, of null als er geen is.
export function repoFlag(words) {
  for (let i = 0; i < words.length; i++) {
    if (words[i] === '-R' || words[i] === '--repo') return words[i + 1] ?? '';
    if (words[i].startsWith('--repo=')) return words[i].slice(7);
  }
  return null;
}

// De repo die het commando zelf noemt: -R/--repo, het pad van gh api
// (repos/<o>/<r>/..., {owner}/{repo} is de repo van de werkmap) of GH_REPO.
// null als het commando er geen noemt.
export function targetRepo(command, words) {
  const flag = repoFlag(words);
  if (flag !== null) return flag;
  const api = words.indexOf('api');
  const m = api < 0 ? null : words.slice(api + 1).join('\n').match(/^\/?repos\/([^/\s]+)\/([^/\s]+)\//m);
  if (m && !/[{}]/.test(m[1] + m[2])) return `${m[1]}/${m[2]}`;
  const env = command.match(/\bGH_REPO=("[^"]*"|'[^']*'|[^\s;&|)]*)/);
  return env ? env[1].replace(/^(["'])(.*)\1$/, '$2') : null;
}

// owner/repo van de origin-remote van top; '' als die geen github-remote is.
function originSlug(top) {
  const url = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: top, encoding: 'utf8' }).stdout?.trim() ?? '';
  return url.match(/github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/)?.[1] ?? '';
}

// De repo van deze hook als init hem vendort (<repo>/.poort/integrations/); anders null.
function hookRepo() {
  const integrations = path.dirname(fs.realpathSync(fileURLToPath(import.meta.url)));
  const dotPoort = path.dirname(integrations);
  return path.basename(integrations) === 'integrations' && path.basename(dotPoort) === '.poort' ? path.dirname(dotPoort) : null;
}

// Dezelfde repo: een worktree van dezelfde clone (gedeelde git-map) of een clone van dezelfde origin.
function sameRepo(a, b) {
  const common = (dir) => {
    const out = spawnSync('git', ['rev-parse', '--git-common-dir'], { cwd: dir, encoding: 'utf8' }).stdout?.trim();
    try {
      return out ? fs.realpathSync(path.resolve(dir, out)) : null;
    } catch {
      return null;
    }
  };
  const ca = common(a);
  if (ca && ca === common(b)) return true;
  const oa = originSlug(a).toLowerCase();
  return Boolean(oa) && oa === originSlug(b).toLowerCase();
}

// De waarde van een gh-optie (--base main, -B main, --base=main); null zonder.
function flag(words, long, short) {
  for (let i = 0; i < words.length; i++) {
    if (words[i] === long || words[i] === short) return words[i + 1] ?? '';
    if (words[i].startsWith(`${long}=`)) return words[i].slice(long.length + 1);
  }
  return null;
}

// Mag deze PR naar deze branch? De poort-base (bijv. origin/acceptance) is waar
// gewoon werk heen gaat. Een andere doelbranch (main) is alleen voor de branches
// in pr.promote: standaard de base zelf (de promotie), plus wat de repo noemt,
// zoals een hotfix-branch. Zonder --base kiest gh de default-branch van de
// remote. Geeft een probleem terug, of null.
export function prTargetProblem(top, words) {
  if (!words.includes('pr') || !words.some((w) => w === 'create' || w === 'new')) return null;
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(path.join(top, 'poort.config.json'), 'utf8'));
  } catch {
    return null;
  }
  // origin/x, refs/heads/x, refs/remotes/origin/x en owner:x (een fork) worden x.
  const strip = (b) => String(b || '').replace(/^refs\/(heads|remotes\/origin)\//, '').replace(/^origin\//, '').replace(/^[^/:\s]+:/, '');
  const base = strip(cfg.base);
  if (!base) return null;
  const g = (args) => spawnSync('git', args, { cwd: top, encoding: 'utf8', timeout: 8000 }).stdout?.trim() ?? '';
  const given = flag(words, '--base', '-B');
  // Zonder --base kiest gh de default-branch van de remote: origin/HEAD, en als die
  // lokaal niet gezet is (git remote add in plaats van clone), vraag de remote.
  const remoteHead = () =>
    g(['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']) ||
    (g(['ls-remote', '--symref', 'origin', 'HEAD']).match(/^ref:\s+(\S+)\s+HEAD/m)?.[1] ?? '');
  const target = strip(given ?? remoteHead());
  const head = strip(flag(words, '--head', '-H') ?? g(['rev-parse', '--abbrev-ref', 'HEAD']));
  if (dynamic(given) || dynamic(head)) return `Kan niet lezen naar welke branch deze PR gaat (${given ?? head}). Noem --base en --head letterlijk.`;
  if (!target) return `Kan de default-branch van origin niet bepalen. Geef --base ${base} mee.`;
  if (target === base) return null;
  const promote = cfg.pr?.promote ?? [base];
  if (promote.includes(head)) return null;
  return `Deze PR gaat naar ${target}, vanaf ${head}. Naar ${target} mogen alleen ${promote.join(', ')}; gewoon werk gaat naar ${base}. Gebruik --base ${base}${given === null ? ' (zonder --base kiest gh de default-branch)' : ''}.`;
}

const read = (cwd, f) => {
  try {
    return fs.readFileSync(path.resolve(cwd, f), 'utf8');
  } catch {
    return null;
  }
};

// Een body uit $(cat f), $(< f) of `cat f` leest de hook zelf. Een andere
// substitutie of variabele kan hij niet invullen: dan geen body (null), want
// de letterlijke opdracht is geen PR-beschrijving. De substitutie staat er
// letterlijk in, dus ook met quotes rond het pad: $(cat "b.md").
function bodyValue(value, cwd) {
  const m = value.match(/^\s*(?:\$\(\s*(?:cat\s+|<\s*)(["']?)([^\s$`()"']+)\1\s*\)|`\s*cat\s+(["']?)([^\s$`"']+)\3\s*`)\s*$/);
  if (m) return read(cwd, m[2] ?? m[4]);
  // Een backtick-code-span (`foo`) in een PR-tekst is gewoon tekst. Een $-expansie
  // die de hook niet kan invullen, blijft onbekend.
  return /\$\(|\$\{|\$[A-Za-z_]/.test(value) ? null : value;
}

// --body/-b "<tekst>" of --body-file/-F <pad>; null als het commando geen body meegeeft.
export function bodyFrom(command, words, cwd) {
  // --body "$(cat <<'EOF' ... EOF)": de body staat in de heredoc.
  const here = command.match(/--body(?:=|\s+)"?\$\(\s*cat\s+<<-?\s*['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\s*\1\s*\n?\s*\)/);
  if (here) return here[2];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === '--body' || w === '-b') return bodyValue(words[i + 1] ?? '', cwd);
    if (w.startsWith('--body=')) return bodyValue(w.slice(7), cwd);
    if (w === '--body-file' || w === '-F' || w.startsWith('--body-file=')) {
      const f = w.startsWith('--body-file=') ? w.slice(12) : words[i + 1];
      return !f || f === '-' ? null : read(cwd, f);
    }
  }
  return null;
}

function main() {
  let input = {};
  try {
    input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  } catch {}
  const cursor = typeof input.command === 'string';
  const cmd = cursor ? input.command : input.tool_input?.command || '';

  const allow = () => {
    if (cursor) process.stdout.write(JSON.stringify({ permission: 'allow' }));
    process.exit(0);
  };
  const deny = (problems) => {
    const msg = `PR geblokkeerd door poort.\n${problems.join('\n\n')}`;
    if (cursor) {
      process.stdout.write(JSON.stringify({ permission: 'deny', user_message: msg, agent_message: msg }));
      process.exit(0);
    }
    process.stderr.write(msg + '\n');
    process.exit(2);
  };
  // Geen tekstfilter vooraf: `g'h'` en base64 bevatten het woord gh niet.
  const words = prCommand(cmd);
  if (!words) allow();

  // De repo waar gh draait: `cd ../ander && gh pr create` controleert die andere repo.
  const base = input.cwd || process.cwd();
  const cwd = prCwd(cmd, base);
  if (cwd === null) deny(['Kan niet bepalen in welke map gh draait (cd naar een variabele, cd - of popd). Draai gh vanuit de repo zelf.']);
  const moved = cwd !== base;
  if (moved && !fs.existsSync(cwd)) deny([`De map na cd bestaat niet (${cwd}); poort kan niet bepalen welke repo gh gebruikt.`]);
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', cwd }).stdout?.trim() ?? '';
  if (!top && moved) deny([`De map na cd (${cwd}) is geen git-repo; poort kan niet controleren welke repo gh gebruikt.`]);
  // -R, een gh api-pad of GH_REPO wijst naar een repo. Is dat een andere repo dan
  // de origin van de map waar gh draait, dan valt hier niets te keuren: die repo
  // heeft zijn eigen poort. Een repo die de hook niet kan lezen (-R zonder waarde,
  // een variabele) of een map zonder github-origin om mee te vergelijken blokkeert.
  const repo = targetRepo(cmd, words);
  if (repo !== null && top) {
    const origin = originSlug(top).toLowerCase();
    if (!repo || dynamic(repo) || !origin) {
      deny([`Kan niet bepalen of gh op de gecontroleerde repo draait (${repo || 'leeg'} tegenover origin ${origin || 'onbekend'}). Draai het commando vanuit die repo, zonder -R of GH_REPO.`]);
    }
    if (repo.toLowerCase() !== origin) {
      process.stderr.write(`poort: PR voor ${repo}, niet voor ${origin}; die repo heeft zijn eigen poort, hier niets te keuren.\n`);
      allow();
    }
  }
  const poort = path.join(top, '.poort', 'poort.mjs');
  if (!top || !fs.existsSync(poort)) {
    // Een andere worktree of clone van de repo van deze hook, maar zonder .poort
    // (bijv. omdat .poort/ niet gecommit is): daar kan poort geen bewijs controleren.
    const own = hookRepo();
    if (top && own && fs.realpathSync(top) !== fs.realpathSync(own) && sameRepo(top, own)) {
      deny([`${top} is een worktree of clone van ${own}, maar heeft geen .poort; poort kan daar geen bewijs controleren. Commit .poort/ of draai gh vanuit een worktree met poort.`]);
    }
    allow();
  }

  const problems = [];
  const target = prTargetProblem(top, words);
  if (target) problems.push(target);
  const r = spawnSync('node', [poort, 'verify'], { cwd: top, encoding: 'utf8', env: { ...process.env, ...prefixEnv(cmd) } });
  if (r.status !== 0) problems.push(`Niet elke verplichte check heeft bewijs voor deze commit.\n${r.stdout.trim()}`);

  // PR-beschrijving tegen de diff (checks/pr-body.mjs), als de body in het commando staat.
  const body = bodyFrom(cmd, words, cwd);
  const prBody = path.join(top, '.poort', 'checks', 'pr-body.mjs');
  if (body !== null && fs.existsSync(prBody)) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poort-pr-'));
    const tmp = path.join(dir, 'body.md');
    fs.writeFileSync(tmp, body);
    const b = spawnSync('node', [prBody, '--body-file', tmp], { cwd: top, encoding: 'utf8' });
    fs.rmSync(dir, { recursive: true, force: true });
    if (b.status !== 0) problems.push(`De PR-beschrijving klopt niet met de diff:\n${b.stdout.trim()}`);
  }
  if (!problems.length) allow();
  deny(problems);
}

// Alleen als script; de tests importeren commands/prCommand/bodyFrom.
const isMain = (() => {
  try {
    return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isMain) main();
