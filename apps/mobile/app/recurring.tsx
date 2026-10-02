import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { recurringForecastByCurrency, recurringNeedsReview, type Currency, type RecurringRule } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, EmptyState, ErrorMessage, IconButton, MerchantBadge, Money, PressFeedback, Screen, SectionTitle, Stat, StatRow, Surface, useStacked } from '../src/ui/components';
import { presentedAmount } from '../src/ui/movement-amount';
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
 * registered are listed in its detail (24UX2). A row opens the rule's detail
 * (25B3: read first, Editar from there, like every other financial object); it is
 * paused, resumed or deleted with a trailing swipe or from that detail (24UX4); a
 * deleted rule leaves the list while the movements it recorded stay in Movimientos. */
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
  // 24UX6E: only rules that can still record are projected; one left active on a deleted account or card (old or imported
  // data) says «Cuenta eliminada» on its row and the catch-up skips it, so it never counts in the next 30 days.
  const forecast = useMemo(() => recurringForecastByCurrency(active.filter(rule => !manage.closed(rule)), accounts, day, 30), [active, accounts, day, manage]);

  if (!snapshot || !archive) return null;
  // 24UX6E: a rule whose account or card was deleted (25B2) names which one, on the row and on its detail.
  const closedState = (rule: RecurringRule): ClosedState => !manage.closed(rule) ? null : archive.cards?.some(item => item.accountId === rule.accountId) ? 'card' : 'account';
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
        {/* 24UX6E: flat on the canvas, one block per currency, never summed. «Gastos» has the full width: in three
            columns of a padded card a seven-digit ARS projection did not fit its third at 375 pt and was drawn smaller,
            then cut (the failure 24UX6D fixed in CardFacts). It stays a row-size figure, not a hero: a 30-day projection
            is an estimate. Ingresos only when something comes in; a projection beyond the safe range is said, never
            rounded or dropped for that currency. */}
        {!!forecast.length && <View>
          <SectionTitle>{t('recurring.list.next30')}</SectionTitle>
          <View style={{ gap: space.xl }}>
            {forecast.map(item => item.status === 'ready' ? <View key={item.currency} style={{ gap: 14 }}>
              <Stat label={withCurrencyCode(t('recurring.list.payments'), item.currency)}><Money minor={item.expenseMinor} currency={item.currency} size={22} weight="700" /></Stat>
              <StatRow>
                {item.incomeMinor > 0 && <Stat label={t('recurring.list.income')}><Money minor={item.incomeMinor} currency={item.currency} size={17} tone="income" signed /></Stat>}
                <Stat label={t('recurring.list.dueCount')}><AppText style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>{item.count}</AppText></Stat>
              </StatRow>
            </View>
              : <AppText key={item.currency} secondary>{withCurrencyCode(t('recurring.list.outOfRange'), item.currency)}</AppText>)}
          </View>
        </View>}

        {!!active.length && <View>
          <SectionTitle>{t('recurring.list.active')}</SectionTitle>
          <Surface grouped>{active.map((rule, index) => <RecurringRow key={rule.id} rule={rule} accounts={accounts} day={day} showAccount={!account}
            closed={closedState(rule)} last={index === active.length - 1} actions={manage.actions(rule)} />)}</Surface>
        </View>}

        {!!paused.length && <View>
          <SectionTitle caption={t('recurring.list.pausedCaption')}>{t('recurring.list.paused')}</SectionTitle>
          <Surface grouped>{paused.map((rule, index) => <RecurringRow key={rule.id} rule={rule} accounts={accounts} day={day} showAccount={!account}
            closed={closedState(rule)} last={index === paused.length - 1} actions={manage.actions(rule)} />)}</Surface>
        </View>}
      </>}
  </Screen>;
}

/** `account` or `card` when the rule's account or card was deleted (25B2), otherwise null. */
type ClosedState = 'account' | 'card' | null;

/** One rule (24UX2): who is paid (the typed name, with its mark), then how often and what for (frequency ·
 * category · account); on the right the amount and when it is next due, or that it is paused. The date appears
 * once. A paused rule keeps full-contrast ink (it was drawn at 60 % opacity, below AA for its caption) and says
 * «Pausado» where the due day would be, in its caption and in its VoiceOver sentence. Pause/resume and delete are
 * trailing swipe actions (24UX4, replacing the row's switch), and VoiceOver custom actions on the same row.
 * 24UX5: an active rule the catch-up set aside (its next date is already past) says «Revisar» in amber where the day
 * would be, never «Hoy»: its detail explains and offers to continue from today. 25B3: the row opens the detail, and
 * VoiceOver hears the rule itself («Alquiler, mensual, …») with a hint that it opens details, never «Editar».
 * 24UX6E: a rule on a deleted account or card says «Cuenta eliminada» / «Tarjeta eliminada» there instead of a bare
 * «Pausado» (its swipe offers Eliminar only), calm, never amber. Amber «Hoy» / «Mañana» marks an expense only: an
 * income due tomorrow is not an obligation. Opened for one account (the header names it), the caption leaves the
 * account out. */
