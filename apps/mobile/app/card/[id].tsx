import { useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { cardStatementActivity, liabilityActivity } from '@finanzapp/domain';
import { useI18n } from '../../src/i18n/provider';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, EmptyState, IconButton, Screen, SectionTitle, Surface } from '../../src/ui/components';
import { CardFace, cardFaceWidth } from '../../src/ui/card-visual';
import { CardBalance, CardFacts } from '../../src/ui/card-panel';
import { PlanRow } from '../../src/ui/card-rows';
import { EntryList } from '../../src/ui/entry-list';
import { cardPlanSummaries } from '../../src/ui/installment-presentation';
import { cardCurrenciesDiffer, cardFaceColor, statementCaption, summarizeCard } from '../../src/ui/liability-presentation';
import { space, useCurrentDay } from '../../src/ui/theme';

/** One card, in the language of Tarjetas (24T2): its face, its state when it is archived or deleted, the balance, the
 * next due and closing dates and what is available (with the limit), the actions it still takes, its instalment plans
 * and every movement with the open cycle's facts. No card within a card, no detail table: the issuer and the last four
 * digits are on the face. An archived card is still paid; a deleted one only reads. */
export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive, snapshot } = useLedger();
  const day = useCurrentDay();
  const { t, relativeDate, moneyText } = useI18n();
  const { width } = useWindowDimensions();
  const card = archive?.cards?.find(item => item.id === id);
  const summary = useMemo(() => card && snapshot ? summarizeCard(card, snapshot, day, archive?.installmentPlans, archive?.records, archive?.cardCycleDates) : null,
    [card, snapshot, day, archive?.installmentPlans, archive?.records, archive?.cardCycleDates]);
  const statement = useMemo(() => card && snapshot ? cardStatementActivity(card, snapshot, day, archive?.cardCycleDates) : null, [card, snapshot, day, archive?.cardCycleDates]);
  const activity = useMemo(() => summary && snapshot ? liabilityActivity(summary.account.id, snapshot) : { entries: [], transfers: [] }, [summary, snapshot]);
  const plans = useMemo(() => card ? cardPlanSummaries(card.id, archive?.installmentPlans, archive?.records) : [], [card, archive?.installmentPlans, archive?.records]);

  if (!snapshot || !archive || !card || !summary || !statement) return <Screen>
    <EmptyState title={t('cards.panel.notFoundTitle')} detail={t('cards.panel.notFoundDetail')} icon="card-outline" />
  </Screen>;
  const { account, debtMinor, committedMinor } = summary;
  // A day inside the cycle sentence starts in lower case: "Ciclo abierto desde ayer".
  const inline = (iso: string) => relativeDate(iso, day, true);
  const money = (minor: number) => moneyText(minor, account.currency);
  const state = card.deleted ? t('cards.panel.deletedTitle') : !card.active ? t('cards.panel.archivedTitle') : null;
  // An active card takes purchases and payments; an archived one still takes payments while something is owed; a deleted one, nothing.
  const pay = !card.deleted && (card.active || debtMinor > 0);

  return <>
    <Stack.Screen options={{ title: account.name,
      headerRight: card.deleted ? undefined : () => <IconButton name="create-outline" label={t('cards.panel.editCard')}
        onPress={() => router.push({ pathname: '/edit-card/[id]', params: { id: card.id } })} /> }} />
    <EntryList entries={activity.entries} transfers={activity.transfers} accountId={account.id} accounts={snapshot.accounts} context="card"
      header={<View style={{ gap: space.xl, paddingBottom: 4 }}>
        <View style={{ gap: space.m }}>
          <CardFace id={card.id} name={account.name} issuer={card.issuer} last4={card.last4} currency={account.currency}
            color={cardFaceColor(card, archive.appearances)} width={cardFaceWidth(width)} showCurrency={cardCurrenciesDiffer(archive.cards, snapshot.accounts, card.id)} />
          {state && <AppText secondary variant="subhead" style={{ fontWeight: '600' }}>{state}</AppText>}
        </View>
        {/* Identity (the face) → state (the balance) → the facts → primary → secondary → plans → activity. */}
        <CardBalance summary={summary} />
        <Surface><CardFacts summary={summary} day={day} limitCaption /></Surface>

        {pay && <View style={{ gap: 10 }}>
          {card.active && <ActionButton label={t('cards.panel.recordPurchase')} icon="cart-outline"
            onPress={() => router.push({ pathname: '/new-entry', params: { accountId: account.id, kind: 'expense' } })} />}
          {pay && <ActionButton label={t('cards.panel.pay')} icon="arrow-forward-outline" secondary tone="transfer" disabled={debtMinor === 0}
            onPress={() => router.push({ pathname: '/new-transfer', params: { toAccountId: account.id, maxAmountMinor: String(debtMinor) } })} />}
        </View>}

        {plans.length > 0 && <View>
          <SectionTitle caption={committedMinor > 0 ? t('cards.panel.plansCaption', { amount: money(committedMinor) }) : undefined}>{t('cards.panel.plans')}</SectionTitle>
          <Surface grouped>
            {plans.map((plan, index) => <PlanRow key={plan.plan.id} summary={plan} last={index === plans.length - 1}
              onPress={() => router.push({ pathname: '/installment/[id]', params: { id: plan.plan.id } })} />)}
          </Surface>
        </View>}

        <SectionTitle caption={statementCaption(statement, inline, t) + (statement.refundsMinor > 0 ? t('cards.panel.refunds', { amount: money(statement.refundsMinor) }) : '')}>{t('cards.panel.movements')}</SectionTitle>
      </View>}
      empty={<AppText secondary variant="subhead">{t('cards.panel.noActivity')}</AppText>} />
  </>;
}
