#!/usr/bin/env node
// Geen sleutels in git: een gelekte sleutel krijg je niet meer uit de historie,
// alleen nog ingetrokken. Draait in de commit-hook op de gestagede bestanden, in
// milliseconden en zonder tool, zodat hij in elke repo verplicht kan zijn.
//
// Rood bij een bestand dat zelf een geheim is (.env en elk .env.* behalve
// .env.example, .sample, .template, .development en .test; een .key of
// sleutelkluis) en bij een regel die op een bekend sleutelformaat past. Alleen
// formaten met een vaste vorm, geen gok op "password = ...": een vals alarm leert
// mensen hem te omzeilen. Een .pem of .crt met alleen een publiek certificaat is
// geen geheim; een private key erin wel.
//
// Uitzonderingen: `pragma: allowlist secret` op dezelfde regel, of in de config
// `--allow <pad of glob>` (herhaalbaar), bijvoorbeeld tests/fixtures/**: dat
// bestand of die bestanden scant hij niet.
//
//   node secrets.mjs [--allow <pad of glob>]... {files}
import fs from 'node:fs';
import path from 'node:path';

// Elk .env-bestand is een geheim, behalve deze vaste lijst (en hun .local-vorm wel).
const SECRET_FILE = /(^|\/)(\.env(\.[^/]+)?|id_(rsa|dsa|ecdsa|ed25519)|[^/]*\.(key|p12|pfx|jks|keystore))$/;
const NOT_SECRET = /(^|\/)\.env\.(example|sample|template|development|test)$/;
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|::1|host\.docker\.internal)(:\d+)?$/;
const PLACEHOLDER = /^(\$|\{|<|\*+$|x+$|password$|pass$|passwd$|secret$|changeme$|example$|test$|postgres$|root$|admin$)/i;

// Een JWT met role service_role (Supabase): die omzeilt elke rij-beveiliging.
function serviceJwt(line) {
  for (const m of line.matchAll(/\beyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)) {
    try {
      const payload = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
      if (payload.role === 'service_role') return true;
    } catch {}
  }
  return false;
}

// Een database-URL met een echt wachtwoord naar een host die niet lokaal is.
function dbPassword(line) {
  for (const m of line.matchAll(/\b(postgres(ql)?|mysql|mariadb|mongodb(\+srv)?|redis|amqp):\/\/([^:\s/@'"]+):([^@\s/'"]+)@([^/\s'"?]+)/g)) {
    const [, , , , user, pass, host] = m;
    if (!LOCAL_HOST.test(host) && !PLACEHOLDER.test(pass) && pass !== user) return true;
  }
  return false;
}

const FORMATS = [
  ['private key', (l) => /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY( BLOCK)?-----/.test(l)],
  ['AWS-sleutel', (l) => /\b(AKIA|ASIA)[0-9A-Z]{16}\b/.test(l)],
  ['GitHub-token', (l) => /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/.test(l)],
  ['GitLab-token', (l) => /\bglpat-[A-Za-z0-9_-]{20,}/.test(l)],
  ['Slack-token', (l) => /\bxox[abprs]-[A-Za-z0-9-]{10,}/.test(l)],
  ['Slack-webhook', (l) => /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]{20,}/.test(l)],
  ['SendGrid-sleutel', (l) => /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/.test(l)],
  ['Anthropic-sleutel', (l) => /\bsk-ant-[A-Za-z0-9_-]{20,}/.test(l)],
  ['OpenAI-sleutel', (l) => /\bsk-(?!ant-)(proj-)?[A-Za-z0-9_-]{32,}/.test(l)],
  ['Google-sleutel', (l) => /\bAIza[0-9A-Za-z_-]{35}\b/.test(l)],
  ['Stripe-sleutel', (l) => /\b(sk|rk)_live_[0-9A-Za-z]{20,}/.test(l)],
  ['service_role-JWT', serviceJwt],
  ['wachtwoord in een database-URL', dbPassword],
];
const PRAGMA = /pragma: allowlist secret/;
const MAX_BYTES = 2 * 1024 * 1024;

// --allow: een heel repo-pad of een glob (* binnen een map, ** over mappen, ?).
// Nooit een los woord dat ergens in een pad of regel past.
const globRe = (g) =>
  new RegExp(
    `^${g
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*\//g, '\u0001') // **/ = nul of meer hele mappen
      .replace(/\*\*/g, '\u0000') // ** aan het eind = alles daaronder
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')
      .replaceAll('\u0001', '(?:[^/]+/)*')
      .replaceAll('\u0000', '.*')}$`,
  );
const allow = [];
const files = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--allow') allow.push(globRe(argv[++i]));
  else files.push(argv[i]);
}
const allowed = (rel) => allow.some((re) => re.test(rel));

// Eerst de kop: een binair bestand of een bestand boven 2 MB lezen we niet helemaal.
function readText(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const head = Buffer.alloc(8192);
    const n = fs.readSync(fd, head, 0, head.length, 0);
    if (head.subarray(0, n).includes(0)) return null;
    if (fs.fstatSync(fd).size > MAX_BYTES) {
      console.log(`poort:warn ${file}: niet gescand, groter dan 2 MB`);
      return null;
    }
    return fs.readFileSync(fd, 'utf8');
  } catch {
    return null; // verwijderd of onleesbaar
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

const found = [];
for (const file of files) {
  const rel = file.split(path.sep).join('/');
  if (allowed(rel)) continue;
  if (SECRET_FILE.test(rel) && !NOT_SECRET.test(rel)) {
    found.push(`${rel}: dit bestand is zelf een geheim; zet het in .gitignore`);
    continue;
  }
  const text = readText(file);
  if (text === null) continue;
  text.split('\n').forEach((line, i) => {
    if (PRAGMA.test(line)) return;
    for (const [name, hit] of FORMATS) if (hit(line)) found.push(`${rel}:${i + 1}: ${name}`);
  });
}
for (const f of found) console.log(f);
if (found.length) {
  console.log('Haal de sleutel weg en trek hem in. Een testwaarde of voorbeeld: `pragma: allowlist secret` op die regel, of --allow <pad of glob> in de check.');
  process.exit(1);
}
