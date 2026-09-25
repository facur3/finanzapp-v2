import { useMemo, useState } from 'react';
import { Stack } from 'expo-router';
import type { LanguagePreference, RegionPreference } from '../i18n/locale';
import { useI18n, useLocalePreferences } from '../i18n/provider';
import { readRecent, rememberRecent } from '../i18n/recent';
import { ChoiceScreen } from './choice-screen';
import { Screen } from './components';
import { localeChooser, type LocalePreferenceKind } from './locale-options';

/** Más → Idioma and Más → Región (Producto 24R2A): `ChoiceScreen` over the
 * released languages or regions, iOS Settings style. "Según el dispositivo" is
 * pinned first and says what the device gives now; a short list (the two
 * released languages, the two released regions) is one card; the preview's
 * 257 regions get the search field (name, ISO codes, currency), the recent
 * choices and the alphabetical sections. A language row is its autonym,
 * spoken in its own language. A tap saves first and applies second: when the
 * key-value store refuses the write the checkmark stays and the screen says
 * so; the app re-renders in place (this screen's title included), nothing
 * remounts, an open draft keeps its value. The recents are read once when the
 * screen opens, so the list never jumps under a finger; a choice is
 * remembered for the next visit. `onChosen` lets another flow (the
 * onboarding's language and region steps) continue after a saved choice,
 * or after a tap on the value already checked, which writes nothing. */
export function LocaleChooser({ kind, onChosen }: { kind: LocalePreferenceKind; onChosen?: (value: LanguagePreference | RegionPreference) => void }) {
  const { t } = useI18n();
  const preferences = useLocalePreferences();
  const state = preferences?.state;
  const chooser = useMemo(() => state ? localeChooser(kind, state, t) : null, [kind, state, t]);
  const [recent] = useState<string[]>(() => chooser ? readRecent(kind, chooser.acceptRecent) : []);
  const title = t(kind === 'language' ? 'preferences.language' : 'preferences.region');
  if (!preferences || !chooser) return <Screen><Stack.Screen options={{ title }} /></Screen>;
  const choose = (value: string) => {
    const saved = kind === 'language' ? preferences.setLanguage(value as LanguagePreference) : preferences.setRegion(value as RegionPreference);
    if (!saved) return false;
    // Remembering is a convenience: a store that refuses it changes nothing else.
    if (chooser.acceptRecent(value)) rememberRecent(kind, value, chooser.acceptRecent);
    onChosen?.(value as LanguagePreference | RegionPreference);
    return true;
  };
  // Confirming the value already checked (the onboarding's "continue with this") saves nothing: the preference is
  // already that value. Más passes no `onChosen`, so there a tap on the checked row still does nothing at all.
  const confirm = onChosen && ((value: string) => onChosen(value as LanguagePreference | RegionPreference));
  return <ChoiceScreen title={title} pinned={chooser.pinned} options={chooser.options} recent={recent} selected={chooser.selected}
    onChoose={choose} onConfirm={confirm} note={chooser.note} />;
}
