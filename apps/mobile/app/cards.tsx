import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, Stack } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { cardStatementActivity, liabilityActivity } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, EmptyState, IconButton, Money, MovementRow, Screen, SectionTitle, Stat, Surface, toneColors, StatRow } from '../src/ui/components';
import { withCurrencyCode } from '../src/i18n/format';
import { useI18n } from '../src/i18n/provider';
import { CardCarousel, CardFace } from '../src/ui/card-visual';
import { activeCards, daysUntil, statementCaption, usageTone, type CardSummary } from '../src/ui/liability-presentation';
import { ValueTransition, timing } from '../src/ui/motion';
import { mergeActivity } from '../src/ui/presentation';
import { space, useCurrentDay, usePalette, useReduceMotion } from '../src/ui/theme';

/** Tarjetas is only credit cards: the card, its recorded debt, available
 * credit, closing and due dates, purchases, payments and statement activity.
 * Reached from Más → Finanzas → Tarjetas (the centre tab went to the
 * Assistant); the "+" stays in its header. Personal debts and receivables
 * are a different obligation and live under Más → Deudas y cobros. */
export default function CardsScreen() {
  const { archive, snapshot } = useLedger();
  const { t } = useI18n();
  const day = useCurrentDay();
  const cards = useMemo(() => snapshot ? activeCards(archive?.cards, snapshot, day) : [], [archive?.cards, snapshot, day]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = cards[Math.min(selectedIndex, Math.max(0, cards.length - 1))];
  if (!snapshot || !archive) return null;

  return <Screen gap={space.xxl}>
    <Stack.Screen options={{ title: t('nav.titles.cards'), headerRight: () => <IconButton name="add" label={t('cards.list.add')} onPress={() => router.push('/new-card')} /> }} />
    {!cards.length ? <EmptyState title={t('cards.list.emptyTitle')} icon="card-outline"
      detail={t('cards.list.emptyDetail')}
      action={<ActionButton label={t('cards.list.add')} icon="add-outline" onPress={() => router.push('/new-card')} />} />
      : <>
        <View style={{ marginHorizontal: -space.xl }}>
          <CardCarousel items={cards} selectedIndex={selectedIndex} onSelect={setSelectedIndex}
            render={(item, width) => <CardFace id={item.card.id} name={item.account.name} issuer={item.card.issuer} last4={item.card.last4}
              currency={item.account.currency} width={width} accessibilityHint={t('cards.list.openHint')}
              onPress={() => router.push({ pathname: '/card/[id]', params: { id: item.card.id } })} />} />
        </View>
        {selected && <CardPanel summary={selected} day={day} />}
      </>}
  </Screen>;
}

function CardPanel({ summary, day }: { summary: CardSummary; day: string }) {
  const { snapshot } = useLedger();
  const p = usePalette();
  const { t, relativeDate, moneyText, spokenMoney } = useI18n();
  const { card, account, debtMinor, availableMinor, usage, closingISO, dueISO } = summary;
  const statement = useMemo(() => snapshot ? cardStatementActivity(card, snapshot, day) : null, [card, snapshot, day]);
  const recent = useMemo(() => {
    if (!snapshot) return [];
    const activity = liabilityActivity(account.id, snapshot);
    return mergeActivity(activity.entries, activity.transfers).slice(0, 4);
  }, [snapshot, account.id]);
  if (!snapshot) return null;
  const tone = usageTone(usage);
  const dueIn = daysUntil(dueISO, day);
  const percent = Math.round(Math.min(usage ?? 0, 9.99) * 100);
  const relative = (iso: string) => relativeDate(iso, day);
  // A day inside the statement sentence starts in lower case: "Resumen abierto desde ayer".
  const inline = (iso: string) => relativeDate(iso, day, true);
  // The panel structure stays mounted across cards; only its values crossfade,
  // so the sections below never jump to a different height mid-transition.
  return <View style={{ gap: space.xl }}>
    <ValueTransition id={card.id} style={{ gap: 6 }}>
      <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>{withCurrencyCode(t('cards.panel.recordedDebt'), account.currency)}</AppText>
      <Money minor={debtMinor} currency={account.currency} large size={40} />
      {debtMinor === 0 && <AppText secondary variant="footnote">{t('cards.panel.noDebt')}</AppText>}
    </ValueTransition>

    <ValueTransition id={card.id} variant="fade"><Surface style={{ gap: 14 }}>
      <StatRow>
        <Stat label={t('cards.panel.available')}>
          {availableMinor !== null ? <Money minor={availableMinor} currency={account.currency} size={17} color={availableMinor < 0 ? p.expense : undefined} />
            : <AppText secondary variant="subhead">{t('cards.panel.noLimitLoaded')}</AppText>}
        </Stat>
        <Stat label={t('cards.panel.closing')}><AppText style={{ fontWeight: '600' }}>{relative(closingISO)}</AppText></Stat>
        <Stat label={t('cards.panel.due')}>
          <AppText style={{ fontWeight: '600', color: dueIn <= 3 && debtMinor > 0 ? p.warning : p.text }}>{relative(dueISO)}</AppText>
        </Stat>
      </StatRow>
      {usage !== null && card.creditLimitMinor !== null && <UsageBar usage={usage} tone={tone}
        label={t('cards.panel.usage', { percent, limit: moneyText(card.creditLimitMinor, account.currency) })}
        spokenLabel={t('cards.panel.usage', { percent, limit: spokenMoney(card.creditLimitMinor, account.currency) })} />}
    </Surface></ValueTransition>

    {/* Primary above secondary, same width and height: hierarchy by fill, not by geometry. */}
    <View style={{ gap: 10 }}>
      <ActionButton label={t('cards.panel.recordPurchase')} icon="cart-outline"
        onPress={() => router.push({ pathname: '/new-entry', params: { accountId: account.id, kind: 'expense' } })} />
      <ActionButton label={t('cards.panel.pay')} icon="arrow-forward-outline" secondary tone="transfer" disabled={debtMinor === 0}
        onPress={() => router.push({ pathname: '/new-transfer', params: { toAccountId: account.id, maxAmountMinor: String(debtMinor) } })} />
    </View>

    <ValueTransition id={card.id} variant="fade">
      <SectionTitle action={t('cards.panel.seeAll')} onAction={() => router.push({ pathname: '/card/[id]', params: { id: card.id } })}
        caption={statement ? statementCaption(statement, inline, t) : undefined}>{t('cards.panel.recent')}</SectionTitle>
      {recent.length ? <Surface grouped>
        {recent.map((item, index) => <MovementRow key={item.key} item={item} accounts={snapshot.accounts} accountId={account.id} context="card" last={index === recent.length - 1} />)}
      </Surface> : <AppText secondary variant="subhead">{t('cards.panel.noActivity')}</AppText>}
    </ValueTransition>
  </View>;
}

/** The share of the limit used, as a bar and a caption. VoiceOver reads the caption as
 * `spokenLabel`: the limit with the language's decimal mark and its currency in words. */
function UsageBar({ usage, tone, label, spokenLabel }: { usage: number; tone: 'neutral' | 'warning' | 'expense'; label: string; spokenLabel: string }) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const progress = useSharedValue(Math.min(1, usage));
  useEffect(() => { progress.value = withTiming(Math.min(1, usage), timing('data', reduced)); }, [usage, reduced, progress]);
  const bar = useAnimatedStyle(() => ({ width: `${progress.value === 0 ? 0 : Math.max(1.5, progress.value * 100)}%` as `${number}%` }));
  const fill = tone === 'neutral' ? p.text : toneColors(p, tone).color;
  return <View style={{ gap: 6 }}>
    <View accessible={false} style={{ height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: p.inset }}>
      <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: fill }, bar]} />
    </View>
    <AppText secondary variant="caption" accessibilityLabel={spokenLabel} style={tone !== 'neutral' ? { color: toneColors(p, tone).color, fontWeight: '500' } : undefined}>{label}</AppText>
  </View>;
}
