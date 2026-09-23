import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Account } from '@finanzapp/domain';
import type { AnswerContent, ClarificationOption, DraftContent, Message, SUGGESTIONS } from '../assistant/conversation';
import { draftGaps } from '../assistant/conversation';
import { AccountBadge, ActionButton, AppText, CategoryBadge, Money, PressFeedback, Surface, type IconName } from './components';
import { Appear, Reflow, selectionHaptic } from './motion';
import { activityDateLabel } from './presentation';
import { radius, space, useCurrentDay, usePalette, useReduceMotion } from './theme';

/** The conversation, visually quiet. A user message is a compact grey pill on
 * the right; the Assistant answers in plain running text on the left with no
 * container; money, categories and accounts appear through the same
 * components the rest of FinanzApp uses. Every state is also said in words
 * (a label, a footnote), never only by colour or motion. */

export function UserMessage({ text }: { text: string }) {
  const p = usePalette();
  return <View style={styles.userRow}>
    <View accessible accessibilityLabel={'Vos: ' + text} style={[styles.userBubble, { backgroundColor: p.inset }]}>
      <AppText>{text}</AppText>
    </View>
  </View>;
}

/** Streaming shows the words as they arrive, or "Pensando…" with a pulse
 * before the first one; a stopped answer says so under its partial text. */
export function AssistantText({ text, status }: { text: string; status: 'streaming' | 'done' | 'stopped' }) {
  if (!text && status === 'streaming') return <Thinking />;
  return <View accessible accessibilityLabel={'Asistente: ' + text} style={styles.assistantRow}>
    <AppText style={styles.assistantText}>{text}{status === 'streaming' ? <Cursor /> : null}</AppText>
    {status === 'stopped' && <AppText tertiary variant="footnote">Respuesta interrumpida.</AppText>}
  </View>;
}

function Thinking() {
  const p = usePalette();
  const reduced = useReduceMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduced) { pulse.value = 1; return; }
    pulse.value = withRepeat(withSequence(withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) })), -1, false);
    return () => { pulse.value = 1; };
  }, [reduced, pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <View accessible accessibilityLabel="Asistente: pensando" accessibilityState={{ busy: true }} style={[styles.assistantRow, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
    <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.primary }, style]} />
    <AppText secondary>Pensando…</AppText>
  </View>;
}

function Cursor() {
  const p = usePalette();
  return <AppText style={{ color: p.primary }}>▍</AppText>;
}

/** One calm line for a state the Assistant cannot get past: not connected,
 * offline, a limit, a failure. It names the state and, when the message did
 * leave the device, offers to send it again. */
export function SystemNote({ message, onRetry }: { message: Message & { role: 'system' }; onRetry?: (text: string) => void }) {
  const p = usePalette();
  const icon: IconName = message.reason === 'offline' ? 'cloud-offline-outline' : message.reason === 'limit' ? 'time-outline' : 'information-circle-outline';
  return <View accessible accessibilityRole="text" accessibilityLabel={message.text} style={styles.systemRow}>
    <Ionicons name={icon} size={16} color={p.tertiary} accessible={false} />
    <AppText secondary variant="footnote" style={{ flex: 1 }}>{message.text}</AppText>
    {message.retryText !== null && onRetry && <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel="Reintentar" onPress={() => onRetry(message.retryText!)} style={{ minHeight: 36, paddingLeft: 8 }}>
      <AppText variant="footnote" style={{ color: p.primary, fontWeight: '600' }}>Reintentar</AppText>
    </PressFeedback>}
  </View>;
}

/** The empty conversation: one question and at most four prompts. */
export function Suggestions({ items, onPick, disabled = false }: { items: typeof SUGGESTIONS | readonly string[]; onPick: (text: string) => void; disabled?: boolean }) {
  const p = usePalette();
  return <View style={styles.empty}>
    <View style={[styles.emptyGlyph, { backgroundColor: p.primarySoft }]}><Ionicons name="sparkles" size={22} color={p.primary} accessible={false} /></View>
    <AppText accessibilityRole="header" variant="title2" style={{ textAlign: 'center' }}>¿En qué te ayudo?</AppText>
    <View style={styles.chips}>
      {items.slice(0, 4).map(item => <Chip key={item} label={item} onPress={() => onPick(item)} disabled={disabled} />)}
    </View>
  </View>;
}

