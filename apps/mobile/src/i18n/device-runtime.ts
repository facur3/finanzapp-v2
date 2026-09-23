/** The runtime wiring of `device.ts`: Expo's optional-module probe and the
 * lazy package load. Kept apart so the pure logic stays loadable in Node. The
 * probe returns null for an unregistered module and never throws; the
 * `require` below runs only after it answered yes, so expo-localization's
 * own `requireNativeModule` is never evaluated in a binary without it. */
import { requireOptionalNativeModule } from 'expo';
import { intlLocale, readDeviceLocales, type DeviceLocaleDeps, type LocalizationModule } from './device';

export const runtimeDeviceLocaleDeps: DeviceLocaleDeps = {
  nativeRegistered: () => requireOptionalNativeModule('ExpoLocalization') != null,
  load: () => require('expo-localization') as LocalizationModule,
  intlLocale,
};

export const readRuntimeDeviceLocales = () => readDeviceLocales(runtimeDeviceLocaleDeps);
