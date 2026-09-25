import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useI18n } from '../i18n/provider';
import { AppText, CheckRow, ErrorMessage, Field } from './components';
import { SEARCHABLE_CHOICES, buildChoiceRows, type ChoiceOption, type ChoiceRow, type GroupPosition } from './choice-list';
import { selectionHaptic } from './motion';
import { radius, space, usePalette } from './theme';

/** A compact, searchable single-choice screen (Producto 24R1): the shape the
 * Región and Idioma choosers take once the catalogue's regions are released
 * (24R2). One list, virtualized: a search field from `SEARCHABLE_CHOICES`
 * options, the pinned option ("Según el dispositivo") first, the recent choices,
 * then alphabetical sections whose header is the initial. Rows are the same
 * `CheckRow` as today's choosers, drawn as grouped cards by their position in
 * the section, so two options or two hundred read alike. A row that names a
 * language in its own words carries `language`, so VoiceOver speaks it with
 * that voice. Nothing here saves: `onChoose` returns whether the caller saved,
 * and a refused save keeps the checkmark where it was and says so. Text scales
 * with Dynamic Type; no row has a fixed height. Not wired to a route yet. */
export function ChoiceScreen<T extends string>({ title, options, pinned, recent, selected, onChoose, note, searchableFrom = SEARCHABLE_CHOICES }: {
  title: string; options: readonly ChoiceOption<T>[]; pinned?: ChoiceOption<T>; recent?: readonly T[]; selected: T | null;
  /** Saves the choice; false when the store refused it (the screen says so and keeps the previous checkmark). */
  onChoose: (value: T) => boolean;
  /** A footnote under the list, never inside it. */
  note?: string;
  searchableFrom?: number;
}) {
  const p = usePalette();
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [failed, setFailed] = useState(false);
  const searchable = options.length >= searchableFrom;
  const rows = useMemo(() => buildChoiceRows({ pinned, recent, options, selected, query: searchable ? query : '', recentTitle: t('preferences.recent') }),
    [pinned, recent, options, selected, query, searchable, t]);
  const choose = (value: T) => {
    if (value === selected) return;
    const saved = onChoose(value);
    setFailed(!saved);
    if (saved) selectionHaptic();
  };
  return <View style={{ flex: 1, backgroundColor: p.background }}>
    <Stack.Screen options={{ title }} />
    <FlatList<ChoiceRow<T>> data={rows} keyExtractor={row => row.key} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      contentContainerStyle={{ padding: space.xl, paddingBottom: 40 }} initialNumToRender={16} windowSize={7} removeClippedSubviews={false}
      ListHeaderComponent={searchable ? <View style={{ paddingBottom: space.l }}>
        <Field label={t('preferences.search')} value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} clearButtonMode="while-editing" maxLength={40} />
      </View> : null}
      ListEmptyComponent={<AppText secondary variant="subhead" style={{ paddingHorizontal: 4 }}>{t('preferences.noMatches')}</AppText>}
      ListFooterComponent={<View style={{ gap: 10, paddingTop: space.m }}>
        <ErrorMessage message={failed ? t('preferences.saveFailed') : null} />
        {!!note && <AppText secondary variant="footnote" style={{ paddingHorizontal: 4 }}>{note}</AppText>}
      </View>}
      renderItem={({ item }) => item.kind === 'header'
        ? <AppText secondary variant="eyebrow" accessibilityRole="header" style={{ paddingHorizontal: 4, paddingTop: space.l, paddingBottom: space.s }}>{item.title}</AppText>
        : <View style={[{ backgroundColor: p.surface, overflow: 'hidden' }, groupStyle(item.position)]}>
          <CheckRow title={item.option.title} subtitle={item.option.subtitle} selected={item.selected} accessibilityLanguage={item.option.language}
            last={item.position === 'last' || item.position === 'only'} onPress={() => choose(item.option.value)} />
        </View>} />
  </View>;
}

/** The corners a row draws by its place in its group, so consecutive rows read as one grouped card. */
export function groupStyle(position: GroupPosition) {
  return position === 'only' ? styles.only : position === 'first' ? styles.first : position === 'last' ? styles.last : styles.middle;
}

const styles = StyleSheet.create({
  only: { borderRadius: radius.group, marginTop: 0 },
  first: { borderTopLeftRadius: radius.group, borderTopRightRadius: radius.group },
  middle: {},
  last: { borderBottomLeftRadius: radius.group, borderBottomRightRadius: radius.group },
});
