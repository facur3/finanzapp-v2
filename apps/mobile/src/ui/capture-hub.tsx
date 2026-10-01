import { useRef, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Currency } from '@finanzapp/domain';
import { conversationSession, lastUserWords } from '../assistant/session';
import { useLedger } from '../storage/LedgerProvider';
import { AppText, PressFeedback, type IconName } from './components';
import { useDisplayCurrency } from './display-currency-provider';
import { DOCK, hubInset, plusFrame } from './dock-geometry';
import { BottomSheet } from './form-controls';
import { impactHaptic } from './motion';
import { availableCurrencies, historyCurrencies } from './presentation';
import { space, usePalette } from './theme';
import { useI18n } from '../i18n/provider';
import type { MessageKey } from '../i18n/messages';

/** Producto 24UX6A (decision 005): the one way to record, from anywhere in the tabs. The dock's «+» (an action beside
 * the four tabs, never a tab: no selected state, outside the tab list, not counted in «n de 4») opens the capture hub, a
 * card that floats above the dock: the Assistant first and largest (it proposes, the person confirms), then an expense,
 * an income and a transfer. Each opens exactly the screen the earlier controls opened, once the hub has left (a screen
 * presented while it is still leaving would be refused); the first choice holds while it leaves. The «+» is tap-only:
 * there is no long-press shortcut in v1. Nothing here writes. */

export type CaptureChoice = 'assistant' | 'expense' | 'income' | 'transfer';
export const CAPTURE_CHOICES: readonly CaptureChoice[] = ['assistant', 'expense', 'income', 'transfer'];

/** Where each choice goes: a movement preselects `movementCurrency` (only when a live account holds it), the Assistant
 * receives the currency Inicio and Reportes show. The Assistant is pushed over the tabs (a stack screen, not a tab), so
 * back returns to the screen where «+» was tapped. */
export function captureDestination(choice: CaptureChoice, movementCurrency?: Currency, assistantCurrency?: Currency):
  { pathname: string; params: Record<string, string> } {
  const currency: Record<string, string> = movementCurrency ? { currency: movementCurrency } : {};
  if (choice === 'expense') return { pathname: '/new-entry', params: { kind: 'expense', ...currency } };
  if (choice === 'income') return { pathname: '/new-entry', params: { kind: 'income', ...currency } };
  if (choice === 'transfer') return { pathname: '/new-transfer', params: {} };
  return { pathname: '/assistant', params: assistantCurrency ? { currency: assistantCurrency } : {} };
}

/** The three movement rows: a neutral glyph on the inset tile (the choice is the word, not a colour), title and what it covers. */
const ROWS: Record<Exclude<CaptureChoice, 'assistant'>, { icon: IconName; title: MessageKey; detail: MessageKey }> = {
  expense: { icon: 'arrow-up', title: 'home.capture.expense', detail: 'home.capture.expenseDetail' },
  income: { icon: 'arrow-down', title: 'home.capture.income', detail: 'home.capture.incomeDetail' },
  transfer: { icon: 'swap-horizontal', title: 'home.capture.transfer', detail: 'home.capture.transferDetail' },
};

/** The dock's «+» and the hub it opens. */
export function CaptureAction() {
  const p = usePalette();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { snapshot } = useLedger();
  const accounts = snapshot?.accounts ?? [];
  // The currency Inicio and Reportes show (the shared display preference): a movement is preselected in it only while a
  // live account holds it (a consolidated total may be in a currency no account holds); the Assistant receives it as is.
  const { currency } = useDisplayCurrency(historyCurrencies(accounts));
  const movementCurrency = availableCurrencies(accounts).includes(currency) ? currency : undefined;
  const [open, setOpen] = useState(false);
  // The row chosen while the hub leaves; opened once it is gone. A cancel clears it. While a choice waits, «+» does not
  // reopen the hub: the chosen screen is on its way. The first choice holds while the hub leaves (its rows stay
  // touchable for those 200 ms): a second row, the scrim or the back gesture changes nothing then (Codex, PR #70).
  const chosen = useRef<CaptureChoice | null>(null);
  const choose = (choice: CaptureChoice) => { if (chosen.current) return; chosen.current = choice; setOpen(false); };
  const cancel = () => { if (chosen.current) return; setOpen(false); };
  const openChosen = () => {
    const choice = chosen.current;
    chosen.current = null;
    if (!choice) return;
    router.push(captureDestination(choice, movementCurrency, currency));
  };
  const frame = plusFrame(insets);
  return <>
    <PressFeedback accessibilityRole="button" accessibilityLabel={t('home.capture.label')} accessibilityHint={t('home.capture.hint')}
      onPress={() => { if (chosen.current) return; impactHaptic(); setOpen(true); }} style={[styles.plus, plusMaterial(p)]}>
      <Ionicons name="add" size={30} color={p.onAccent} accessible={false} />
    </PressFeedback>
    <BottomSheet visible={open} title={t('home.capture.title')} onClose={cancel} onDismissed={openChosen} floating={hubInset(insets)}
      accessory={<PressFeedback accessibilityRole="button" accessibilityLabel={t('home.capture.close')} onPress={cancel}
        containerStyle={{ position: 'absolute', right: frame.right, bottom: frame.bottom }} style={[styles.plus, plusMaterial(p)]}>
        <Ionicons name="close" size={30} color={p.onAccent} accessible={false} />
      </PressFeedback>}>
      <AssistantTile onPress={() => choose('assistant')} />
      <View style={[styles.rows, { backgroundColor: p.surface }]}>
        {(['expense', 'income', 'transfer'] as const).map((choice, index) => <CaptureRow key={choice} choice={choice} last={index === 2} onPress={() => choose(choice)} />)}
      </View>
    </BottomSheet>
  </>;
}

