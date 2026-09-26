#!/usr/bin/env node
/* Repository hygiene check. No dependencies. Run by `npm run check:repo` and CI.

   Fails when git tracks:
   1. generated or local files (node_modules, dist, .expo, generated native projects, .env, binaries, databases);
   2. the legacy web/Capacitor frontend retired by Producto 24REP (recover it from the tag
      `web-frontend-final`, never from a copy in the working tree);
   3. an obvious secret, backup or sensitive configuration (private keys, service credentials,
      provider tokens, a real FinanzApp backup);
   or when a native or backend source file imports from a retired path. */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const GENERATED = [
  /(^|\/)(node_modules|dist|\.vite|\.expo|\.playwright-mcp)\//,
  /(^|\/)\.env(?:\.(?!example$).*)?$/,
  /^apps\/mobile\/(ios|android)\//,
  /\.(ipa|apk|aab|p12|p8|mobileprovision|keystore|jks|sqlite(?:-shm|-wal)?)$/,
];

/* The web-only trees retired by Producto 24REP (decision 004), plus an archive folder. `src/` at the root was the web's source; the product's source is
   apps/mobile, packages/ and server/. */
export const LEGACY_WEB = [
  /^(index\.html|support\.js|capacitor\.config\.(ts|js|json)|SUPABASE_SETUP\.md|RELEASE_NOTES\.md)$/,
  /^(src|public|ios|android|design-reference|archive|dist)\//,
  /^api\/(?!mobile\/)/,
  /^scripts\/build-(app-shell|domain|capacitor-bridge)\.mjs$/,
  /^docs\/(production-release-checklist|mobile-install-qa|offline-data-guarantees|capacitor-ios-spike)\.md$/,
];

export const SENSITIVE_FILES = [
  /(^|\/)(credentials|service-account|serviceAccount)[^/]*\.json$/i,
  /(^|\/)(google-services\.json|GoogleService-Info\.plist)$/,
  /\.(pem|key|pfx|cer|crt|der|kdbx)$/,
  /(^|\/)(\.npmrc|\.netrc|\.pgpass|id_(rsa|ed25519|ecdsa)(\.pub)?)$/,
  /(^|\/)finanzapp[^/]*(backup|respaldo|copia)[^/]*\.json$/i,
  /(^|\/)(backup|respaldo)s?\/.*\.(json|sqlite|csv)$/i,
];

/* Content patterns of well-known credential shapes. Test fixtures use obviously fake values
   ("fixture-only", short tokens); anything matching these is real enough to fail. */
