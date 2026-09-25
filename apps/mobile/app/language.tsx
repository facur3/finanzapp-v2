import { LocaleChooser } from '../src/ui/locale-choosers';

/** Más → App y datos → Idioma: Español or English (released in Producto
 * 23.1C2), or "follow the device" (`resolveLanguage` in src/i18n/locale.ts),
 * drawn by `ChoiceScreen` since 24R2A. */
export default function LanguageScreen() {
  return <LocaleChooser kind="language" />;
}