function Chip({ label, onPress, selected = false, disabled = false }: { label: string; onPress: () => void; selected?: boolean; disabled?: boolean }) {
  const p = usePalette();
  return <PressFeedback accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
    style={[styles.chip, { backgroundColor: selected ? p.primarySoft : p.surface, borderColor: selected ? p.primary : p.line, opacity: disabled ? 0.5 : 1 }]}>
    <AppText variant="subhead" style={{ fontWeight: '500', color: selected ? p.primary : p.text }}>{label}</AppText>
  </PressFeedback>;
}

/** The options for a clarification, as chips under the question. One
 * selection haptic; once chosen the chips leave and the choice is repeated as
 * the user's own message. */
export function ClarificationChoices({ options, chosen, onChoose }: { options: ClarificationOption[]; chosen: string | null; onChoose: (option: ClarificationOption) => void }) {
  if (!options.length || chosen) return null;
  return <Reflow fade style={[styles.chips, styles.assistantRow]}>
    {options.map(option => <Chip key={option.id} label={option.label} onPress={() => { selectionHaptic(); onChoose(option); }} />)}
  </Reflow>;
}

/** The numbers an answer rests on and the screens that hold them. A row is
 * a label and an amount (signed when it is a difference); a link is a text
 * button in the interaction colour. Never a dashboard. */
export function AnswerEvidence({ content, currency, onOpen }: { content: AnswerContent; currency: 'ARS' | 'USD'; onOpen: (href: AnswerContent['links'][number]['href']) => void }) {
  const p = usePalette();
  if (!content.rows.length && !content.links.length) return null;
  return <View style={[styles.assistantRow, { gap: space.s }]}>
    {content.rows.length > 0 && <View style={[styles.evidence, { borderColor: p.line }]}>
      {content.rows.map(row => <View key={row.id} accessible accessibilityLabel={row.label} style={styles.evidenceRow}>
        <AppText secondary variant="subhead" numberOfLines={2} style={{ flex: 1, minWidth: 0 }}>{row.label}</AppText>
        <Money minor={row.amountMinor} currency={currency} signed={row.signed} size={15} weight="600" />
      </View>)}
    </View>}
    {content.links.length > 0 && <View style={styles.links}>
      {content.links.map(link => <PressFeedback key={link.label} feedback="opacity" accessibilityRole="link" accessibilityLabel={link.label} onPress={() => onOpen(link.href)} style={styles.link}>
        <AppText variant="subhead" style={{ color: p.primary, fontWeight: '600' }}>{link.label}</AppText>
        <Ionicons name="chevron-forward" size={14} color={p.primary} accessible={false} />
      </PressFeedback>)}
    </View>}
  </View>;
}

/** The structured draft: what would be recorded, as a card the user reads
 * top to bottom (kind and amount, then merchant, category, account, date),
 * then confirms or edits. Confirming is the only path to a write and it is
 * the caller's, not this card's. A confirmed draft turns into a receipt with
 * a link to the movement; a cancelled or edited one collapses to a line. */
