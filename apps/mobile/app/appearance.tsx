import { useI18n } from '../src/i18n/provider';
import { ChoiceScreen } from '../src/ui/choice-screen';
import { useThemePreference } from '../src/ui/theme';
import type { ThemePreference } from '../src/ui/theme-preference';

/** Más → App y datos → Apariencia (Producto 24UX6A): Sistema (the default: the device decides), Claro or Oscuro. A device
 * setting saved before it is applied (`theme-preference.ts`), outside the ledger and its backups; the whole app, and what
 * iOS draws for it, changes at once. Drawn by `ChoiceScreen` like Idioma and Región. */
export default function AppearanceScreen() {
  const { t } = useI18n();
  const { preference, setPreference, system } = useThemePreference();
  return <ChoiceScreen<ThemePreference> title={t('nav.titles.appearance')} selected={preference} onChoose={setPreference} note={t('preferences.appearanceNote')}
    pinned={{ value: 'system', title: t('preferences.appearanceSystem'),
      subtitle: preference === 'system' ? t(system === 'dark' ? 'preferences.appearanceSystemNowDark' : 'preferences.appearanceSystemNowLight') : t('preferences.appearanceSystemDetail') }}
    options={[{ value: 'light', title: t('preferences.appearanceLight') }, { value: 'dark', title: t('preferences.appearanceDark') }]} />;
}
