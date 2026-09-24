import { useMemo, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { advanceRecurringDate, formatMinorUnits, recurringOccurrencesThrough, todayKey,
  type Currency, type RecurringRule } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, CategoryBadge, EmptyState, ErrorMessage, IconButton, Money, PressFeedback, Screen, SectionTitle, Stat, StatRow, Surface, useStacked } from '../src/ui/components';
import { withCurrencyCode } from '../src/i18n/format';
import { useI18n } from '../src/i18n/provider';
import { space, useCurrentDay, usePalette } from '../src/ui/theme';

/** Recurring rules are commitments, not payments: each one posts a normal
 * movement when its date arrives. The 30-day view is a projection per currency. */
export default function RecurringScreen() {
  const { accountId } = useLocalSearchParams<{ accountId?: string }>();
  const { archive, snapshot, saveRecurring } = useLedger();
  const day = useCurrentDay();
  const { t } = useI18n();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const accounts = snapshot?.accounts ?? [];
  const allRules = archive?.recurring ?? [];
  const rules = useMemo(() => allRules
    .filter(rule => !accountId || rule.accountId === accountId)
    .sort((a, b) => Number(b.active) - Number(a.active) || a.nextDateISO.localeCompare(b.nextDateISO) || a.merchant.localeCompare(b.merchant)),
  [allRules, accountId]);
  const account = accounts.find(item => item.id === accountId);
  const active = rules.filter(rule => rule.active);
  const paused = rules.filter(rule => !rule.active);
  const forecast = useMemo(() => buildForecast(active, accounts, day), [active, accounts, day]);

  async function toggle(rule: RecurringRule) {
    if (busyId) return;
    setBusyId(rule.id);
    setToggleError(null);
    try {
      const now = new Date().toISOString();
      let nextDateISO = rule.nextDateISO;
      if (!rule.active) {
        const today = todayKey();
        while (nextDateISO < today) nextDateISO = advanceRecurringDate(nextDateISO, rule.frequency, rule.anchorDateISO);
      }
      const next = { ...rule, active: !rule.active, nextDateISO, revision: rule.revision + 1, updatedAt: now };
      await saveRecurring(next);
      void Haptics.selectionAsync().catch(() => {});
    } catch (cause) {
      setToggleError(cause instanceof Error ? cause.message : 'recurring.list.toggleFailed');
    } finally {
      setBusyId(null);
    }
  }

  if (!snapshot || !archive) return null;
  const newParams = accountId ? { accountId } : {};
  return <Screen gap={space.xxl}>
    <Stack.Screen options={{
      title: account ? account.name : t('nav.titles.recurring'),
      headerRight: () => <IconButton name="add" label={t('recurring.list.add')} onPress={() => router.push({ pathname: '/new-recurring', params: newParams })} />,
    }} />
    <ErrorMessage message={toggleError} />
    {!rules.length ? <EmptyState title={t('recurring.list.emptyTitle')}
      detail={t(account ? 'recurring.list.emptyDetailAccount' : 'recurring.list.emptyDetail')}
      icon="repeat-outline"
      action={<ActionButton label={t('recurring.list.create')} icon="add-outline" onPress={() => router.push({ pathname: '/new-recurring', params: newParams })} />} />
      : <>
        {!!forecast.length && <View>
          <SectionTitle>{t('recurring.list.next30')}</SectionTitle>
          <View style={{ gap: 10 }}>
            {forecast.map(item => <Surface key={item.currency}><StatRow>
              <Stat label={withCurrencyCode(t('recurring.list.payments'), item.currency)}><Money minor={item.expense} currency={item.currency} size={20} weight="700" /></Stat>
              <Stat label={t('recurring.list.dueCount')}><AppText style={{ fontWeight: '600' }}>{item.count}</AppText></Stat>
              <Stat label={t('recurring.list.income')}><Money minor={item.income} currency={item.currency} size={17} tone={item.income ? 'income' : 'neutral'} signed={item.income > 0} /></Stat>
            </StatRow></Surface>)}
          </View>
        </View>}

        {!!active.length && <View>
          <SectionTitle>{t('recurring.list.active')}</SectionTitle>
          <Surface grouped>{active.map((rule, index) => <RecurringRow key={rule.id} rule={rule} accounts={accounts} day={day}
            last={index === active.length - 1} busy={busyId === rule.id} onToggle={() => toggle(rule)} />)}</Surface>
        </View>}

        {!!paused.length && <View>
          <SectionTitle caption={t('recurring.list.pausedCaption')}>{t('recurring.list.paused')}</SectionTitle>
          <Surface grouped>{paused.map((rule, index) => <RecurringRow key={rule.id} rule={rule} accounts={accounts} day={day}
            last={index === paused.length - 1} busy={busyId === rule.id} onToggle={() => toggle(rule)} />)}</Surface>
        </View>}
      </>}
  </Screen>;
}

