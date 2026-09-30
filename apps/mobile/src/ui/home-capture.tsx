import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Currency } from '@finanzapp/domain';
import { AppText, PressFeedback, toneColors, useStacked, type IconName } from './components';
import { BottomSheet } from './form-controls';
import { space, usePalette, type Palette } from './theme';
import { useI18n } from '../i18n/provider';
import type { MessageKey } from '../i18n/messages';

/** Producto 24UX6A: Inicio's one way to record, in place of the three movement pills and the wide Assistant entry. One
 * filled capsule, «＋ Registrar», the screen's only call to action, under the number it changes; it opens a compact sheet
 * (the date wheel's card: it rises from the bottom edge, fades in place under Reduce Motion, keeps VoiceOver inside) with
 * the four ways to record: an expense, an income, a transfer, or talking to the Assistant. Each row opens exactly the
 * screen the old controls opened, once the sheet has left (a screen presented while the sheet is still leaving would be
 * refused). The Assistant stays the centre tab: this is a shortcut to it, and it still only proposes drafts the person
 * confirms. Nothing here writes. */

export type CaptureChoice = 'expense' | 'income' | 'transfer' | 'assistant';
export const CAPTURE_CHOICES: readonly CaptureChoice[] = ['expense', 'income', 'transfer', 'assistant'];

/** Where each choice goes, as the old controls sent it: a movement preselects `movementCurrency` (only when an account
 * holds it), the Assistant receives the currency Inicio shows. */
export function captureDestination(choice: CaptureChoice, movementCurrency?: Currency, assistantCurrency?: Currency):
  { method: 'push' | 'navigate'; pathname: string; params: Record<string, string> } {
  const currency: Record<string, string> = movementCurrency ? { currency: movementCurrency } : {};
  if (choice === 'expense') return { method: 'push', pathname: '/new-entry', params: { kind: 'expense', ...currency } };
  if (choice === 'income') return { method: 'push', pathname: '/new-entry', params: { kind: 'income', ...currency } };
  if (choice === 'transfer') return { method: 'push', pathname: '/new-transfer', params: {} };
  // The centre tab, never a stacked copy of the conversation.
  return { method: 'navigate', pathname: '/assistant', params: assistantCurrency ? { currency: assistantCurrency } : {} };
}

const LOOKS: Record<CaptureChoice, { icon: IconName; title: MessageKey; detail?: MessageKey }> = {
  expense: { icon: 'remove', title: 'home.capture.expense' },
  income: { icon: 'add', title: 'home.capture.income' },
  transfer: { icon: 'swap-horizontal', title: 'home.capture.transfer' },
  assistant: { icon: 'sparkles', title: 'home.capture.assistant', detail: 'home.capture.assistantDetail' },
};

/** The glyph's colours: the movement's meaning (expense coral, income green, transfer azure), the brand for the Assistant. */
function captureColors(p: Palette, choice: CaptureChoice): { color: string; soft: string } {
  return choice === 'assistant' ? { color: p.primary, soft: p.primarySoft } : toneColors(p, choice);
}

export function CaptureButton({ movementCurrency, assistantCurrency }: { movementCurrency?: Currency; assistantCurrency?: Currency }) {
  const p = usePalette();
  const { t } = useI18n();
  const stacked = useStacked();
  const [open, setOpen] = useState(false);
  // The row chosen while the sheet leaves; opened once it is gone. A cancel clears it. While a choice waits, the button does
  // not reopen the sheet: the chosen screen is on its way.
  const chosen = useRef<CaptureChoice | null>(null);
  const choose = (choice: CaptureChoice) => { chosen.current = choice; setOpen(false); };
  const cancel = () => { chosen.current = null; setOpen(false); };
  const openChosen = () => {
    const choice = chosen.current;
    chosen.current = null;
    if (!choice) return;
    const { method, pathname, params } = captureDestination(choice, movementCurrency, assistantCurrency);
    if (method === 'navigate') router.navigate({ pathname, params });
    else router.push({ pathname, params });
  };
  return <>
    <PressFeedback accessibilityRole="button" accessibilityLabel={t('home.capture.label')} accessibilityHint={t('home.capture.hint')}
      onPress={() => { if (!chosen.current) setOpen(true); }} containerStyle={{ alignSelf: stacked ? 'stretch' : 'flex-start' }}>
      <View style={[styles.button, { backgroundColor: p.primaryFill }]}>
        <Ionicons name="add" size={21} color={p.onPrimary} accessible={false} />
        <AppText accessible={false} variant="headline" style={{ color: p.onPrimary }}>{t('home.capture.button')}</AppText>
      </View>
    </PressFeedback>
    <BottomSheet visible={open} title={t('home.capture.title')} onClose={cancel} onDismissed={openChosen}>
      <View style={styles.rows}>
        {CAPTURE_CHOICES.map((choice, index) => <CaptureRow key={choice} choice={choice} last={index === CAPTURE_CHOICES.length - 1} onPress={() => choose(choice)} />)}
      </View>
    </BottomSheet>
  </>;
}

function CaptureRow({ choice, last, onPress }: { choice: CaptureChoice; last: boolean; onPress: () => void }) {
  const p = usePalette();
  const { t } = useI18n();
  const look = LOOKS[choice];
  const { color, soft } = captureColors(p, choice);
  const title = t(look.title), detail = look.detail ? t(look.detail) : null;
  return <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityLabel={detail ? title + ', ' + detail : title} onPress={onPress}
    style={[styles.row, { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
    <View accessible={false} style={[styles.tile, { backgroundColor: soft }]}><Ionicons name={look.icon} size={19} color={color} accessible={false} /></View>
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <AppText accessible={false} style={{ fontWeight: '600' }}>{title}</AppText>
      {!!detail && <AppText accessible={false} secondary variant="footnote">{detail}</AppText>}
    </View>
    <Ionicons name="chevron-forward" size={15} color={p.tertiary} accessible={false} />
  </PressFeedback>;
}

const styles = StyleSheet.create({
  button: { minHeight: 50, borderRadius: 25, paddingHorizontal: space.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  rows: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, minHeight: 60 },
  tile: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
