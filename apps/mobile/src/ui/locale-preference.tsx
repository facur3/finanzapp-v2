import { useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useI18n, useLocalePreferences } from '../i18n/provider';
import { AppText, CheckRow, ErrorMessage, Screen, Surface } from './components';
import { preferenceChoices, type LocalePreferenceKind } from './locale-options';
import { selectionHaptic } from './motion';

/** Más → Idioma and Más → Región: one grouped list, "follow the device"
 * first, a checkmark on the choice in use, iOS Settings style. A language row
 * carries its own language for VoiceOver (`accessibilityLanguage`), so
 * "English" is spoken by an English voice and "Español" by a Spanish one, as
 * iOS Settings does; the other rows keep the interface's speech language.
 * A tap saves first and applies second: when the key-value store refuses the
 * write, the checkmark stays where it was and the screen says so. The change
 * re-renders the app in place (the title of this screen included); nothing is
 * restarted and no navigation state is lost. The notes say what the setting
 * does and that it never touches the ledger or a backup. */
export function LocalePreferenceScreen({ kind }: { kind: LocalePreferenceKind }) {
  const { t } = useI18n();
  const preferences = useLocalePreferences();
  const [failed, setFailed] = useState(false);
  const title = t(kind === 'language' ? 'preferences.language' : 'preferences.region');
  if (!preferences) return <Screen><Stack.Screen options={{ title }} /></Screen>;
  const { options, selected } = preferenceChoices(kind, preferences.state, t);
  const choose = (value: string) => {
    if (value === selected) return;
    const saved = kind === 'language' ? preferences.setLanguage(value as never) : preferences.setRegion(value as never);
    setFailed(!saved);
    if (saved) selectionHaptic();
  };
  return <Screen>
    <Stack.Screen options={{ title }} />
    <View style={{ gap: 10 }}>
      <Surface grouped>
        {options.map((option, index) => <CheckRow key={option.value} title={option.title} subtitle={option.subtitle} selected={option.value === selected}
          accessibilityLanguage={option.language} last={index === options.length - 1} onPress={() => choose(option.value)} />)}
      </Surface>
      <ErrorMessage message={failed ? t('preferences.saveFailed') : null} />
      <AppText secondary variant="footnote" style={{ paddingHorizontal: 4 }}>
        {kind === 'language' ? t('preferences.dataUntouched') : t('preferences.regionNote') + ' ' + t('preferences.dataUntouched')}
      </AppText>
    </View>
  </Screen>;
}
