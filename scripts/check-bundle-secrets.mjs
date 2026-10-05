#!/usr/bin/env node
/* The exported app bundle holds no server secret (Producto 25A-05). Run by CI after `expo export` in apps/mobile:
   `node ../../scripts/check-bundle-secrets.mjs dist`.

   Expo exports the JavaScript as Hermes bytecode (`.hbc`), which `grep -I` skips as a binary file, so a text grep
   passes without reading the bundle. This reads every exported file as bytes and passes only when it also found a
   string the app is known to contain (the canary): it cannot pass again without reading the bundle. A hit names the
   file and the kind of secret, never the matched value, so a leaked key is not copied into the CI log. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVER_SECRET_NAMES } from './check-repo.mjs';

export const BUNDLE_SECRETS = [
  { name: 'a server-only secret variable name', re: SERVER_SECRET_NAMES },
  { name: 'a Supabase secret key', re: /sb_secret_[A-Za-z0-9_-]{8,}/ },
  // sk-proj-, sk-svcacct-, sk-admin- (OpenAI) and sk-ant- (Anthropic), not the end of a word such as «task-».
  { name: 'a provider API key', re: /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}/ },
];
/** A catalogue key of the integration client (apps/mobile/src/integrations/client.ts), present in every export. */
export const CANARY = 'assistant.integration.signIn';

/** files: [{ path, bytes }]. Bytes are read as latin1, one character per byte, so binary files are searched too. */
export function scanBundle(files) {
  const hits = [];
  let canary = false;
  for (const { path, bytes } of files) {
    const text = Buffer.from(bytes).toString('latin1');
    if (text.includes(CANARY)) canary = true;
    for (const { name, re } of BUNDLE_SECRETS) if (re.test(text)) hits.push({ path, name });
  }
  return { hits, canary, files: files.length };
}

export function scanDirectory(dir) {
  const files = readdirSync(dir, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile())
    .map(entry => { const path = join(entry.parentPath, entry.name); return { path, bytes: readFileSync(path) }; });
  return scanBundle(files);
}

/** The lines to print; empty when the bundle passes. */
export function problems({ hits, canary, files }) {
  const lines = hits.map(hit => `${hit.path}: ${hit.name}`);
  if (!files || !canary) lines.push(`The scan did not read the app bundle (${files} files; «${CANARY}» not found).`);
  return lines;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const lines = problems(scanDirectory(process.argv[2] ?? 'dist'));
  for (const line of lines) console.error(line);
  if (lines.length) process.exitCode = 1;
  else console.log('The exported bundle names no server secret.');
}
