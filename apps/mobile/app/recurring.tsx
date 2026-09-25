import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { recurringForecastByCurrency, type Currency, type RecurringRule } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, EmptyState, ErrorMessage, IconButton, MerchantBadge, Money, PressFeedback, Screen, SectionTitle, Stat, StatRow, Surface, useStacked } from '../src/ui/components';
import { useCategoryLook } from '../src/ui/category-hues';
import { useRecurringManagement } from '../src/ui/commitment-actions';
import { SwipeRow, swipeAccessibility, type SwipeAction } from '../src/ui/swipe-actions';
import { dueWhen } from '../src/ui/presentation';
import { withCurrencyCode } from '../src/i18n/format';
import { useI18n } from '../src/i18n/provider';
import { space, useCurrentDay, usePalette } from '../src/ui/theme';

/** Recurring rules are commitments, not payments: each one posts a normal
 * movement when its date arrives, once (a deterministic id per occurrence). The
 * 30-day view is a projection per currency; the payments a rule actually
 * registered are listed in its detail (24UX2). A row is paused, resumed or deleted
 * with a trailing swipe or from its detail (24UX4); a deleted rule leaves the list
 * while the movements it recorded stay in Movimientos. */
export default function RecurringScreen() {
  const { accountId } = useLocalSearchParams<{ accountId?: string }>();
  const { archive, snapshot } = useLedger();
  const day = useCurrentDay();
  const { t } = useI18n();
  const manage = useRecurringManagement();
  const accounts = snapshot?.accounts ?? [];
  const allRules = archive?.recurring ?? [];
  const rules = useMemo(() => allRules
    .filter(rule => !rule.deleted && (!accountId || rule.accountId === accountId))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.nextDateISO.localeCompare(b.nextDateISO) || a.merchant.localeCompare(b.merchant)),
  [allRules, accountId]);
  const account = accounts.find(item => item.id === accountId);
  const active = rules.filter(rule => rule.active);
  const paused = rules.filter(rule => !rule.active);
  const forecast = useMemo(() => recurringForecastByCurrency(active, accounts, day, 30), [active, accounts, day]);

  if (!snapshot || !archive) return null;
  const newParams = accountId ? { accountId } : {};
  return <Screen gap={space.xxl}>
    <Stack.Screen options={{
      title: account ? account.name : t('nav.titles.recurring'),
      headerRight: () => <IconButton name="add" label={t('recurring.list.add')} onPress={() => router.push({ pathname: '/new-recurring', params: newParams })} />,
    }} />
    <ErrorMessage message={manage.error} />
    {!rules.length ? <EmptyState title={t('recurring.list.emptyTitle')}
      detail={t(account ? 'recurring.list.emptyDetailAccount' : 'recurring.list.emptyDetail')}
      icon="repeat-outline"
      action={<ActionButton label={t('recurring.list.create')} icon="add-outline" onPress={() => router.push({ pathname: '/new-recurring', params: newParams })} />} />
      : <>
        {!!forecast.length && <View>
          <SectionTitle>{t('recurring.list.next30')}</SectionTitle>
          <View style={{ gap: 10 }}>
            {forecast.map(item => item.status === 'ready' ? <Surface key={item.currency}><StatRow>
              <Stat label={withCurrencyCode(t('recurring.list.payments'), item.currency)}><Money minor={item.expenseMinor} currency={item.currency} size={20} weight="700" /></Stat>
              <Stat label={t('recurring.list.dueCount')}><AppText style={{ fontWeight: '600' }}>{item.count}</AppText></Stat>
              <Stat label={t('recurring.list.income')}><Money minor={item.incomeMinor} currency={item.currency} size={17} tone={item.incomeMinor ? 'income' : 'neutral'} signed={item.incomeMinor > 0} /></Stat>
            </StatRow></Surface>
              // A projection beyond the safe range is said, never rounded or dropped for that currency.
              : <Surface key={item.currency}><AppText secondary>{withCurrencyCode(t('recurring.list.outOfRange'), item.currency)}</AppText></Surface>)}
          </View>
        </View>}

        {!!active.length && <View>
          <SectionTitle>{t('recurring.list.active')}</SectionTitle>
          <Surface grouped>{active.map((rule, index) => <RecurringRow key={rule.id} rule={rule} accounts={accounts} day={day}
            last={index === active.length - 1} actions={manage.actions(rule)} />)}</Surface>
        </View>}

        {!!paused.length && <View>
          <SectionTitle caption={t('recurring.list.pausedCaption')}>{t('recurring.list.paused')}</SectionTitle>
          <Surface grouped>{paused.map((rule, index) => <RecurringRow key={rule.id} rule={rule} accounts={accounts} day={day}
            last={index === paused.length - 1} actions={manage.actions(rule)} />)}</Surface>
        </View>}
      </>}
  </Screen>;
}

