import { describe, it, expect } from 'vitest';
import { audit, report, LEGACY_WEB, GENERATED, SENSITIVE_FILES } from './check-repo.mjs';

const clean = {
  'apps/mobile/src/ui/theme.ts': "import { todayKey } from '@finanzapp/domain';\n",
  'apps/mobile/tests/assistant.node.ts': "import { x } from '../../../packages/integrations/contracts.js';\n",
  'packages/domain/index.ts': "export * from './dates.ts';\n",
  'server/mobile/handlers.js': "import { validate } from '../../packages/integrations/contracts.js';\n",
  'api/mobile/assistant.js': "import { createMobileHandler } from '../../server/mobile/handlers.js';\n",
  'server/mobile/schema.test.sql': "-- POSTGRES_PASSWORD: fixture-only\n",
  'docs/web-retirement-inventory.md': "`git show web-frontend-final:src/domain/dates.js` recovers the module.\n",
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
    for (const path of ['api/mobile/assistant.js', 'apps/mobile/src/storage/database.ts', 'scripts/check-repo.mjs', 'docs/history/web-release-notes.md',
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
    const secrets = run({ ...clean,
      'server/mobile/openai.js': "const key = 'sk-proj-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH';\n",
      'docs/x.md': '-----BEGIN RSA PRIVATE KEY-----\nMIIE\n',
      'scripts/db.mjs': "const url = 'postgres://app:S3cretPassw0rd@db.example.com/finanzapp';\n" }).secrets;
    expect(secrets.map(h => [h.file, h.name])).toEqual([
      ['server/mobile/openai.js', 'OpenAI API key'], ['docs/x.md', 'private key block'], ['scripts/db.mjs', 'Postgres URL with password']]);
    expect(run(clean).secrets).toEqual([]);
    expect(run({ 'server/mobile/handlers.test.js': "const headers = { authorization: 'Bearer fixture-token-0123456789' };\n" }).secrets).toEqual([]);
  });
});
