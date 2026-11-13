// GitHub-workflows lezen, zonder YAML-dependency: de subset die workflows
// gebruiken (mappings, lijsten met `- `, blokscalars | en >, inline [a, b]).
// Gedeeld door ci-job (een job lokaal draaien) en ci-parity (welke CI-jobs
// lokaal gedekt zijn).
import fs from 'node:fs';
import path from 'node:path';

export const indentOf = (l) => l.match(/^ */)[0].length;
export const unquote = (v) => {
  const s = v.trim();
  const q = s.match(/^(["'])(.*)\1\s*(#.*)?$/);
  return q ? q[2] : s.replace(/\s+#.*$/, '');
};

// Eén vorm voor de parser: \n als regeleinde, zonder documentmarkering (---, ...).
export const normalize = (text) =>
  String(text)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => !/^(---|\.\.\.)\s*(#.*)?$/.test(l))
    .join('\n');

// Lees `key: value` en blokscalars (| en >) vanaf regel i binnen een blok met
// een vaste inspringing. Een sleutel met een lijst eronder geeft de ruwe regels.
// Geeft { map, end } terug.
export function readMap(ls, start, ind) {
  const map = {};
  let i = start;
  while (i < ls.length) {
    const l = ls[i];
    if (!l.trim() || l.trim().startsWith('#')) {
      i++;
      continue;
    }
    if (indentOf(l) < ind) break;
    if (indentOf(l) > ind) {
      i++;
      continue;
    }
    const m = l.slice(ind).match(/^(["']?)([\w.-]+)\1:\s*(.*)$/);
    if (!m) break;
    const [, , key, rest] = m;
    i++;
    if (/^[|>][-+]?\s*$/.test(rest)) {
      const body = [];
      while (i < ls.length && (!ls[i].trim() || indentOf(ls[i]) > ind)) body.push(ls[i++]);
      while (body.length && !body[body.length - 1].trim()) body.pop();
      const min = Math.min(...body.filter((b) => b.trim()).map(indentOf));
      const text = body.map((b) => b.slice(Math.min(min, indentOf(b)))).join('\n');
      map[key] = rest.startsWith('>') ? text.replace(/\n(?!\n)/g, ' ') : text + '\n';
    } else if (rest === '' || rest.startsWith('#')) {
      const sub = [];
      // Een lijst mag op dezelfde inspringing als zijn sleutel staan (`steps:` en
      // daaronder `- run: x` zonder extra spaties); die regels horen bij de sleutel.
      const belongs = (l) => !l.trim() || indentOf(l) > ind || (indentOf(l) === ind && /^\s*- /.test(l));
      while (i < ls.length && belongs(ls[i])) sub.push(ls[i++]);
      const subInd = Math.min(...sub.filter((s) => s.trim()).map(indentOf));
      map[key] = sub.some((s) => s.trim().startsWith('- ')) ? sub : readMap(sub, 0, subInd).map;
    } else map[key] = unquote(rest);
  }
  return { map, end: i };
}

// Ruwe regels (zoals readMap ze geeft voor een sleutel met ergens een lijst eronder)
// als mapping lezen; null als het zelf een lijst is.
export function asMap(v) {
  if (!Array.isArray(v)) return v && typeof v === 'object' ? v : null;
  const real = v.filter((l) => l.trim() && !l.trim().startsWith('#'));
  if (!real.length) return {};
  const ind = Math.min(...real.map(indentOf));
  if (real.find((l) => indentOf(l) === ind).trim().startsWith('- ')) return null;
  return readMap(v, 0, ind).map;
}

// Stappen die alleen de runner klaarzetten: checkout, cache, en de setup-actions van
// GitHub en bekende toolchains. ci-job slaat ze over: lokaal staan de werkboom en de
// tool er al. Een lijst, geen patroon: ankane/setup-postgres start een database.
export const SETUP =
  /^(actions\/(checkout|cache|setup-[\w.-]+)|astral-sh\/setup-uv|pnpm\/action-setup|oven-sh\/setup-bun|denoland\/setup-deno|dtolnay\/rust-toolchain|actions-rust-lang\/setup-rust-toolchain|ruby\/setup-ruby|extractions\/setup-just|pdm-project\/setup-pdm|snok\/install-poetry)@/;

// Namen uit `[a, b]`, `{ a: x, b: { y } }` (de sleutels), `a` of de ruwe regels
// van een lijst (`- a`).
export function names(v) {
  if (Array.isArray(v)) {
    const items = v.filter((l) => l.trim().startsWith('- '));
    const ind = Math.min(...items.map(indentOf));
    return items.filter((l) => indentOf(l) === ind).map((l) => unquote(l.trim().slice(2)));
  }
  if (typeof v !== 'string' || !v) return [];
  const s = v.trim();
  if (s.startsWith('{')) {
    const keys = [];
    let depth = 0;
    let part = '';
    for (const ch of s.slice(1, -1) + ',') {
      if ('{['.includes(ch)) depth++;
      if ('}]'.includes(ch)) depth--;
      if (ch === ',' && depth === 0) {
        const k = part.split(':')[0];
        if (k.trim()) keys.push(unquote(k));
        part = '';
      } else part += ch;
    }
    return keys;
  }
  return (s.startsWith('[') ? s.slice(1, -1).split(',') : [s]).map(unquote).filter(Boolean);
}

// De triggers van een workflow: `on: push`, `on: [push, pull_request]` of een
// mapping. YAML 1.1 leest een kale `on` als true; workflows schrijven soms "on".
export function triggers(text) {
  const ls = normalize(text).split('\n');
  const { map } = readMap(ls, 0, 0);
  const on = map.on ?? map.true;
  if (on && typeof on === 'object' && !Array.isArray(on)) return Object.keys(on);
  // Een mapping met ergens een lijst eronder (branches: - main) komt als ruwe regels.
  if (Array.isArray(on)) {
    const real = on.filter((l) => l.trim() && !l.trim().startsWith('#'));
    const ind = Math.min(...real.map(indentOf));
    const top = real.filter((l) => indentOf(l) === ind);
    if (!top.every((l) => l.trim().startsWith('- '))) return top.map((l) => l.trim().match(/^(["']?)([\w-]+)\1:/)?.[2]).filter(Boolean);
  }
  return names(on);
}

// Het filter op `on.push`: { branches, tags, ignore } of null zonder push-trigger.
// ignore: branches-ignore of tags-ignore, dan draait hij ook op andere branches.
export function pushFilter(text) {
  const { map } = readMap(normalize(text).split('\n'), 0, 0);
  const raw = map.on ?? map.true;
  const on = asMap(raw);
  if (!on) return names(raw).includes('push') ? { branches: [], tags: [], ignore: false } : null;
  if (!('push' in on)) return null;
  const p = asMap(on.push) || {};
  return { branches: names(p.branches), tags: names(p.tags), ignore: Boolean(p['branches-ignore'] || p['tags-ignore']) };
}

// strategy.matrix: { axes: { os: [...], ... } } of { unreadable: reden }.
// include, exclude en een matrix uit een expressie kunnen we niet naspelen.
function parseMatrix(strategy) {
  const m = asMap(asMap(strategy)?.matrix);
  if (!m) return { unreadable: 'matrix uit een expressie of lijst' };
  const keys = Object.keys(m);
  if (keys.some((k) => k === 'include' || k === 'exclude')) return { unreadable: 'matrix met include/exclude' };
  const axes = Object.fromEntries(keys.map((k) => [k, names(m[k])]));
  if (!keys.length || Object.values(axes).some((v) => !v.length || v.some((x) => x.includes('${{')))) return { unreadable: 'matrix niet te lezen' };
  return { axes };
}

// Eén variant van de matrix die hier kan draaien: het OS van deze machine (op een
// Mac anders ubuntu), de lokale Python- of Node-versie als die in de matrix staat,
// anders de eerste. null als de matrix dit OS niet heeft (alleen windows).
export function pickMatrix(axes, local = {}) {
  const os = local.platform === 'darwin' ? /mac/i : local.platform === 'win32' ? /windows/i : /ubuntu|linux/i;
  const pick = {};
  for (const [k, vals] of Object.entries(axes)) {
    if (/^(os|runner|runs-on|platform)$/i.test(k)) {
      const v = vals.find((x) => os.test(x)) ?? (local.platform === 'darwin' ? vals.find((x) => /ubuntu|linux/i.test(x)) : undefined);
      if (v === undefined) return null;
      pick[k] = v;
    } else if (/python/i.test(k) && local.python) {
      const [maj, min] = local.python.split('.');
      pick[k] = vals.find((x) => x === `${maj}.${min}` || x === `${maj}.x`) ?? vals[0];
    }
    else if (/node/i.test(k) && local.node) pick[k] = vals.find((x) => String(x).split('.')[0] === local.node) ?? vals[0];
    else pick[k] = vals[0];
  }
  return pick;
}

// Draait deze job pas na een merge? Een `if:` op een vaste branch of een tag,
// zonder ||: dan doet hij niets op een PR of een feature-branch.
// here: de branch die je nu pusht; een job op precies die branch draait wél.
export function jobAfterMerge(job, here) {
  const cond = String(job.if || '');
  // || of een ontkenning (!startsWith, !=): dan draait hij ook op een PR.
  if (!cond || cond.includes('||') || cond.includes('!')) return false;
  if (/startsWith\(\s*github\.ref\s*,\s*'refs\/tags\//.test(cond) || /github\.ref\s*==\s*'refs\/tags\//.test(cond)) return true;
  const b = cond.match(/github\.ref\s*==\s*'refs\/heads\/([^']+)'|github\.ref_name\s*==\s*'([^']+)'/);
  return Boolean(b) && (b[1] || b[2]) !== here;
}

// Draait deze workflow alleen na een merge? Geen PR-trigger, en push alleen op
// vaste branches (zonder wildcard) die niet de branch zijn die je nu pusht, of
// alleen op tags.
export function workflowAfterMerge(w, here) {
  if (!w.on.includes('push') || w.on.some((t) => /^(pull_request|pull_request_target|merge_group)$/.test(t))) return false;
  const p = w.push;
  if (!p || p.ignore) return false;
  if (p.branches.length) return !p.branches.some((b) => /[*?![]/.test(b)) && !p.branches.includes(here);
  return p.tags.length > 0;
}

function jobBlocks(text) {
  const ls = normalize(text).split('\n');
  const jobsAt = ls.findIndex((l) => /^jobs:\s*(#.*)?$/.test(l));
  if (jobsAt < 0) return [];
  const first = ls.slice(jobsAt + 1).find((l) => l.trim() && !l.trim().startsWith('#'));
  const jobInd = first ? indentOf(first) : 2;
  const out = [];
  for (let at = jobsAt + 1; at < ls.length; at++) {
    const l = ls[at];
    if (l.trim() && !l.trim().startsWith('#') && indentOf(l) < jobInd) break;
    const m = indentOf(l) === jobInd && l.trim().match(/^(["']?)([\w-]+)\1:\s*(#.*)?$/);
    if (!m) continue;
    let end = at + 1;
    while (end < ls.length && (!ls[end].trim() || indentOf(ls[end]) > jobInd)) end++;
    out.push({ id: m[2], block: ls.slice(at + 1, end) });
    at = end - 1;
  }
  return out;
}

function parseJob(id, block) {
  const bodyInd = Math.min(...block.filter((l) => l.trim()).map(indentOf));
  const { map: job } = readMap(block, 0, bodyInd);
  const steps = [];
  const raw = Array.isArray(job.steps) ? job.steps : [];
  const itemInd = Math.min(...raw.filter((l) => l.trim().startsWith('- ')).map(indentOf));
  let cur = null;
  for (const l of raw) {
    if (indentOf(l) === itemInd && l.trim().startsWith('- ')) {
      if (cur) steps.push(cur);
      cur = [' '.repeat(itemInd + 2) + l.trim().slice(2)];
    } else if (cur) cur.push(l);
  }
  if (cur) steps.push(cur);
  return {
    id,
    name: typeof job.name === 'string' ? job.name : id,
    if: job.if,
    uses: typeof job.uses === 'string' ? job.uses : null,
    needs: names(job.needs),
    matrix: job.strategy ? parseMatrix(job.strategy) : null,
    // Services, een container of secrets: dan kan ci-job hem lokaal niet naspelen.
    static: !job.services && !job.container && !job.uses && !block.some((l) => /\$\{\{\s*secrets\./.test(l)),
    env: job.env || {},
    defaults: job.defaults || {},
    steps: steps.map((s) => readMap(s, 0, itemInd + 2).map),
    // De job zoals hij er staat (zonder commentaar en lege regels): is hij veranderd?
    source: block.filter((l) => l.trim() && !l.trim().startsWith('#')).map((l) => l.trimEnd()).join('\n'),
  };
}

export function readJob(text, name) {
  const b = jobBlocks(text).find((j) => j.id === name);
  return b ? parseJob(b.id, b.block) : null;
}

export const readJobs = (text) => jobBlocks(text).map((b) => parseJob(b.id, b.block));

// De naam van een stap zoals GitHub hem toont: name, anders "Run <eerste regel>".
export const stepLabel = (s) => s.name || (s.uses ? `Run ${s.uses}` : `Run ${String(s.run || '').split('\n')[0].trim()}`);

// Alle workflows van de repo: [{ file: 'ci.yml', text, on: [...], push, jobs: [...] }].
export function workflows(top) {
  const dir = path.join(top, '.github', 'workflows');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort()
    .map((file) => {
      const text = fs.readFileSync(path.join(dir, file), 'utf8');
      return { file, text, on: triggers(text), push: pushFilter(text), jobs: readJobs(text) };
    });
}