export const SECRET_PATTERNS = [
  { name: 'private key block', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/ },
  { name: 'OpenAI API key', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/ },
  { name: 'Anthropic API key', re: /\bsk-ant-[A-Za-z0-9_-]{32,}\b/ },
  { name: 'GitHub token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/ },
  { name: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { name: 'Supabase secret key', re: /\bsb_secret_[A-Za-z0-9_-]{20,}\b|\bsbp_[a-f0-9]{40}\b/ },
  { name: 'Expo access token', re: /\bEXPO_TOKEN\s*[:=]\s*['"]?[A-Za-z0-9_-]{20,}/ },
  { name: 'Postgres URL with password', re: /\bpostgres(?:ql)?:\/\/[^\s:'"/]+:[^\s@'"]{8,}@[^\s'"]+/ },
  { name: 'signed JWT', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}\b/ },
];

/* Source trees of the product whose imports may not reach a retired path. */
export const SOURCE_TREES = /^(apps\/mobile\/(app|src|tests|scripts|[^/]+\.(ts|js|mjs))|packages\/|server\/|api\/mobile\/)/;
export const SOURCE_FILE = /\.(ts|tsx|js|mjs|cjs|jsx)$/;
export const RETIRED_IMPORTS = [
  { name: 'the legacy web source (src/)', re: /(?:from\s*|import\s*\(?\s*|require\s*\(\s*)['"](?:\.\.\/)+src\/(?:domain|app|capacitor)\//g },
  { name: 'the legacy web source (src/) through a bare path', re: /['"](?:\.\/)?src\/(?:domain|app|capacitor)\/[^'"]*['"]/g },
  { name: 'the web runtime (support.js) or the Design Components document', re: /['"][^'"]*(?:\/|^)support\.js['"]|window\.FinanzDomain|window\.FinanzNativeSpeech/g },
  { name: 'the market-data proxies (api/chart, api/fund-data)', re: /['"][^'"]*(?:api\/chart|api\/fund-data|\/api\/chart\?|\/api\/fund-data\?)[^'"]*['"]/g },
  { name: 'Capacitor', re: /['"]@capacitor(?:-community)?\/[^'"]*['"]/g },
];

const TEXT_LIMIT = 2 * 1024 * 1024;
const SKIP_CONTENT = /(^|\/)package-lock\.json$|\.(png|jpg|jpeg|gif|webp|ico|pdf|ttf|otf|woff2?|zip|gz)$/;

export function trackedFiles(cwd) {
  return execSync('git ls-files -z', { cwd, encoding: 'utf8' }).split('\0').map(s => s.trim()).filter(Boolean);
}

export function findImportOffenders(file, text) {
  const hits = [];
  for (const { name, re } of RETIRED_IMPORTS) {
    re.lastIndex = 0;
    const match = re.exec(text);
    if (match) hits.push({ file, name, line: text.slice(0, match.index).split('\n').length, sample: match[0] });
  }
  return hits;
}

export function findSecretOffenders(file, text) {
  const hits = [];
  for (const { name, re } of SECRET_PATTERNS) {
    const match = re.exec(text);
    if (match) hits.push({ file, name, line: text.slice(0, match.index).split('\n').length });
  }
  return hits;
}

export function audit(files, read) {
  const generated = files.filter(f => GENERATED.some(re => re.test(f)));
  const legacy = files.filter(f => LEGACY_WEB.some(re => re.test(f)));
  const sensitive = files.filter(f => SENSITIVE_FILES.some(re => re.test(f)));
  const imports = [];
  const secrets = [];
  for (const file of files) {
    if (SKIP_CONTENT.test(file)) continue;
    const text = read(file);
    if (text === null) continue;
    if (SOURCE_TREES.test(file) && SOURCE_FILE.test(file)) imports.push(...findImportOffenders(file, text));
    secrets.push(...findSecretOffenders(file, text));
  }
  return { generated, legacy, sensitive, imports, secrets };
}

function readTracked(cwd) {
  return file => {
    const path = cwd + '/' + file;
    if (!existsSync(path)) return null;
    const stat = statSync(path);
    if (!stat.isFile() || stat.size > TEXT_LIMIT) return null;
    const buffer = readFileSync(path);
    if (buffer.subarray(0, 8000).includes(0)) return null;
    return buffer.toString('utf8');
  };
}

export function report(result) {
  const lines = [];
  const section = (title, items, format) => { if (items.length) { lines.push(title); items.forEach(item => lines.push('  - ' + format(item))); } };
  section('generated or local files are tracked (untrack them: git rm -r --cached <path>):', result.generated, f => f);
  section('the retired web/Capacitor frontend is back in the tree (its history is the tag web-frontend-final; do not restore it):', result.legacy, f => f);
  section('a sensitive file is tracked (this repository is public; remove it and rotate anything it held):', result.sensitive, f => f);
  section('a product source file imports from a retired path:', result.imports, h => `${h.file}:${h.line} → ${h.name} (${h.sample})`);
  section('a tracked file contains what looks like a credential:', result.secrets, h => `${h.file}:${h.line} → ${h.name}`);
  return lines;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cwd = process.cwd();
  let files;
  try { files = trackedFiles(cwd); } catch (e) { console.error('check:repo — unable to run "git ls-files":', e.message); process.exit(1); }
  const lines = report(audit(files, readTracked(cwd)));
  if (lines.length) { console.error('check:repo — FAIL'); lines.forEach(l => console.error(l)); process.exit(1); }
  console.log(`check:repo — OK: ${files.length} tracked files; no generated files, no legacy web tree, no imports from retired paths, no secrets.`);
}
