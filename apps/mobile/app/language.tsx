import { LocalePreferenceScreen } from '../src/ui/locale-preference';

/** Más → App y datos → Idioma: Español or English (released in Producto
 * 23.1C2), or "follow the device" (`resolveLanguage` in src/i18n/locale.ts). */
export default function LanguageScreen() {
  return <LocalePreferenceScreen kind="language" />;
}
