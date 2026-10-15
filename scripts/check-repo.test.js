import { describe, it, expect } from 'vitest';
import { audit, report, LEGACY_WEB, GENERATED, SENSITIVE_FILES, BACKUP_HEADER } from './check-repo.mjs';

const clean = {
  'apps/mobile/src/ui/theme.ts': "import { todayKey } from '@finanzapp/domain';\n",
  'apps/mobile/tests/assistant.node.ts': "import { x } from '../../../packages/integrations/contracts.js';\n",
  'packages/domain/index.ts': "export * from './dates.ts';\n",
  'server/mobile/handlers.js': "import { validate } from '../../packages/integrations/contracts.js';\n",
  'api/mobile/assistant.js': "import { createMobileHandler } from '../../server/mobile/handlers.js';\n",
  'server/mobile/schema.test.sql': "-- POSTGRES_PASSWORD: fixture-only\n",
  'docs/decisions/004-native-first-and-web-retirement.md': "`git show web-frontend-final:src/domain/dates.js` recovers the module.\n",
  'apps/mobile/eas.json': '{ "build": { "development": {} } }\n',
  'LICENSES/Unicode-3.0.txt': 'UNICODE LICENSE V3\n',
};
const run = files => audit(Object.keys(files), f => files[f]);

describe('check:repo', () => {
  it('accepts the product tree, including docs that mention the retired paths in prose', () => {
    const result = run(clean);
    expect(report(result)).toEqual([]);
  });

  it('fails when the legacy web frontend reappears, in place or as an archive copy', () => {
    for (const path of ['index.html', 'support.js', 'capacitor.config.ts', 'public/sw.js', 'ios/App/Podfile', 'src/app/component.js',
      'src/domain/dates.js', 'src/capacitor/deepLinks.js', 'api/chart.js', 'api/fund-data.test.js', 'design-reference/support.js',
      'scripts/build-app-shell.mjs', 'archive/web/index.html', 'SUPABASE_SETUP.md', 'docs/offline-data-guarantees.md']) {
      expect(LEGACY_WEB.some(re => re.test(path)), path).toBe(true);
    }
    for (const path of ['api/mobile/assistant.js', 'apps/mobile/src/storage/database.ts', 'scripts/check-repo.mjs', 'docs/mobile-roadmap-history.md',
      'packages/domain/dates.ts', 'server/mobile/schema.sql', 'apps/mobile/ios-placeholder.md']) {
      expect(LEGACY_WEB.some(re => re.test(path)), path).toBe(false);
    }
    expect(run({ ...clean, 'src/domain/dates.js': 'export const x = 1;\n' }).legacy).toEqual(['src/domain/dates.js']);
  });

  it('fails when a product source imports from a retired path, whatever the spelling', () => {
    const cases = {
      'packages/domain/index.ts': "export { todayKey } from '../../src/domain/dates.js';\n",
      'apps/mobile/src/ui/x.ts': "import shell from '../../../src/app/component.js';\n",
      'server/mobile/runtime.js': "const bridge = await import('../../src/capacitor/deepLinks.js');\n",
      'apps/mobile/src/integrations/client.ts': "const url = origin + '/api/chart?range=1d';\n",
      'apps/mobile/src/speech.ts': "import { SpeechRecognition } from '@capacitor-community/speech-recognition';\n",
      'apps/mobile/src/legacy.ts': "const domain = window.FinanzDomain.todayKey();\n",
    };
    for (const [file, text] of Object.entries(cases)) {
      const result = run({ ...clean, [file]: text });
      expect(result.imports.map(h => h.file), text).toEqual([file]);
    }
  });

  it('does not treat prose or non-product files as imports', () => {
    const result = run({ ...clean,
      'docs/decisions/004-native-first-and-web-retirement.md': "The retirement removed `src/app`, `support.js` and `window.FinanzDomain`.\n",
      'scripts/check-repo.mjs': "const RE = /src\\/domain/; // 'src/domain/'\n" });
    expect(result.imports).toEqual([]);
  });

  it('fails when a server secret is named in the app or a secret-like value is made public (25A-05)', () => {
    // Assembled at run time so this file never contains one (the guard scans it too).
    const server = ['MOBILE', 'AI', 'API', 'KEY'].join('_');
    const exposed = ['EXPO', 'PUBLIC', 'OPENAI', 'API', 'KEY'].join('_');
    const secrets = run({ ...clean,
      'apps/mobile/src/assistant/runtime.ts': `const key = process.env.${server};\n`,
      'apps/mobile/app.config.ts': `extra: { key: process.env.${exposed} }\n`,
      'server/mobile/runtime.js': `const key = env.${server};\n`,
      'apps/mobile/src/session.ts': `const url = process.env.${['EXPO', 'PUBLIC', 'SUPABASE', 'PUBLISHABLE', 'KEY'].join('_')};\n` }).secrets;
    expect(secrets.map(h => h.file).sort()).toEqual(['apps/mobile/app.config.ts', 'apps/mobile/src/assistant/runtime.ts']);
  });

  it('fails when the app names the reconciliation admin key or a staging probe password (25A-06)', () => {
    for (const name of [['OPENAI', 'ADMIN', 'KEY'], ['STAGING', 'PROBE', 'A', 'PASSWORD']].map(parts => parts.join('_'))) {
      expect(run({ ...clean, 'apps/mobile/src/x.ts': `const v = process.env.${name};\n` }).secrets.map(h => h.file), name).toEqual(['apps/mobile/src/x.ts']);
    }
  });

  it('fails on generated files, native projects and databases', () => {
    for (const path of ['node_modules/x/index.js', 'dist/index.html', 'apps/mobile/ios/Podfile', 'apps/mobile/android/build.gradle', '.env', '.env.production',
      'apps/mobile/.expo/settings.json', 'data/ledger.sqlite', 'ledger.sqlite-wal', 'build.ipa', 'release.keystore']) {
      expect(GENERATED.some(re => re.test(path)), path).toBe(true);
    }
    expect(GENERATED.some(re => re.test('.env.example'))).toBe(false);
  });

  it('fails on sensitive files and on credential-shaped content, but not on fixtures', () => {
    for (const path of ['credentials.json', 'apps/mobile/google-services.json', 'apps/mobile/GoogleService-Info.plist', 'certs/dev.pem', 'signing.key',
      '.npmrc', 'finanzapp-backup-2026-09-25.json', 'backups/ledger.json', 'respaldo/finanzapp.sqlite']) {
      expect(SENSITIVE_FILES.some(re => re.test(path)), path).toBe(true);
    }
    expect(SENSITIVE_FILES.some(re => re.test('apps/mobile/tests/fixtures/backup-v8.json'))).toBe(false);
    // The shapes are assembled at run time so this file never contains one (the guard scans it too).
    const fakeKey = ['sk', 'proj', 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH'].join('-');
    const fakeBlock = ['-----BEGIN RSA', 'PRIVATE KEY-----'].join(' ');
    const fakeUrl = ['postgres', '://app:S3cretPassw0rd@db.example.com/finanzapp'].join('');
    const secrets = run({ ...clean,
      'server/mobile/openai.js': `const key = '${fakeKey}';\n`,
      'docs/x.md': `${fakeBlock}\nMIIE\n`,
      'scripts/db.mjs': `const url = '${fakeUrl}';\n` }).secrets;
    expect(secrets.map(h => [h.file, h.name])).toEqual([
      ['server/mobile/openai.js', 'OpenAI API key'], ['docs/x.md', 'private key block'], ['scripts/db.mjs', 'Postgres URL with password']]);
    expect(run(clean).secrets).toEqual([]);
    expect(run({ 'server/mobile/handlers.test.js': "const headers = { authorization: 'Bearer fixture-token-0123456789' };\n" }).secrets).toEqual([]);
  });

  it('25Q2: recognises a real backup by its old, new or neutral dated name, and by its header whatever its name or size', () => {
    for (const path of ['finanzapp-piloto-1728900000000.json', 'apps/mobile/FinanzApp-backup-2026-10-15-1432.json', 'docs/backup-2026-10-15-1432.json',
      'copia_2026-10-15.json', 'respaldo 2026-10-15.json']) {
      expect(SENSITIVE_FILES.some(re => re.test(path)), path).toBe(true);
    }
    for (const path of ['apps/mobile/tests/fixtures/backup-v8.json', 'apps/mobile/src/ui/backup-file.ts', 'docs/backup-plan.md']) {
      expect(SENSITIVE_FILES.some(re => re.test(path)), path).toBe(false);
    }
    // Assembled at run time so this file itself never carries a backup header.
    const header = '{"app":"FinanzApp","schema":"finanzapp.native-pilot.v' + '14","exportedAt":"2026-10-15T14:32:00.000Z"';
    expect(BACKUP_HEADER.test(header)).toBe(true);
    // Above the 2 MiB text limit read() returns null; the head still finds it.
    const heads = { 'data/export.json': header, 'apps/mobile/tests/fixtures/sample.json': header, 'notes/backup.md': header, 'apps/mobile/package.json': '{ "name": "x" }' };
    const result = audit(Object.keys(heads), () => null, f => heads[f]);
    expect(result.backups).toEqual(['data/export.json']);
    expect(report(result).join('\n')).toContain('a tracked file is a FinanzApp backup');
    expect(run(clean).backups).toEqual([]);
  });
});
