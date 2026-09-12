import type { ExpoConfig } from 'expo/config';

// Only isolated pilot identities are allowed in this first stage. Do not use
// com.facur3.finanzapp before the migration/release gates in the living roadmap.
const variant = process.env.APP_VARIANT ?? 'development';
if (variant !== 'development' && variant !== 'preview') {
  throw new Error('Solo development o preview están habilitados en el piloto.');
}
const isDevelopment = variant === 'development';
const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
if (projectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
  throw new Error('EXPO_PUBLIC_EAS_PROJECT_ID debe ser el UUID real del proyecto Expo.');
}

const config: ExpoConfig = {
  name: isDevelopment ? 'FinanzApp Dev' : 'FinanzApp Preview',
  slug: 'finanzapp-mobile',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  scheme: isDevelopment ? 'finanzapp-dev' : 'finanzapp-preview',
  ios: {
    bundleIdentifier: isDevelopment ? 'com.facur3.finanzapp.dev' : 'com.facur3.finanzapp.preview',
    supportsTablet: false,
  },
  android: {
    package: isDevelopment ? 'com.facur3.finanzapp.dev' : 'com.facur3.finanzapp.preview',
    permissions: [],
  },
  plugins: ['expo-router', 'expo-sqlite', '@react-native-community/datetimepicker', 'expo-system-ui',
    ['expo-splash-screen', { backgroundColor: '#F5F6F8', dark: { backgroundColor: '#080B10' } }]],
  extra: { pilot: true, ...(projectId ? { eas: { projectId } } : {}) },
};

export default config;
