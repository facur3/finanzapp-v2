import { useMemo, type ReactNode } from 'react';
import { SectionList, View } from 'react-native';
import { labelFromISO, type Account, type Entry, type Transfer } from '@finanzapp/domain';
import { AppText, MovementRow, type RowContext } from './components';
import { groupActivity, mergeActivity, type ActivityItem } from './presentation';
import { useCurrentDay, usePalette } from './theme';

export function EntryList({ entries, transfers, accounts, accountId, header, empty, context }: {
  entries: Entry[]; transfers?: Transfer[]; accounts: Account[]; accountId?: string; header?: ReactNode; empty?: ReactNode; context?: RowContext;
}) {
  const p = usePalette();
  const day = useCurrentDay();
  const sections = useMemo(() => groupActivity(mergeActivity(entries, transfers)), [entries, transfers]);
  return <SectionList<ActivityItem, { dateISO: string; data: ActivityItem[] }> sections={sections} keyExtractor={item => item.key}
    style={{ flex: 1, backgroundColor: p.background }}
    contentContainerStyle={{ padding: 20, paddingBottom: 40, flexGrow: 1 }}
    contentInsetAdjustmentBehavior="automatic" automaticallyAdjustKeyboardInsets
    keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled"
    stickySectionHeadersEnabled={false} removeClippedSubviews={false}
    initialNumToRender={12} maxToRenderPerBatch={12} windowSize={7}
    ListHeaderComponent={header ? <View>{header}</View> : null}
    ListEmptyComponent={empty ? <View style={{ paddingTop: 16 }}>{empty}</View> : null}
    renderSectionHeader={({ section }) => <AppText accessibilityRole="header" secondary variant="footnote"
      style={{ fontWeight: '600', paddingTop: 20, paddingBottom: 8, paddingHorizontal: 4 }}>
      {labelFromISO(section.dateISO, new Date(day + 'T12:00:00'))}
    </AppText>}
    renderItem={({ item, index, section }) => <View style={{ backgroundColor: p.surface, overflow: 'hidden',
      borderTopLeftRadius: index === 0 ? 16 : 0, borderTopRightRadius: index === 0 ? 16 : 0,
      borderBottomLeftRadius: index === section.data.length - 1 ? 16 : 0, borderBottomRightRadius: index === section.data.length - 1 ? 16 : 0 }}>
      <MovementRow item={item} accounts={accounts} accountId={accountId} showDate={false} last={index === section.data.length - 1} context={context} />
    </View>} />;
}
