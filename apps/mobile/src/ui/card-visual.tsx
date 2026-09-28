import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { Currency, LegacyCurrency } from '@finanzapp/domain';
import type { I18n } from '../i18n/bind';
import type { MessageKey } from '../i18n/messages';
import { useI18n } from '../i18n/provider';
import { cardFaceTone } from './card-faces';
import { DECK_MAX_TEXT_SCALE, deckExposure, deckLayout } from './geometry';
import { duration, easeOut, selectionHaptic, timing } from './motion';
import { radius, space, usePalette, useReduceMotion } from './theme';

/** The ID-1 card ratio. */
export const CARD_ASPECT = 1.586;
export function cardFaceHeight(width: number): number {
  return Math.round(width / CARD_ASPECT);
}
/** A face spans the screen's content width, up to 420 pt on a large screen. */
export function cardFaceWidth(windowWidth: number): number {
  return Math.min(windowWidth - space.xl * 2, 420);
}

/** The words VoiceOver has always said for a card in ARS or USD, a lookup keyed by code; any other currency is read by
 * CLDR's plural name, and a legacy word another held currency shares gives way to the full name (`currencyUnit`). */
const FACE_UNIT_KEYS: { readonly [Code in LegacyCurrency]: MessageKey } = { ARS: 'cards.face.pesos', USD: 'cards.face.dollars' };

/** What a face shows: the card's FinanzApp name, its issuer and last four digits (both optional), its currency and, when
 * the person chose one in Editar cuenta, the colour of its hidden account (`color`, an appearance colour id). */
export type CardFaceData = { id: string; name: string; issuer: string; last4: string; currency: Currency; color?: string | null };

/** The sentence VoiceOver says for a face: «Tarjeta Visa Gold, Galicia, termina en 4009, pesos». The currency is always
 * spoken, even when the face does not print its code. */
export function cardFaceLabel(i18n: Pick<I18n, 't' | 'currencyUnit'>, face: Pick<CardFaceData, 'name' | 'issuer' | 'last4' | 'currency'>): string {
  const { t, currencyUnit } = i18n;
  const unitKey = (FACE_UNIT_KEYS as { readonly [Code in Currency]?: MessageKey })[face.currency];
  const details = [face.name, face.issuer || null, face.last4 ? t('cards.face.endsIn', { last4: face.last4 }) : null, currencyUnit(face.currency, unitKey && t(unitKey))]
    .filter(Boolean).join(', ');
  return t('cards.face.label', { details });
}

/** A card's face, identity first (24T2): its name and «•••• 4009» on the first row (the row a stacked strip of the deck
 * shows), the issuer and, only when the person holds cards in more than one currency (`showCurrency`), the ISO code
 * below. No figures, no network or bank logo, no contactless glyph: FinanzApp does not operate the card. Its text is
 * capped at the deck's scale (the strip's height depends on it) and the name gives way before the last four digits,
 * never overlapping them. Hook-free but for the locale. `decorative` hides it from VoiceOver where the element around it
 * already speaks for the card (the deck). */
export function CardFace({ id, name, issuer, last4, currency, color, width, showCurrency = true, decorative = false }: CardFaceData & {
  width: number; showCurrency?: boolean; decorative?: boolean;
}) {
  const i18n = useI18n();
  const tone = cardFaceTone(id, color);
  const height = cardFaceHeight(width);
  return <View accessible={!decorative} accessibilityRole="image" accessibilityLabel={decorative ? undefined : cardFaceLabel(i18n, { name, issuer, last4, currency })}
    accessibilityElementsHidden={decorative} importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'} accessibilityLanguage={i18n.speechLanguage}
    style={[styles.face, { width, height, backgroundColor: tone.base }]}>
    <View pointerEvents="none" style={[styles.sheen, { backgroundColor: tone.highlight, width: height * 1.5, height: height * 1.5, borderRadius: height, right: -height * 0.55, top: -height * 0.75 }]} />
    <View pointerEvents="none" style={[styles.sheen, { backgroundColor: '#FFFFFF', opacity: 0.05, width: height, height, borderRadius: height, left: -height * 0.35, bottom: -height * 0.5 }]} />
    <View style={styles.faceRow}>
      <Text numberOfLines={1} maxFontSizeMultiplier={DECK_MAX_TEXT_SCALE} style={styles.name}>{name}</Text>
      {!!last4 && <Text numberOfLines={1} maxFontSizeMultiplier={DECK_MAX_TEXT_SCALE} style={styles.last4}>{'•••• ' + last4}</Text>}
    </View>
    <View style={[styles.faceRow, { alignItems: 'flex-end' }]}>
      <Text numberOfLines={1} maxFontSizeMultiplier={DECK_MAX_TEXT_SCALE} style={styles.issuer}>{issuer.toUpperCase()}</Text>
      {showCurrency && <View style={styles.chip}><Text maxFontSizeMultiplier={DECK_MAX_TEXT_SCALE} style={styles.chipText}>{currency}</Text></View>}
    </View>
  </View>;
}