/** The «+»'s material: the soft sage-mint accent, with a hairline edge and a soft lift on the light ground so it holds
 * its shape on the pale canvas (the glyph carries the contrast: 9.5:1). */
export function plusMaterial(p: ReturnType<typeof usePalette>) {
  return { backgroundColor: p.accent, borderWidth: StyleSheet.hairlineWidth, borderColor: p.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,26,22,0.14)',
    ...(p.isDark ? {} : { shadowColor: '#0F1A16', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }) };
}

/** The Assistant as the hub's first and largest choice: a pine tile (the hero's field), what it does, and, only when this
 * app session already has a conversation, the person's last words to continue from. Never an invented line. */
function AssistantTile({ onPress }: { onPress: () => void }) {
  const p = usePalette();
  const { t } = useI18n();
  const session = conversationSession();
  const { conversation } = useSyncExternalStore(session.subscribe, session.getState, session.getState);
  const previous = lastUserWords(conversation);
  const title = t('home.capture.assistant'), detail = t('home.capture.assistantDetail');
  const resume = previous ? t('home.capture.continue', { text: previous }) : null;
  // The resume line is part of the name, not a hint: hints are optional in VoiceOver, and the words are what the tile shows.
  return <PressFeedback accessibilityRole="button" accessibilityLabel={title + ', ' + (resume ?? detail)} onPress={onPress} style={[styles.tile, { backgroundColor: p.hero }]}>
    <View style={styles.tileHead}>
      <View accessible={false} style={[styles.spark, { backgroundColor: p.accent }]}><Ionicons name="sparkles" size={22} color={p.onAccent} accessible={false} /></View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText accessible={false} variant="title3" style={{ color: p.heroInk, fontWeight: '700' }}>{title}</AppText>
        <AppText accessible={false} variant="subhead" style={{ color: p.heroSecondary }}>{detail}</AppText>
      </View>
    </View>
    {resume && <View accessible={false} style={[styles.resume, { backgroundColor: p.heroControl }]}>
      <Ionicons name="time-outline" size={16} color={p.heroInk} accessible={false} />
      <AppText accessible={false} numberOfLines={1} variant="footnote" style={{ color: p.heroInk, fontWeight: '600', flexShrink: 1 }}>{resume}</AppText>
    </View>}
  </PressFeedback>;
}

function CaptureRow({ choice, last, onPress }: { choice: Exclude<CaptureChoice, 'assistant'>; last: boolean; onPress: () => void }) {
  const p = usePalette();
  const { t } = useI18n();
  const look = ROWS[choice];
  const title = t(look.title), detail = t(look.detail);
  return <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityLabel={title + ', ' + detail} onPress={onPress}
    style={[styles.row, { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
    <View accessible={false} style={[styles.rowTile, { backgroundColor: p.inset }]}><Ionicons name={look.icon} size={19} color={p.primary} accessible={false} /></View>
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <AppText accessible={false} style={{ fontWeight: '600' }}>{title}</AppText>
      <AppText accessible={false} secondary variant="footnote">{detail}</AppText>
    </View>
    <Ionicons name="chevron-forward" size={15} color={p.tertiary} accessible={false} />
  </PressFeedback>;
}

const styles = StyleSheet.create({
  plus: { width: DOCK.plus, height: DOCK.plus, minHeight: DOCK.plus, borderRadius: DOCK.plus / 2, alignItems: 'center', justifyContent: 'center' },
  tile: { borderRadius: 24, padding: space.l, gap: space.m },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  spark: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  resume: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 18, minHeight: 36, paddingHorizontal: space.m },
  rows: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, minHeight: 60 },
  rowTile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
