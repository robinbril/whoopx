#!/usr/bin/env node
// Geen sleutels in git: een gelekte sleutel krijg je niet meer uit de historie,
// alleen nog ingetrokken. Draait in de commit-hook op de gestagede bestanden, in
// milliseconden en zonder tool, zodat hij in elke repo verplicht kan zijn.
//
// Rood bij een bestand dat zelf een geheim is (.env, een private key) en bij een
// regel die op een bekend sleutelformaat past. Alleen formaten met een vaste
// vorm, geen gok op "password = ...": een vals alarm leert mensen hem te
// omzeilen. Een bewuste uitzondering (een testsleutel, een voorbeeld) krijgt op
// dezelfde regel `pragma: allowlist secret`.
//
//   node secrets.mjs {files}
import fs from 'node:fs';
import path from 'node:path';

const SECRET_FILE = /(^|\/)(\.env(\.[^/]*)?|id_(rsa|dsa|ecdsa|ed25519)|[^/]*\.(pem|p12|pfx|key))$/;
const EXAMPLE_FILE = /\.(example|sample|template|dist)$|(^|\/)\.env\.(example|sample|template)$/;
const FORMATS = [
  ['private key', /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY( BLOCK)?-----/],
  ['AWS-sleutel', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['GitHub-token', /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/],
  ['Slack-token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Anthropic-sleutel', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI-sleutel', /\bsk-(?!ant-)(proj-)?[A-Za-z0-9_-]{32,}/],
  ['Google-sleutel', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Stripe-sleutel', /\b(sk|rk)_live_[0-9A-Za-z]{20,}/],
];
const ALLOW = /pragma: allowlist secret/;

const found = [];
for (const file of process.argv.slice(2)) {
  const rel = file.split(path.sep).join('/');
  if (SECRET_FILE.test(rel) && !EXAMPLE_FILE.test(rel)) {
    found.push(`${rel}: dit bestand is zelf een geheim; zet het in .gitignore`);
    continue;
  }
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    continue; // verwijderd of geen leesbaar bestand
  }
  if (text.includes('\0')) continue; // binair
  text.split('\n').forEach((line, i) => {
    if (ALLOW.test(line)) return;
    for (const [name, re] of FORMATS) if (re.test(line)) found.push(`${rel}:${i + 1}: ${name}`);
  });
}
for (const f of found) console.log(f);
if (found.length) {
  console.log('Haal de sleutel weg en trek hem in. Een testwaarde of voorbeeld: zet `pragma: allowlist secret` op die regel.');
  process.exit(1);
}
