import { useMemo, type ReactNode } from 'react';
import { SectionList, View } from 'react-native';
import { formatMinorUnits, type Account, type Entry, type Transfer } from '@finanzapp/domain';
import { AppText, MovementRow, type RowContext } from './components';
import { useI18n } from '../i18n/provider';
import { activityDateLabel, dayNetMinor, groupActivity, mergeActivity, type ActivityItem } from './presentation';
import { useCurrentDay, usePalette } from './theme';

export function EntryList({ entries, transfers, accounts, accountId, header, empty, context }: {
  entries: Entry[]; transfers?: Transfer[]; accounts: Account[]; accountId?: string; header?: ReactNode; empty?: ReactNode; context?: RowContext;
}) {
  const p = usePalette();
  const day = useCurrentDay();
  const { t, locale, moneyText } = useI18n();
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
    renderSectionHeader={({ section }) => {
      const net = context ? null : dayNetMinor(section.data.filter(item => item.type === 'entry').map(item => item.value as Entry), accounts);
      return <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingTop: 20, paddingBottom: 8, paddingHorizontal: 4 }}>
        <AppText accessibilityRole="header" secondary variant="footnote" style={{ fontWeight: '600', flexShrink: 1 }}>
          {activityDateLabel(section.dateISO, day, locale)}
        </AppText>
        {net && net.minor !== 0 && <AppText secondary variant="footnote" style={{ fontVariant: ['tabular-nums'] }}
          accessibilityLabel={t(net.minor < 0 ? 'activity.dayNetNegative' : 'activity.dayNet', { amount: formatMinorUnits(Math.abs(net.minor)) + ' ' + net.currency })}>
          {net.minor < 0 ? '−' : '+'}{moneyText(Math.abs(net.minor), net.currency)}
        </AppText>}
      </View>;
    }}
    renderItem={({ item, index, section }) => <View style={{ backgroundColor: p.surface, overflow: 'hidden',
      borderTopLeftRadius: index === 0 ? 16 : 0, borderTopRightRadius: index === 0 ? 16 : 0,
      borderBottomLeftRadius: index === section.data.length - 1 ? 16 : 0, borderBottomRightRadius: index === section.data.length - 1 ? 16 : 0 }}>
      <MovementRow item={item} accounts={accounts} accountId={accountId} showDate={false} last={index === section.data.length - 1} context={context} />
    </View>} />;
}
