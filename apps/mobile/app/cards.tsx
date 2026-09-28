import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, Stack } from 'expo-router';
import { cardStatementActivity, liabilityActivity } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, EmptyState, IconButton, MovementRow, Screen, SectionTitle, Surface } from '../src/ui/components';
import { useI18n } from '../src/i18n/provider';
import { CardDeck } from '../src/ui/card-visual';
import { CardBalance, CardFacts } from '../src/ui/card-panel';
import { ArchivedCardRow, FutureInstallmentsRow } from '../src/ui/card-rows';
import { activeCards, archivedCards, cardCurrenciesDiffer, cardFaceColor, statementCaption, type CardSummary } from '../src/ui/liability-presentation';
import { ValueTransition } from '../src/ui/motion';
import { mergeActivity } from '../src/ui/presentation';
import { space, useCurrentDay } from '../src/ui/theme';

/** Tarjetas is only credit cards (24T2): a deck of the active cards, the snapshot of the selected one right under it
 * (its balance, its next due and closing dates, what is available, the two actions, its future instalments and its
 * latest movements), and the archived cards at the end, still payable. Reached from Más → Finanzas → Tarjetas; the
 * "+" stays in its header. Personal debts and receivables are a different obligation and live under Más → Deudas y cobros. */
export default function CardsScreen() {
  const { archive, snapshot } = useLedger();
  const { t } = useI18n();
  const day = useCurrentDay();
  const cards = useMemo(() => snapshot ? activeCards(archive?.cards, snapshot, day, archive?.installmentPlans, archive?.records, archive?.cardCycleDates) : [],
    [archive?.cards, archive?.installmentPlans, archive?.records, archive?.cardCycleDates, snapshot, day]);
  const archived = useMemo(() => snapshot ? archivedCards(archive?.cards, snapshot, day, archive?.installmentPlans, archive?.records, archive?.cardCycleDates) : [],
    [archive?.cards, archive?.installmentPlans, archive?.records, archive?.cardCycleDates, snapshot, day]);
  // The selection is a card, not a position: a card that leaves the deck (archived, deleted) hands the front to the first one.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!snapshot || !archive) return null;
  const selected = cards.find(card => card.id === selectedId) ?? cards[0];
  const showCurrency = cardCurrenciesDiffer(archive.cards, snapshot.accounts);
  const open = (id: string) => router.push({ pathname: '/card/[id]', params: { id } });
  const add = () => router.push('/new-card');

  return <Screen gap={space.xxl}>
    <Stack.Screen options={{ title: t('nav.titles.cards'), headerRight: () => <IconButton name="add" label={t('cards.list.add')} onPress={add} /> }} />
    {selected ? <View style={{ gap: space.xl }}>
      <CardDeck selectedId={selected.id} onSelect={setSelectedId} onOpen={open} showCurrency={showCurrency}
        cards={cards.map(summary => ({ id: summary.id, name: summary.account.name, issuer: summary.card.issuer, last4: summary.card.last4,
          currency: summary.account.currency, color: cardFaceColor(summary.card, archive.appearances) }))} />
      <CardSnapshot summary={selected} day={day} onOpen={open} />
    </View>
      // Without an active card: the invitation, or (with archived cards only) a short one above them.
      : <EmptyState title={t(archived.length ? 'cards.list.noActiveTitle' : 'cards.list.emptyTitle')} icon="card-outline"
        detail={t(archived.length ? 'cards.list.noActiveDetail' : 'cards.list.emptyDetail')}
        action={<ActionButton label={t('cards.list.add')} icon="add-outline" onPress={add} />} />}
    {archived.length > 0 && <View>
      <SectionTitle caption={t('cards.archived.caption')}>{t('cards.archived.title')}</SectionTitle>
      <Surface grouped>
        {archived.map((summary, index) => <ArchivedCardRow key={summary.id} summary={summary} color={cardFaceColor(summary.card, archive.appearances)}
          onPress={() => open(summary.id)} last={index === archived.length - 1} />)}
      </Surface>
    </View>}
  </Screen>;
}

/** The selected card's snapshot, in the order of 24T1C: its balance; the next due and closing dates and what is
 * available; Registrar compra over Pagar tarjeta; the future instalments beside the balance, never inside it; the
 * latest movements with the open cycle's facts. The structure stays mounted across cards; only the values crossfade
 * (ValueTransition keyed by the card), so nothing below jumps while the deck moves. */
function CardSnapshot({ summary, day, onOpen }: { summary: CardSummary; day: string; onOpen: (id: string) => void }) {
  const { snapshot, archive } = useLedger();
  const { t, relativeDate } = useI18n();
  const { card, account, debtMinor, committedMinor } = summary;
  const statement = useMemo(() => snapshot ? cardStatementActivity(card, snapshot, day, archive?.cardCycleDates) : null, [card, snapshot, day, archive?.cardCycleDates]);
  const recent = useMemo(() => {
    if (!snapshot) return [];
    const activity = liabilityActivity(account.id, snapshot);
    return mergeActivity(activity.entries, activity.transfers).slice(0, 4);
  }, [snapshot, account.id]);
  if (!snapshot) return null;
  // A day inside the cycle sentence starts in lower case: "Ciclo abierto desde ayer".
  const inline = (iso: string) => relativeDate(iso, day, true);
  return <View style={{ gap: space.xl }}>
    <ValueTransition id={card.id}><CardBalance summary={summary} /></ValueTransition>

    <ValueTransition id={card.id} variant="fade"><Surface><CardFacts summary={summary} day={day} /></Surface></ValueTransition>

    {/* Primary above secondary, same width and height: hierarchy by fill, not by geometry. */}
    <View style={{ gap: 10 }}>
      <ActionButton label={t('cards.panel.recordPurchase')} icon="cart-outline"
        onPress={() => router.push({ pathname: '/new-entry', params: { accountId: account.id, kind: 'expense' } })} />
      <ActionButton label={t('cards.panel.pay')} icon="arrow-forward-outline" secondary tone="transfer" disabled={debtMinor === 0}
        onPress={() => router.push({ pathname: '/new-transfer', params: { toAccountId: account.id, maxAmountMinor: String(debtMinor) } })} />
    </View>

    {committedMinor > 0 && <ValueTransition id={card.id} variant="fade"><Surface grouped>
      <FutureInstallmentsRow committedMinor={committedMinor} planCount={summary.futurePlanCount} currency={account.currency} onPress={() => onOpen(card.id)} />
    </Surface></ValueTransition>}

    <ValueTransition id={card.id} variant="fade">
      <SectionTitle action={t('cards.panel.seeAll')} onAction={() => onOpen(card.id)}
        caption={statement ? statementCaption(statement, inline, t) : undefined}>{t('cards.panel.recent')}</SectionTitle>
      {recent.length ? <Surface grouped>
        {recent.map((item, index) => <MovementRow key={item.key} item={item} accounts={snapshot.accounts} accountId={account.id} context="card" last={index === recent.length - 1} />)}
      </Surface> : <AppText secondary variant="subhead">{t('cards.panel.noActivity')}</AppText>}
    </ValueTransition>
  </View>;
}
