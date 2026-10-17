import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// What the privacy label says (no data collected, no tracking, one network call without the owner's backend) tied to what
// the build is made of: the dependencies, the Info.plist keys and the places that reach the network. A file-reading guard,
// not an App Store review: a change here is a change of the label, said in the same PR (docs/app-store-launch.md).

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };

/** The dependencies the label was written for. A new one is added here on purpose, with the label reviewed. */
const ALLOWED = ['@expo/vector-icons', '@finanzapp/domain', '@react-native-community/datetimepicker', 'decode-uri-component', 'expo', 'expo-constants', 'expo-crypto',
  'expo-dev-client', 'expo-file-system', 'expo-font', 'expo-glass-effect', 'expo-haptics', 'expo-linking', 'expo-localization', 'expo-router', 'expo-sharing',
  'expo-splash-screen', 'expo-sqlite', 'expo-status-bar', 'expo-system-ui', 'react', 'react-native', 'react-native-gesture-handler', 'react-native-reanimated',
  'react-native-safe-area-context', 'react-native-screens', 'react-native-svg', 'react-native-worklets', 'safe-decode-uri-component'];
/** Analytics, crash reporting, attribution, ads, push, purchases and the sign-in or biometric modules each change the label
 * or need a purpose string; each arrives with the roadmap row that introduces it, never as a side effect of an install. */
const BANNED = /firebase|sentry|segment|amplitude|mixpanel|appsflyer|adjust|posthog|bugsnag|crashlytics|onesignal|branch|tracking-transparency|google-mobile-ads|fbsdk|react-native-purchases|expo-iap|expo-notifications|expo-local-authentication|expo-apple-authentication|expo-location|expo-contacts|expo-camera|expo-image-picker/;

test('the dependencies are the ones the privacy label was written for, and none is an analytics, tracking, push or purchase SDK', () => {
  const names = Object.keys(pkg.dependencies);
  assert.deepEqual(names.filter(name => BANNED.test(name)), []);
  assert.deepEqual(names.filter(name => !ALLOWED.includes(name)), [], 'a new dependency: review the privacy label, then add it to ALLOWED');
});

function config(env: Record<string, string>) {
  const code = ts.transpileModule(read('app.config.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const module = { exports: {} as { default?: any } };
  runInNewContext(code, { module, exports: module.exports, process: { env }, Error });
  return module.exports.default!;
}

test('no build variant asks iOS for a permission or for tracking: no usage description, no tracking key', () => {
  for (const env of [{}, { APP_VARIANT: 'preview' }] as Record<string, string>[]) {
    const keys = Object.keys(config(env).ios?.infoPlist ?? {});
    assert.deepEqual(keys.filter(key => /^NS.*UsageDescription$|^NSUserTracking/.test(key)), [], JSON.stringify(env));
  }
});

function sources(directory: string): string[] {
  return readdirSync(new URL('../' + directory, import.meta.url), { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && /\.tsx?$/.test(entry.name)).map(entry => (entry.parentPath + '/' + entry.name).split('/apps/mobile/')[1]);
}
const code = (path: string) => read(path).replace(/\/\*[\s\S]*?\*\/|(?<!:)\/\/.*$/gm, ''); // comments out; a URL's own // stays

test('the network is reached from two kinds of place only: the reference-rate provider and the owner\'s own backend (the Assistant and the integration client)', () => {
  const files = [...sources('app'), ...sources('src')];
  const fetching = files.filter(path => /\bfetch\b/.test(code(path)) && !path.startsWith('src/i18n/regions/'));
  assert.deepEqual(fetching.sort(), ['src/assistant/client.ts', 'src/fx/rates-provider.tsx', 'src/integrations/client.ts']);
  const origins = files.flatMap(path => [...code(path).matchAll(/https:\/\/[A-Za-z0-9.-]+/g)].map(match => match[0]));
  assert.deepEqual([...new Set(origins)], ['https://api.frankfurter.dev'], 'the one origin compiled into the app; the backend origin comes from its environment');
});
