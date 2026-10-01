import { useEffect, useMemo, useRef, useState } from 'react';
import { View, useWindowDimensions, type ScrollView } from 'react-native';
import { router, Stack } from 'expo-router';
import { cardStatementActivity, liabilityActivity } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, EmptyState, IconButton, MovementRow, Screen, SectionTitle, Surface } from '../src/ui/components';
import { useI18n } from '../src/i18n/provider';
import { CardDeck, cardFaceHeight, cardFaceWidth } from '../src/ui/card-visual';
import { CardStatusBlock } from '../src/ui/card-panel';
import { ArchivedCardRow, FutureInstallmentsRow } from '../src/ui/card-rows';
import { activeCards, archivedCards, cardCurrenciesDiffer, cardFaceColor, statementCaption, type CardSummary } from '../src/ui/liability-presentation';
import { Reflow, ValueTransition } from '../src/ui/motion';
import { mergeActivity } from '../src/ui/presentation';
import { deckExposure, deckScrollTarget } from '../src/ui/geometry';
import { space, useCurrentDay, useReduceMotion } from '../src/ui/theme';

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
  // The deck's box, and its top inside the scrolled content (so the scroll offset follows from two window measurements).
  const scroll = useRef<ScrollView>(null), deckBox = useRef<View>(null), deckY = useRef(0);
  const reduced = useReduceMotion();
  const { width: windowWidth, fontScale } = useWindowDimensions();
  if (!snapshot || !archive) return null;
  const selected = cards.find(card => card.id === selectedId) ?? cards[0];
  const showCurrency = cardCurrenciesDiffer(archive.cards, snapshot.accounts);
  const open = (id: string) => router.push({ pathname: '/card/[id]', params: { id } });
  const add = () => router.push('/new-card');
  // With many cards the chosen one lands far down the deck (every other card keeps its strip above it): when it would land
  // below the visible area, the page brings it and the start of its snapshot into view (at once with Reduce Motion).
  const choose = (id: string) => {
    setSelectedId(id);
    const view = scroll.current, deck = deckBox.current, frame = view?.getNativeScrollRef();
    if (!view || !deck || !frame) return;
    deck.measureInWindow((_x, deckTop) => frame.measureInWindow((_fx, viewportTop, _width, viewportHeight) => {
      // The content's top on screen is the deck's minus the deck's place in it; the offset is how far that is above the viewport.
      const target = deckScrollTarget({ count: cards.length, exposure: deckExposure(fontScale, cards.length), faceHeight: cardFaceHeight(cardFaceWidth(windowWidth)),
        deckTop, viewportTop, viewportHeight, contentOffset: viewportTop - (deckTop - deckY.current) });
      if (target !== null) view.scrollTo({ y: target, animated: !reduced });
    }));
  };

  return <Screen gap={space.xxl} scrollRef={scroll}>
    <Stack.Screen options={{ title: t('nav.titles.cards'), headerRight: () => <IconButton name="add" label={t('cards.list.add')} onPress={add} /> }} />
    {selected ? <View ref={deckBox} onLayout={event => { deckY.current = event.nativeEvent.layout.y; }} style={{ gap: space.xl }}>
      <CardDeck selectedId={selected.id} onSelect={choose} onOpen={open} showCurrency={showCurrency}
        cards={cards.map(summary => ({ id: summary.id, name: summary.account.name, issuer: summary.card.issuer, last4: summary.card.last4,
          currency: summary.account.currency, color: cardFaceColor(summary.card, archive.appearances) }))} />
      <CardSnapshot summary={selected} day={day} onOpen={open} />
    </View>
      // Without an active card: the invitation, or (with archived cards only) a short one above them.
      : <EmptyState title={t(archived.length ? 'cards.list.noActiveTitle' : 'cards.list.emptyTitle')} icon="card-outline"
        detail={t(archived.length ? 'cards.list.noActiveDetail' : 'cards.list.emptyDetail')}
        action={<ActionButton label={t('cards.list.add')} icon="add-outline" onPress={add} />} />}
    {/* Under the snapshot, whose height follows the selected card: it slides into place instead of jumping. */}
    {archived.length > 0 && <Reflow>
      <SectionTitle caption={t('cards.archived.caption')}>{t('cards.archived.title')}</SectionTitle>
      <Surface grouped>
        {archived.map((summary, index) => <ArchivedCardRow key={summary.id} summary={summary} color={cardFaceColor(summary.card, archive.appearances)}
          onPress={() => open(summary.id)} last={index === archived.length - 1} />)}
      </Surface>
    </Reflow>}
  </Screen>;
}

