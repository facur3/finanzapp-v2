import type { ExpoConfig } from 'expo/config';

// Only isolated pilot identities are allowed in this first stage. Do not use
// com.facur3.finanzapp before the migration/release gates in the living roadmap.
const variant = process.env.APP_VARIANT ?? 'development';
if (variant !== 'development' && variant !== 'preview') {
  throw new Error('Solo development o preview están habilitados en el piloto.');
}
const isDevelopment = variant === 'development';
// The EAS project @facur3/finanzapp-mobile, created by the owner on 2026-09-21. A project
// ID is public configuration (it names a project, it grants nothing), so it lives here;
// EXPO_PUBLIC_EAS_PROJECT_ID still overrides it for a fork or a second project.
const EAS_PROJECT_ID = 'b1cd9780-7e6a-4de3-9248-d446d0c77520';
const EAS_OWNER = 'facur3';
const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || EAS_PROJECT_ID;
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
  throw new Error('EXPO_PUBLIC_EAS_PROJECT_ID debe ser el UUID real del proyecto Expo.');
}

const config: ExpoConfig = {
  name: isDevelopment ? 'FinanzApp Dev' : 'FinanzApp Preview',
  slug: 'finanzapp-mobile',
  owner: EAS_OWNER,
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  scheme: isDevelopment ? 'finanzapp-dev' : 'finanzapp-preview',
  ios: {
    bundleIdentifier: isDevelopment ? 'com.facur3.finanzapp.dev' : 'com.facur3.finanzapp.preview',
    supportsTablet: false,
    infoPlist: {
      // iOS's fallback language for its own text in the app (edit menu, share
      // sheet) is the app's own fallback (DEFAULT_LANGUAGE): an iPhone in an
      // unsupported language (Portuguese) gets Spanish there too, not English.
      CFBundleDevelopmentRegion: 'es',
      // Always offer Settings → Apps → FinanzApp → Language, even to a person
      // with a single preferred language (WWDC24 "Build multilingual-ready apps").
      UIPrefersShowingLanguageSettings: true,
    },
  },
  android: {
    package: isDevelopment ? 'com.facur3.finanzapp.dev' : 'com.facur3.finanzapp.preview',
    permissions: [],
  },
  plugins: ['expo-router', 'expo-sqlite', '@react-native-community/datetimepicker', 'expo-system-ui',
    ['expo-splash-screen', { backgroundColor: '#F5F6F8', dark: { backgroundColor: '#080B10' } }],
    // CFBundleLocalizations: exactly the released interface languages
    // (RELEASED_LANGUAGES in src/i18n/locale.ts; tests/app-config.node.ts keeps
    // them equal), as bare language designators, because the region is a
    // separate preference. iOS then lists them for a per-app language and runs
    // its own text in the app's language. iOS only on purpose: the Android form
    // also rewrites build.gradle and locale files that no Android build has verified.
    ['expo-localization', { supportedLocales: { ios: ['es', 'en'] } }]],
  extra: { pilot: true, eas: { projectId } },
};

export default config;