/** Tarjetas' deck (24T2), in place of the horizontal carousel: every card is a whole face; the ones not selected stay
 * stacked above the selected one in their stored order, each showing only its top strip; the selected card sits in front
 * at the bottom, whole, right above the snapshot that describes it. Tapping a strip selects that card (one selection
 * haptic); tapping the card in front opens its detail. No horizontal or drag gesture, so nothing competes with the back
 * swipe. Each card moves to its place on the UI thread (`timing('data')`, 260 ms ease-out, interruptible); with Reduce
 * Motion the cards jump there and only the snapshot below crossfades. The cards stay in their stored order in the view
 * tree, one VoiceOver element each (a button with the face's sentence, its position and whether it is the selected
 * one), and each touch target is only what shows of it: the strip (50 pt at least) or the whole front face. */
export function CardDeck({ cards, selectedId, onSelect, onOpen, showCurrency = true }: {
  cards: readonly CardFaceData[]; selectedId: string | null; onSelect: (id: string) => void; onOpen: (id: string) => void; showCurrency?: boolean;
}) {
  const i18n = useI18n();
  const reduced = useReduceMotion();
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const width = cardFaceWidth(windowWidth);
  const faceHeight = cardFaceHeight(width);
  const exposure = deckExposure(fontScale);
  const selectedIndex = Math.max(0, cards.findIndex(card => card.id === selectedId));
  const layout = deckLayout(cards.length, selectedIndex, exposure, faceHeight);
  return <View style={{ width, height: layout.containerHeight, alignSelf: 'center' }}>
    {cards.map((card, index) => {
      const front = index === selectedIndex;
      const position = cards.length > 1 ? ', ' + i18n.t('cards.face.position', { index: index + 1, count: cards.length }) : '';
      return <DeckSlot key={card.id} top={layout.tops[index]} zIndex={layout.zIndex[index]} reduced={reduced} tone={cardFaceTone(card.id, card.color).base}
        hitHeight={front ? faceHeight : exposure} selected={front} label={cardFaceLabel(i18n, card) + position}
        hint={i18n.t(front ? 'cards.list.openHint' : 'cards.list.selectHint')}
        onPress={() => { if (front) onOpen(card.id); else { selectionHaptic(); onSelect(card.id); } }}>
        <CardFace {...card} width={width} showCurrency={showCurrency} decorative />
      </DeckSlot>;
    })}
  </View>;
}

/** One card of the deck: its face at `top` (animated there), layered by `zIndex`, pressed like any card (0.97; Reduce
 * Motion keeps it flat), and a touch target over the part of it that shows. */
function DeckSlot({ top, zIndex, reduced, tone, hitHeight, selected, label, hint, onPress, children }: {
  top: number; zIndex: number; reduced: boolean; tone: string; hitHeight: number; selected: boolean; label: string; hint: string; onPress: () => void; children: ReactNode;
}) {
  const p = usePalette();
  const { speechLanguage } = useI18n();
  const y = useSharedValue(top);
  const pressed = useSharedValue(0);
  useEffect(() => { y.value = withTiming(top, timing('data', reduced)); }, [top, reduced, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { scale: 1 - 0.03 * pressed.value }] }));
  // The slot carries the face's own colour and radius, so the shadow that separates a card from the one it overlaps is
  // computed from a solid shape (light mode; dark mode separates by the face's rim).
  return <Animated.View style={[styles.slot, { zIndex, backgroundColor: tone }, p.isDark ? null : styles.lift, style]}>
    {children}
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ selected }} accessibilityLanguage={speechLanguage}
      onPress={onPress} pressRetentionOffset={12}
      onPressIn={() => { pressed.value = reduced ? 0 : withTiming(1, { duration: duration.press, easing: easeOut }); }}
      onPressOut={() => { pressed.value = withTiming(0, { duration: reduced ? 0 : duration.release, easing: easeOut }); }}
      style={[styles.hit, { height: hitHeight }]} />
  </Animated.View>;
}

const styles = StyleSheet.create({
  face: { borderRadius: radius.creditCard, paddingHorizontal: 18, paddingVertical: 16, overflow: 'hidden', justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)' },
  sheen: { position: 'absolute', opacity: 0.35 },
  faceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  name: { color: '#FFFFFF', fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2, flexShrink: 1 },
  last4: { color: 'rgba(255,255,255,0.9)', fontSize: 15, lineHeight: 22, fontWeight: '500', letterSpacing: 1, fontVariant: ['tabular-nums'], flexShrink: 0 },
  issuer: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '600', letterSpacing: 1.1, flexShrink: 1 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.14)' },
  chipText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  slot: { position: 'absolute', top: 0, left: 0, borderRadius: radius.creditCard },
  lift: { shadowColor: '#0A0A0C', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: -2 } },
  hit: { position: 'absolute', top: 0, left: 0, right: 0 },
});