/** The selected card's snapshot, in the order of 24T1C: its balance; the next due and closing dates and what is
 * available; Registrar compra over Pagar tarjeta; the future instalments beside the balance, never inside it; the
 * latest movements with the open cycle's facts. The structure stays mounted across cards and the values crossfade
 * (ValueTransition keyed by the card); a block only some cards have (their future instalments, a balance in credit, the
 * usage bar) changes the height, so each block under it slides into place (Reflow) and the future instalments fade in or
 * out, after the screen's first render. With Reduce Motion the blocks move at once and only the fades remain.
 *
 * 24UX6D (Forest): one weight per level. The balance and the facts are one calm block flat on the canvas (no surface:
 * the card face above is the object); the actions; one grouped surface for the future instalments; the latest movements
 * in their grouped list under a quiet «Ver todos», as Inicio's sections read. Only the selected card feeds it. */
function CardSnapshot({ summary, day, onOpen }: { summary: CardSummary; day: string; onOpen: (id: string) => void }) {
  const { snapshot, archive } = useLedger();
  const { t, relativeDate } = useI18n();
  const { card, account, debtMinor, committedMinor } = summary;
  // The screen's first render animates nothing (the push already did); only a change of card does.
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; }, []);
  const statement = useMemo(() => snapshot ? cardStatementActivity(card, snapshot, day, archive?.cardCycleDates) : null, [card, snapshot, day, archive?.cardCycleDates]);
  const recent = useMemo(() => {
    if (!snapshot) return [];
    const activity = liabilityActivity(account.id, snapshot);
    return mergeActivity(activity.entries, activity.transfers).slice(0, 4);
  }, [snapshot, account.id]);
  if (!snapshot) return null;
  // A day inside the cycle sentence starts in lower case: "Este ciclo, desde ayer".
  const inline = (iso: string) => relativeDate(iso, day, true);
  return <View style={{ gap: space.xl }}>
    <CardStatusBlock summary={summary} day={day} animated />

    {/* Primary above secondary, same width and height: hierarchy by fill, not by geometry. */}
    <Reflow style={{ gap: 10 }}>
      <ActionButton label={t('cards.panel.recordPurchase')} icon="cart-outline"
        onPress={() => router.push({ pathname: '/new-entry', params: { accountId: account.id, kind: 'expense' } })} />
      <ActionButton label={t('cards.panel.pay')} icon="arrow-forward-outline" secondary tone="transfer" disabled={debtMinor === 0}
        onPress={() => router.push({ pathname: '/new-transfer', params: { toAccountId: account.id, maxAmountMinor: String(debtMinor) } })} />
    </Reflow>

    {(committedMinor === null || summary.committedFinancingMinor === null || committedMinor > 0) && <Reflow fade={mounted.current}><ValueTransition id={card.id} variant="fade"><Surface grouped>
      <FutureInstallmentsRow committedMinor={committedMinor} financingMinor={summary.committedFinancingMinor} financingKind={summary.financingKind}
        planCount={summary.futurePlanCount} currency={account.currency} onPress={() => onOpen(card.id)} />
    </Surface></ValueTransition></Reflow>}

    <Reflow><ValueTransition id={card.id} variant="fade">
      <SectionTitle quiet action={t('common.seeAll')} onAction={() => onOpen(card.id)}
        caption={statement ? statementCaption(statement, inline, t) : undefined}>{t('cards.panel.recent')}</SectionTitle>
      {recent.length ? <Surface grouped>
        {recent.map((item, index) => <MovementRow key={item.key} item={item} accounts={snapshot.accounts} accountId={account.id} context="card" last={index === recent.length - 1} />)}
      </Surface> : <AppText secondary variant="subhead">{t('cards.panel.noActivity')}</AppText>}
    </ValueTransition></Reflow>
  </View>;
}
