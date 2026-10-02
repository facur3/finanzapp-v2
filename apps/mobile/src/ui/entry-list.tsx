import { useMemo, type ReactNode } from 'react';
import { SectionList, View } from 'react-native';
import { type Account, type Entry, type Transfer } from '@finanzapp/domain';
import { AppText, MovementRow, type RowContext } from './components';
import { useI18n } from '../i18n/provider';
import { activityDateLabel, dayNetMinor, groupActivity, mergeActivity, type ActivityItem } from './presentation';
import { useCurrentDay, usePalette } from './theme';
import { useDockInset } from './dock-clearance';

export function EntryList({ entries, transfers, accounts, accountId, header, empty, footer, context, dayNet = true }: {
  entries: Entry[]; transfers?: Transfer[]; accounts: Account[]; accountId?: string; header?: ReactNode; empty?: ReactNode;
  /** After the last movement: a detail screen's own actions (24UX4: close or delete a debt), where iOS places them. */
  footer?: ReactNode; context?: RowContext;
  /** 24UX6E: false on a list of movements that count nowhere (Movimientos deshechos): the day heading stands alone, with
   * no signed net and no spoken «Neto del día» over records that are in no balance or report. */
  dayNet?: boolean;
}) {
  const p = usePalette();
  const day = useCurrentDay();
  const { t, locale, moneyText, spokenAmount } = useI18n();
  const sections = useMemo(() => groupActivity(mergeActivity(entries, transfers)), [entries, transfers]);
  // 25UX1: Movimientos runs under the floating dock (see `Screen`); a pushed list keeps its padding (clearance 0).
  const dock = useDockInset();
  return <SectionList<ActivityItem, { dateISO: string; data: ActivityItem[] }> sections={sections} keyExtractor={item => item.key}
    style={{ flex: 1, backgroundColor: p.background }}
    contentContainerStyle={{ padding: 20, paddingBottom: 40 + dock.extraPadding, flexGrow: 1 }}
    scrollIndicatorInsets={dock.indicator}
    contentInsetAdjustmentBehavior={dock.extraPadding ? 'never' : 'automatic'} automaticallyAdjustKeyboardInsets
    keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled"
    stickySectionHeadersEnabled={false} removeClippedSubviews={false}
    initialNumToRender={12} maxToRenderPerBatch={12} windowSize={7}
    ListHeaderComponent={header ? <View>{header}</View> : null}
    ListEmptyComponent={empty ? <View style={{ paddingTop: 16 }}>{empty}</View> : null}
    ListFooterComponent={footer ? <View style={{ paddingTop: 32 }}>{footer}</View> : null}
    renderSectionHeader={({ section }) => {
      const net = context || !dayNet ? null : dayNetMinor(section.data.filter(item => item.type === 'entry').map(item => item.value as Entry), accounts);
      // 24UX6C: the day reads as the section's heading (ink, subhead weight); its net stays secondary and keeps its sign.
      return <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingTop: 24, paddingBottom: 8, paddingHorizontal: 4 }}>
        <AppText accessibilityRole="header" variant="subhead" style={{ fontWeight: '600', flexShrink: 1 }}>
          {activityDateLabel(section.dateISO, day, locale)}
        </AppText>
        {net && net.minor !== 0 && <AppText secondary variant="footnote" style={{ fontVariant: ['tabular-nums'] }}
          accessibilityLabel={t(net.minor < 0 ? 'activity.dayNetNegative' : 'activity.dayNet', { amount: spokenAmount(Math.abs(net.minor), net.currency) })}>
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