function RecurringRow({ rule, accounts, day, last, actions, closed = null, showAccount = true }: {
  rule: RecurringRule; accounts: { id: string; name: string; currency: Currency }[]; day: string; last: boolean; actions: SwipeAction[];
  closed?: ClosedState; showAccount?: boolean;
}) {
  const p = usePalette();
  const { t, relativeDate, spokenMinor } = useI18n();
  const account = accounts.find(item => item.id === rule.accountId);
  const category = useCategoryLook(rule.category, rule.kind).label;
  const due = dueWhen(rule.nextDateISO, day);
  const review = !closed && recurringNeedsReview(rule, day);
  const when = closed ? t(closed === 'card' ? 'recurring.row.closedCard' : 'recurring.row.closed')
    : !rule.active ? t('recurring.row.paused') : review ? t('recurring.row.review') : due.kind === 'today' ? t('home.upcomingRow.today')
      : due.kind === 'tomorrow' ? t('home.upcomingRow.tomorrow') : due.kind === 'soon' ? t('home.upcomingRow.inDays', { count: due.days })
        : relativeDate(rule.nextDateISO, day);
  const urgent = !closed && rule.active && (review || (rule.kind === 'expense' && (due.kind === 'today' || due.kind === 'tomorrow')));
  const income = rule.kind === 'income';
  const stacked = useStacked(account ? { minor: rule.amountMinor, currency: account.currency, signed: presentedAmount(rule.kind, rule.amountMinor).signed } : undefined);
  // 24UX6C: the row shows no sign on an expense, so VoiceOver names the kind («gasto», «ingreso»), as a movement row does.
  const spoken = { merchant: rule.merchant, kind: t(income ? 'movement.incomeWord' : 'movement.expenseWord'), frequency: t(`recurring.frequencySpoken.${rule.frequency}`), category,
    amount: account ? spokenMinor(rule.amountMinor, account.currency) : '', currency: account?.currency ?? '', date: relativeDate(rule.nextDateISO, day, true), state: closed ? when : '' };
  // 24UX6E: a closed rule's label carries the word its row shows («Tarjeta eliminada»), never a vaguer «cuenta o tarjeta».
  const label = closed ? 'recurring.row.labelClosed' : !rule.active ? 'recurring.row.labelPaused' : review ? 'recurring.row.labelReview' : 'recurring.row.label';
  return <SwipeRow actions={actions}><View style={{ borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }}>
    <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityLabel={t(label, spoken)}
      accessibilityHint={t('recurring.row.hint')} {...swipeAccessibility(actions)}
      onPress={() => router.push({ pathname: '/recurring/[id]', params: { id: rule.id } })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 64 }}>
      <MerchantBadge merchant={rule.merchant} category={rule.category} kind={rule.kind} tone={income ? 'income' : 'neutral'} />
      <View style={{ flex: 1, minWidth: 0, gap: 8, flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center' }}>
        <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 3 }}>
          <AppText numberOfLines={stacked ? undefined : 2} style={{ fontWeight: '500' }}>{rule.merchant}</AppText>
          <AppText secondary variant="footnote" numberOfLines={stacked ? undefined : 2}>{t(`recurring.frequency.${rule.frequency}`)} · {category}{account && showAccount ? ' · ' + account.name : ''}</AppText>
        </View>
        <View style={{ alignItems: stacked ? 'flex-start' : 'flex-end', gap: 3, maxWidth: stacked ? '100%' : '56%' }}>
          {/* 24UX6C: the rule's kind is explicit, so the amount is shown as stored: «+» on an income, no sign on an expense. */}
          {account && <Money minor={rule.amountMinor} currency={account.currency} signed={presentedAmount(rule.kind, rule.amountMinor).signed} tone={rule.kind} />}
          <AppText variant="caption" style={{ color: urgent ? p.warning : p.secondary, fontWeight: urgent ? '600' : '400' }}>{when}</AppText>
        </View>
      </View>
    </PressFeedback>
  </View></SwipeRow>;
}