function RecurringRow({ rule, accounts, day, last, busy, onToggle }: {
  rule: RecurringRule; accounts: { id: string; name: string; currency: Currency }[]; day: string; last: boolean; busy: boolean; onToggle: () => void;
}) {
  const p = usePalette();
  const { t, relativeDate } = useI18n();
  const account = accounts.find(item => item.id === rule.accountId);
  const date = relativeDate(rule.nextDateISO, day);
  const days = Math.round((Date.parse(rule.nextDateISO + 'T12:00:00Z') - Date.parse(day + 'T12:00:00Z')) / 86400000);
  const when = !rule.active ? t('recurring.row.paused') : days <= 0 ? t('home.upcomingRow.today') : days === 1 ? t('home.upcomingRow.tomorrow')
    : t('home.upcomingRow.inDays', { count: days });
  const income = rule.kind === 'income';
  const stacked = useStacked(account ? { minor: income ? rule.amountMinor : -rule.amountMinor, currency: account.currency, signed: true } : undefined);
  return <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, opacity: rule.active ? 1 : 0.6 }}>
    <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityLabel={t('recurring.row.label', { merchant: rule.merchant, frequency: t(`recurring.frequencySpoken.${rule.frequency}`),
      amount: formatMinorUnits(rule.amountMinor), currency: account?.currency ?? '', date })}
      onPress={() => router.push({ pathname: '/edit-recurring/[id]', params: { id: rule.id } })}
      containerStyle={{ flex: 1 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 16, minHeight: 64 }}>
      <CategoryBadge category={rule.category} kind={rule.kind} tone={income ? 'income' : 'neutral'} />
      <View style={{ flex: 1, minWidth: 0, gap: 8, flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center' }}>
        <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 3 }}>
          <AppText numberOfLines={stacked ? undefined : 2} style={{ fontWeight: '500' }}>{rule.merchant}</AppText>
          <AppText secondary variant="footnote" numberOfLines={stacked ? undefined : 2}>{t(`recurring.frequency.${rule.frequency}`)} · {date}{account ? ' · ' + account.name : ''}</AppText>
        </View>
        <View style={{ alignItems: stacked ? 'flex-start' : 'flex-end', gap: 3, maxWidth: stacked ? '100%' : '56%' }}>
          {account && <Money minor={income ? rule.amountMinor : -rule.amountMinor} currency={account.currency} signed tone={income ? 'income' : 'expense'} />}
          <AppText variant="caption" style={{ color: rule.active && days <= 1 ? p.warning : p.secondary, fontWeight: rule.active && days <= 1 ? '600' : '400' }}>{when}</AppText>
        </View>
      </View>
    </PressFeedback>
    <View style={{ paddingHorizontal: 12 }}>
      <Switch value={rule.active} disabled={busy} onValueChange={onToggle}
        accessibilityLabel={t(rule.active ? 'recurring.row.pause' : 'recurring.row.activate', { merchant: rule.merchant })}
        trackColor={{ false: p.line, true: p.income }} />
    </View>
  </View>;
}

function buildForecast(rules: RecurringRule[], accounts: { id: string; currency: Currency }[], day: string) {
  const start = new Date(day + 'T12:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  const through = todayKey(end);
  const map = new Map<Currency, { expense: number; income: number; count: number }>();
  for (const rule of rules) {
    const account = accounts.find(item => item.id === rule.accountId);
    if (!account) continue;
    const occurrences = recurringOccurrencesThrough(rule, through).length;
    if (!occurrences) continue;
    const current = map.get(account.currency) ?? { expense: 0, income: 0, count: 0 };
    current[rule.kind] += rule.amountMinor * occurrences;
    current.count += occurrences;
    map.set(account.currency, current);
  }
  return [...map.entries()].map(([currency, value]) => ({ currency, ...value }));
}