export function DraftCard({ content, accounts, onConfirm, onEdit, onCancel, onOpenEntry, busy = false }: {
  content: DraftContent; accounts: Account[]; onConfirm: () => void; onEdit: () => void; onCancel: () => void; onOpenEntry: (entryId: string) => void; busy?: boolean;
}) {
  const p = usePalette();
  const day = useCurrentDay();
  const { draft } = content;
  const account = accounts.find(item => item.id === draft.accountId);
  const gaps = draftGaps(draft);
  const expense = draft.kind === 'expense';
  if (content.status === 'cancelled' || content.status === 'edited') {
    return <View accessible accessibilityLabel={content.status === 'cancelled' ? 'Borrador descartado' : 'Borrador abierto en el formulario'} style={[styles.assistantRow, styles.collapsed]}>
      <Ionicons name={content.status === 'cancelled' ? 'close-circle-outline' : 'create-outline'} size={16} color={p.tertiary} accessible={false} />
      <AppText tertiary variant="footnote">{content.status === 'cancelled' ? 'Borrador descartado. No se registró nada.' : 'Seguiste en el formulario. Guardá desde ahí.'}</AppText>
    </View>;
  }
  const confirmed = content.status === 'confirmed';
  return <Appear style={styles.assistantRow}>
    <Surface style={{ gap: space.m }}>
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {confirmed && <Ionicons name="checkmark-circle" size={16} color={p.income} accessible={false} />}
          <AppText secondary variant="eyebrow">{confirmed ? 'Guardado' : 'Borrador'} · {expense ? 'Gasto' : 'Ingreso'}</AppText>
        </View>
        <Money minor={draft.amountMinor} currency={draft.currency} size={30} tone={expense ? 'expense' : 'income'} />
      </View>
      <View style={{ gap: 0 }}>
        <DraftRow label={expense ? 'Comercio' : 'Origen'} value={draft.merchant.trim() || 'Falta completar'} missing={!draft.merchant.trim()} />
        <DraftRow label="Categoría" value={draft.category.trim() || 'Falta elegir'} missing={!draft.category.trim()}
          leading={draft.category.trim() ? <CategoryBadge category={draft.category} kind={draft.kind} size={28} /> : undefined} />
        <DraftRow label={expense ? 'Pagado con' : 'Ingresa en'} value={account?.name ?? 'Falta elegir'} missing={!account}
          leading={account ? <AccountBadge accountId={account.id} size={28} /> : undefined} />
        <DraftRow label="Fecha" value={activityDateLabel(draft.dateISO, day)} last />
      </View>
      {confirmed
        ? <ActionButton label="Ver movimiento" secondary compact onPress={() => content.entryId && onOpenEntry(content.entryId)} />
        : <View style={{ gap: space.s }}>
          {gaps.length > 0 && <AppText secondary variant="footnote">Completá {gaps.length === 1 ? 'el dato que falta' : 'los datos que faltan'} con Editar antes de confirmar.</AppText>}
          <View style={{ flexDirection: 'row', gap: space.s }}>
            <ActionButton label="Confirmar" onPress={onConfirm} busy={busy} disabled={gaps.length > 0} containerStyle={{ flex: 1 }} compact />
            <ActionButton label="Editar" secondary onPress={onEdit} disabled={busy} containerStyle={{ flex: 1 }} compact />
          </View>
          <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel="Descartar borrador" onPress={onCancel} disabled={busy} style={{ alignSelf: 'center', minHeight: 36, paddingHorizontal: 12 }}>
            <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>Descartar</AppText>
          </PressFeedback>
        </View>}
    </Surface>
  </Appear>;
}

function DraftRow({ label, value, leading, missing = false, last = false }: { label: string; value: string; leading?: ReactNode; missing?: boolean; last?: boolean }) {
  const p = usePalette();
  return <View accessible accessibilityLabel={label + ': ' + value} style={[styles.draftRow, { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
    <AppText secondary variant="subhead" style={{ minWidth: 96, flexShrink: 1 }}>{label}</AppText>
    <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
      {leading}
      <AppText numberOfLines={2} style={{ flexShrink: 1, textAlign: 'right', fontWeight: '500', color: missing ? p.warning : p.text }}>{value}</AppText>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  userRow: { alignItems: 'flex-end', paddingLeft: '18%' },
  userBubble: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, borderBottomRightRadius: 6, maxWidth: '100%' },
  assistantRow: { alignItems: 'stretch', paddingRight: '6%' },
  assistantText: { fontSize: 17, lineHeight: 24 },
  systemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  empty: { alignItems: 'center', gap: space.l, paddingVertical: space.xxl },
  emptyGlyph: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.s },
  chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.chip + 6, borderWidth: StyleSheet.hairlineWidth, minHeight: 44, justifyContent: 'center' },
  evidence: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  evidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, minHeight: 40 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: space.m },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 },
  collapsed: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  draftRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 44 },
});
