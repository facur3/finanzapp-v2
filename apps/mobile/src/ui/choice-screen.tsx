import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useI18n } from '../i18n/provider';
import { AppText, CheckRow, ErrorMessage, Field, PressFeedback } from './components';
import { SEARCHABLE_CHOICES, buildChoiceRows, groupEndIndex, type ChoiceOption, type ChoiceRow, type GroupPosition } from './choice-list';
import { FlagTile, RegionMark } from './marks';
import { selectionHaptic } from './motion';
import { radius, space, usePalette } from './theme';

/** A compact, searchable single-choice screen (Producto 24R1, mounted behind
 * Más → Región and → Idioma in 24R2A, `locale-choosers.tsx`). One list,
 * virtualized: the pinned option ("Según el dispositivo") first; from
 * `SEARCHABLE_CHOICES` options a search field, the recent choices and
 * alphabetical sections whose header is the initial; below that, one card. Rows are the same
 * `CheckRow` as today's choosers, drawn as grouped cards by their position in
 * the section, so two options or two hundred read alike. A row that names a
 * language in its own words carries `language`, so VoiceOver speaks it with
 * that voice. Nothing here saves: `onChoose` returns whether the caller saved,
 * and a refused save keeps the checkmark where it was and says so. A search
 * that matches nothing says so under the field while the pinned option stays
 * (the list is never empty then, so `ListEmptyComponent` would never show). Text scales
 * with Dynamic Type; no row has a fixed height. Nothing here knows about
 * routes beyond the title, so the onboarding can show it as one of its steps.
 *
 * 25O1: a row leads with its mark when its option carries one (a region's flag, the device row's neutral glyph); a
 * language never has one. On the 234-region list nothing waits at the end: the note sits under the pinned card, read
 * before the list (and steps aside while a search is typed), and a refused save is said under the group that was
 * tapped, as an iOS section footer, where the person is. A short list keeps its note under its last card. */