/** One rule (24UX2): who is paid (the typed name, with its mark), then how often and what for (frequency ·
 * category · account); on the right the amount and when it is next due, or that it is paused. The date appears
 * once. A paused rule keeps full-contrast ink (it was drawn at 60 % opacity, below AA for its caption) and says
 * «Pausado» where the due day would be, in its caption and in its VoiceOver sentence. Pause/resume and delete are
 * trailing swipe actions (24UX4, replacing the row's switch), and VoiceOver custom actions on the same row. */
function RecurringRow({ rule, accounts, day, last, actions }: {
  rule: RecurringRule; accounts: { id: string; name: string; currency: Currency }[]; day: string; last: boolean; actions: SwipeAction[];
}) {
  const p = usePalette();
  const { t, relativeDate, spokenMinor } = useI18n();
  const account = accounts.find(item => item.id === rule.accountId);
  const category = useCategoryLook(rule.category, rule.kind).label;
  const due = dueWhen(rule.nextDateISO, day);
  const when = !rule.active ? t('recurring.row.paused') : due.kind === 'today' || due.kind === 'due' ? t('home.upcomingRow.today')
    : due.kind === 'tomorrow' ? t('home.upcomingRow.tomorrow') : due.kind === 'soon' ? t('home.upcomingRow.inDays', { count: due.days })
      : relativeDate(rule.nextDateISO, day);
  const urgent = rule.active && (due.kind === 'today' || due.kind === 'tomorrow' || due.kind === 'due');
  const income = rule.kind === 'income';
  const stacked = useStacked(account ? { minor: income ? rule.amountMinor : -rule.amountMinor, currency: account.currency, signed: true } : undefined);
  const spoken = { merchant: rule.merchant, frequency: t(`recurring.frequencySpoken.${rule.frequency}`), category,
    amount: account ? spokenMinor(rule.amountMinor, account.currency) : '', currency: account?.currency ?? '', date: relativeDate(rule.nextDateISO, day, true) };
  return <SwipeRow actions={actions}><View style={{ borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }}>
    <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityLabel={t(rule.active ? 'recurring.row.label' : 'recurring.row.labelPaused', spoken)}
      {...swipeAccessibility(actions)}
      onPress={() => router.push({ pathname: '/edit-recurring/[id]', params: { id: rule.id } })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 64 }}>
      <MerchantBadge merchant={rule.merchant} category={rule.category} kind={rule.kind} tone={income ? 'income' : 'neutral'} />
      <View style={{ flex: 1, minWidth: 0, gap: 8, flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center' }}>
        <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 3 }}>
          <AppText numberOfLines={stacked ? undefined : 2} style={{ fontWeight: '500' }}>{rule.merchant}</AppText>
          <AppText secondary variant="footnote" numberOfLines={stacked ? undefined : 2}>{t(`recurring.frequency.${rule.frequency}`)} · {category}{account ? ' · ' + account.name : ''}</AppText>
        </View>
        <View style={{ alignItems: stacked ? 'flex-start' : 'flex-end', gap: 3, maxWidth: stacked ? '100%' : '56%' }}>
          {account && <Money minor={income ? rule.amountMinor : -rule.amountMinor} currency={account.currency} signed tone={income ? 'income' : 'expense'} />}
          <AppText variant="caption" style={{ color: urgent ? p.warning : p.secondary, fontWeight: urgent ? '600' : '400' }}>{when}</AppText>
        </View>
      </View>
    </PressFeedback>
  </View></SwipeRow>;
}
