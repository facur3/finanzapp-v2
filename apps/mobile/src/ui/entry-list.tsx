import { useMemo, type ReactNode } from 'react';
import { SectionList, View } from 'react-native';
import { labelFromISO, type Account, type Entry } from '@finanzapp/domain';
import { AppText, EntryRow } from './components';
import { groupEntries, type EntrySection } from './presentation';
import { useCurrentDay, usePalette } from './theme';

export function EntryList({ entries, accounts, header, empty }: {
  entries: Entry[]; accounts: Account[]; header?: ReactNode; empty?: ReactNode;
}) {
  const p = usePalette();
  const day = useCurrentDay();
  const sections = useMemo(() => groupEntries(entries), [entries]);
  const byId = useMemo(() => new Map(accounts.map(account => [account.id, account])), [accounts]);
  return <SectionList<Entry, EntrySection> sections={sections} keyExtractor={entry => entry.id}
    style={{ flex: 1, backgroundColor: p.background }}
    contentContainerStyle={{ padding: 20, paddingBottom: 40, flexGrow: 1 }}
    contentInsetAdjustmentBehavior="automatic" automaticallyAdjustKeyboardInsets
    keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled"
    stickySectionHeadersEnabled={false} removeClippedSubviews={false}
    initialNumToRender={12} maxToRenderPerBatch={12} windowSize={7}
    ListHeaderComponent={header ? <View>{header}</View> : null}
    ListEmptyComponent={empty ? <View style={{ paddingTop: 16 }}>{empty}</View> : null}
    renderSectionHeader={({ section }) => <AppText accessibilityRole="header" secondary
      style={{ fontSize: 14, fontWeight: '500', paddingTop: 20, paddingBottom: 10 }}>
      {labelFromISO(section.dateISO, new Date(day + 'T12:00:00'))}
    </AppText>}
    renderItem={({ item, index, section }) => <View style={{ backgroundColor: p.surface, overflow: 'hidden',
      borderTopLeftRadius: index === 0 ? 20 : 0, borderTopRightRadius: index === 0 ? 20 : 0,
      borderBottomLeftRadius: index === section.data.length - 1 ? 20 : 0, borderBottomRightRadius: index === section.data.length - 1 ? 20 : 0 }}>
      <EntryRow entry={item} account={byId.get(item.accountId)!} showDate={false} last={index === section.data.length - 1} />
    </View>} />;
}