export function ChoiceScreen<T extends string>({ title, options, pinned, recent, selected, onChoose, onConfirm, note, noteAction, searchableFrom = SEARCHABLE_CHOICES }: {
  title: string; options: readonly ChoiceOption<T>[]; pinned?: ChoiceOption<T>; recent?: readonly T[]; selected: T | null;
  /** Saves the choice; false when the store refused it (the screen says so and keeps the previous checkmark). */
  onChoose: (value: T) => boolean;
  /** A tap on the option already checked. Absent (Más): nothing happens. A flow that continues after a choice (the
   * onboarding) passes it to go on with the current value: nothing is saved, nothing changes, no error is shown. */
  onConfirm?: (value: T) => void;
  /** The one fact worth saying about the choice, as a footnote outside every card. */
  note?: string;
  /** 25O1: a text button under the note (Idioma: «Abrir Ajustes»). */
  noteAction?: { label: string; onPress: () => void };
  searchableFrom?: number;
}) {
  const p = usePalette();
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  // The row whose save was refused, by key: the same option may be listed twice (a recent, and its section).
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const searchable = options.length >= searchableFrom;
  // A short list is one card under the pinned row: no search, no recents, no lettered sections.
  const rows = useMemo(() => buildChoiceRows({ pinned, recent: searchable ? recent : [], options, selected, query: searchable ? query : '',
    recentTitle: t('preferences.recent'), sections: searchable }), [pinned, recent, options, selected, query, searchable, t]);
  // No real choice left (the pinned row does not count): the list is not empty while the pinned option stays,
  // so the sentence is drawn from this, under the search field, never from `ListEmptyComponent`.
  const noMatches = !rows.some(row => row.kind === 'choice' && !row.pinned);
  const choose = (row: Extract<ChoiceRow<T>, { kind: 'choice' }>) => {
    if (row.option.value === selected) { onConfirm?.(row.option.value); return; }
    const saved = onChoose(row.option.value);
    setFailedKey(saved ? null : row.key);
    if (saved) selectionHaptic();
  };
  // A new search leaves the refusal behind with the rows it was said under; a retry says it again.
  const search = (text: string) => { setQuery(text); setFailedKey(null); };
  const failedFooter = failedKey === null ? undefined : rows[groupEndIndex(rows, failedKey)]?.key;
  // A long list's note goes under its pinned card; any other list's under its last card.
  const noteUnderPinned = searchable && !!pinned;
  const noteBlock = note ? <View style={{ paddingHorizontal: 4 }}>
    <AppText secondary variant="footnote">{note}</AppText>
    {noteAction && <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel={noteAction.label} onPress={noteAction.onPress}
      style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
      <AppText variant="footnote" style={{ color: p.link, fontWeight: '600' }}>{noteAction.label}</AppText>
    </PressFeedback>}
  </View> : null;
  // The list is the screen's scroll view, inset like `Screen` and the other lists: iOS adds the navigation bar, the home
  // indicator's safe area and, while the search field is focused, the keyboard (`automaticallyAdjustKeyboardInsets`), so
  // the last region, the error and the footnote scroll clear of all three. No fixed margin stands in for an inset.
  return <>
    <Stack.Screen options={{ title }} />
    <FlatList<ChoiceRow<T>> data={rows} keyExtractor={row => row.key} style={{ flex: 1, backgroundColor: p.background }}
      contentInsetAdjustmentBehavior="automatic" automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive"
      contentContainerStyle={{ padding: space.xl, paddingBottom: 48, flexGrow: 1 }} initialNumToRender={16} windowSize={7} removeClippedSubviews={false}
      ListHeaderComponent={searchable || noMatches ? <View style={{ paddingBottom: space.l, gap: space.m }}>
        {searchable && <Field label={t('preferences.search')} value={query} onChangeText={search} autoCapitalize="none" autoCorrect={false} clearButtonMode="while-editing" maxLength={40} />}
        {noMatches && <AppText secondary variant="subhead" style={{ paddingHorizontal: 4 }}>{t('preferences.noMatches')}</AppText>}
      </View> : null}
      ListFooterComponent={!noteUnderPinned && noteBlock ? <View style={{ paddingTop: space.m }}>{noteBlock}</View> : null}
      renderItem={({ item, index }) => {
        if (item.kind === 'header') return <AppText secondary variant="eyebrow" accessibilityRole="header" style={{ paddingHorizontal: 4, paddingTop: space.l, paddingBottom: space.s }}>{item.title}</AppText>;
        const failed = item.key === failedFooter;
        const noted = item.pinned === true && noteUnderPinned && !query.trim() && !!noteBlock;
        const detached = detachedPinned(rows, index);
        const cell = <View style={[{ backgroundColor: p.surface, overflow: 'hidden' }, groupStyle(item.position), detached && !failed && !noted && styles.detached]}>
          <CheckRow title={item.option.title} subtitle={item.option.subtitle} selected={item.selected} accessibilityLanguage={item.option.language}
            leading={choiceMark(item.option)} last={item.position === 'last' || item.position === 'only'} onPress={() => choose(item)} />
        </View>;
        if (!failed && !noted) return cell;
        return <View style={detached && styles.detached}>
          {cell}
          <View style={styles.footer}>
            {failed && <ErrorMessage message={t('preferences.saveFailed')} />}
            {noted && noteBlock}
          </View>
        </View>;
      }} />
  </>;
}

/** 25O1: a row's mark, drawn from its data: a region's flag, or a neutral glyph on the same 40 pt tile; nothing for a
 * language. Hidden from VoiceOver by its own component: the title already names it. */
function choiceMark(option: ChoiceOption) {
  if (option.region) return <RegionMark region={option.region} />;
  return option.glyph ? <FlagTile flag={null} fallback={option.glyph} /> : undefined;
}

/** The corners a row draws by its place in its group, so consecutive rows read as one grouped card. */
export function groupStyle(position: GroupPosition) {
  return position === 'only' ? styles.only : position === 'first' ? styles.first : position === 'last' ? styles.last : styles.middle;
}

/** 24UX6E: the pinned card stands apart from the options card that follows it at once (a short list, or a query), the
 * block gap of `Screen`; before a section header it needs none, since the header carries its own top padding. Without
 * it the two rounded cards touched and read as one broken card. */
function detachedPinned<T extends string>(rows: readonly ChoiceRow<T>[], index: number) {
  const row = rows[index];
  return row?.kind === 'choice' && row.pinned === true && rows[index + 1]?.kind === 'choice';
}

const styles = StyleSheet.create({
  detached: { marginBottom: space.xl },
  /** A group's footer (25O1): a refused save, or the long list's note under the pinned card. */
  footer: { gap: 10, paddingTop: space.s },
  only: { borderRadius: radius.group, marginTop: 0 },
  first: { borderTopLeftRadius: radius.group, borderTopRightRadius: radius.group },
  middle: {},
  last: { borderBottomLeftRadius: radius.group, borderBottomRightRadius: radius.group },
});
