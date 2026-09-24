import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Account } from '@finanzapp/domain';
import type { AnswerContent, ClarificationOption, DraftContent, Message } from '../assistant/conversation';
import { draftGaps, evidenceLabel, optionText } from '../assistant/conversation';
import { useI18n } from '../i18n/provider';
import { useCategoryLook, useCategoryLookOf } from './category-hues';
import { AccountBadge, ActionButton, AppText, CategoryBadge, Money, PressFeedback, Surface, type IconName } from './components';
import { Appear, Reflow, selectionHaptic } from './motion';
import { activityDateLabel } from './presentation';
import { radius, space, useCurrentDay, usePalette, useReduceMotion } from './theme';

/** The conversation, visually quiet. A user message is a compact grey pill on
 * the right; the Assistant answers in plain running text on the left with no
 * container; money, categories and accounts appear through the same
 * components the rest of FinanzApp uses. Every state is also said in words
 * (a label, a footnote), never only by colour or motion.
 *
 * Every word the app says here comes from the catalogue; the model's text and
 * the user's words (messages, account names, merchants, custom categories)
 * are shown as they are. */

export function UserMessage({ text }: { text: string }) {
  const p = usePalette();
  const { t, speechLanguage } = useI18n();
  return <View style={styles.userRow}>
    <View accessible accessibilityLabel={t('assistant.message.user', { text })} accessibilityLanguage={speechLanguage} style={[styles.userBubble, { backgroundColor: p.inset }]}>
      <AppText>{text}</AppText>
    </View>
  </View>;
}

/** Streaming shows the words as they arrive, or "Pensando…" with a pulse
 * before the first one; a stopped answer says so under its partial text.
 * The model's words are content in the language they were written in, which
 * for the v1 server is always Spanish (docs/i18n.md §11): VoiceOver reads them
 * with a Spanish voice, the device's own when the device is in Spanish, even
 * with English chosen in Más. A v2 reply will carry the language it was asked in.
 * `ownWords` marks a turn the app wrote itself (a clarification question, "review
 * the draft"): it is already in the interface language and follows the usual rule. */
const REPLY_LANGUAGE_V1 = 'es';
export function AssistantText({ text, status, ownWords = false }: { text: string; status: 'streaming' | 'done' | 'stopped'; ownWords?: boolean }) {
  const { t, language, speechLanguage } = useI18n();
  if (!text && status === 'streaming') return <Thinking />;
  // The interface's own words, or prose already in the interface language: the usual
  // rule (nothing when the device agrees). Otherwise the prose names its own language.
  const replyVoice = ownWords || language === REPLY_LANGUAGE_V1 ? speechLanguage : REPLY_LANGUAGE_V1;
  return <View accessible accessibilityLabel={t('assistant.message.assistant', { text })} accessibilityLanguage={replyVoice} style={styles.assistantRow}>
    <AppText style={styles.assistantText}>{text}{status === 'streaming' ? <Cursor /> : null}</AppText>
    {status === 'stopped' && <AppText tertiary variant="footnote">{t('assistant.message.stopped')}</AppText>}
  </View>;
}

function Thinking() {
  const p = usePalette();
  const reduced = useReduceMotion();
  const { t, speechLanguage } = useI18n();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduced) { pulse.value = 1; return; }
    pulse.value = withRepeat(withSequence(withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) })), -1, false);
    return () => { pulse.value = 1; };
  }, [reduced, pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <View accessible accessibilityLabel={t('assistant.message.thinkingLabel')} accessibilityLanguage={speechLanguage} accessibilityState={{ busy: true }} style={[styles.assistantRow, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
    <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.primary }, style]} />
    <AppText secondary>{t('assistant.message.thinking')}</AppText>
  </View>;
}

function Cursor() {
  const p = usePalette();
  return <AppText style={{ color: p.primary }}>▍</AppText>;
}

/** One calm line for a state the Assistant cannot get past: not connected,
 * offline, a limit, a failure. It names the state and, when the message did
 * leave the device, offers to send it again. The stored text is a catalogue
 * key or a caught message; `errorText` shows either in the interface language. */
export function SystemNote({ message, onRetry }: { message: Message & { role: 'system' }; onRetry?: (text: string) => void }) {
  const p = usePalette();
  const { t, errorText, speechLanguage } = useI18n();
  const text = errorText(message.text);
  const icon: IconName = message.reason === 'offline' ? 'cloud-offline-outline' : message.reason === 'limit' ? 'time-outline' : 'information-circle-outline';
  return <View accessible accessibilityRole="text" accessibilityLabel={text} accessibilityLanguage={speechLanguage} style={styles.systemRow}>
    <Ionicons name={icon} size={16} color={p.tertiary} accessible={false} />
    <AppText secondary variant="footnote" style={{ flex: 1 }}>{text}</AppText>
    {message.retryText !== null && onRetry && <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel={t('assistant.message.retry')} onPress={() => onRetry(message.retryText!)} style={{ minHeight: 36, paddingLeft: 8 }}>
      <AppText variant="footnote" style={{ color: p.primary, fontWeight: '600' }}>{t('assistant.message.retry')}</AppText>
    </PressFeedback>}
  </View>;
}

/** The empty conversation: one question and at most four prompts (already in the interface language). */
export function Suggestions({ items, onPick, disabled = false }: { items: readonly string[]; onPick: (text: string) => void; disabled?: boolean }) {
  const p = usePalette();
  const { t } = useI18n();
  return <View style={styles.empty}>
    <View style={[styles.emptyGlyph, { backgroundColor: p.primarySoft }]}><Ionicons name="sparkles" size={22} color={p.primary} accessible={false} /></View>
    <AppText accessibilityRole="header" variant="title2" style={{ textAlign: 'center' }}>{t('assistant.emptyTitle')}</AppText>
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
 * the user's own message (`shown`, the words the chip displayed). An app word
 * (Gasto/Ingreso) is translated; a built-in category shows its localized name,
 * looked up with the chip's own kind (Sueldo is only a built-in income
 * category); an account or custom category name is the user's own. */
export function ClarificationChoices({ options, chosen, onChoose }: { options: ClarificationOption[]; chosen: string | null; onChoose: (option: ClarificationOption, shown: string) => void }) {
  const { t } = useI18n();
  const expenseLook = useCategoryLookOf('expense');
  const incomeLook = useCategoryLookOf('income');
  if (!options.length || chosen) return null;
  return <Reflow fade style={[styles.chips, styles.assistantRow]}>
    {options.map(option => {
      const shown = option.category && option.label ? (option.category === 'income' ? incomeLook : expenseLook)(option.label).label : optionText(option, t);
      return <Chip key={option.id} label={shown} onPress={() => { selectionHaptic(); onChoose(option, shown); }} />;
    })}
  </Reflow>;
}

/** The numbers an answer rests on and the screens that hold them. A row is
 * a label and an amount (signed when it is a difference); a link is a text
 * button in the interaction colour. Never a dashboard. A row is one VoiceOver
 * element, so its label says the amount too, in spoken form: the Money inside
 * is not reached on its own. */
export function AnswerEvidence({ content, onOpen }: { content: AnswerContent; onOpen: (href: AnswerContent['links'][number]['href']) => void }) {
  const p = usePalette();
  const { t, spokenMoney, speechLanguage } = useI18n();
  const categoryLook = useCategoryLookOf('expense');
  if (!content.rows.length && !content.links.length) return null;
  const currency = content.currency;
  // A difference that grew is said as such ("42500,00 pesos más"); a lower one already starts with "Menos".
  const spoken = (row: AnswerContent['rows'][number]) => row.signed && row.amountMinor > 0
    ? t('assistant.evidence.spokenIncrease', { amount: spokenMoney(row.amountMinor, currency) }) : spokenMoney(row.amountMinor, currency);
  return <View style={[styles.assistantRow, { gap: space.s }]}>
    {content.rows.length > 0 && <View style={[styles.evidence, { borderColor: p.line }]}>
      {content.rows.map(row => {
        const label = evidenceLabel(row, t, stored => categoryLook(stored).label);
        return <View key={row.id} accessible accessibilityLabel={label + ', ' + spoken(row)} accessibilityLanguage={speechLanguage} style={styles.evidenceRow}>
          <AppText secondary variant="subhead" numberOfLines={2} style={{ flex: 1, minWidth: 0 }}>{label}</AppText>
          <Money minor={row.amountMinor} currency={currency} signed={row.signed} size={15} weight="600" />
        </View>;
      })}
    </View>}
    {content.links.length > 0 && <View style={styles.links}>
      {content.links.map(link => <PressFeedback key={link.id} feedback="opacity" accessibilityRole="link" accessibilityLabel={t(`assistant.links.${link.id}`)} onPress={() => onOpen(link.href)} style={styles.link}>
        <AppText variant="subhead" style={{ color: p.primary, fontWeight: '600' }}>{t(`assistant.links.${link.id}`)}</AppText>
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
  const { t, locale, speechLanguage } = useI18n();
  const { draft } = content;
  // The stored category is never changed; a built-in one only reads in the interface language.
  const categoryName = useCategoryLook(draft.category.trim(), draft.kind).label;
  const account = accounts.find(item => item.id === draft.accountId);
  const gaps = draftGaps(draft);
  const expense = draft.kind === 'expense';
  if (content.status === 'cancelled' || content.status === 'edited') {
    return <View accessible accessibilityLabel={t(content.status === 'cancelled' ? 'assistant.draft.cancelledLabel' : 'assistant.draft.editedLabel')} accessibilityLanguage={speechLanguage}
      style={[styles.assistantRow, styles.collapsed]}>
      <Ionicons name={content.status === 'cancelled' ? 'close-circle-outline' : 'create-outline'} size={16} color={p.tertiary} accessible={false} />
      <AppText tertiary variant="footnote">{t(content.status === 'cancelled' ? 'assistant.draft.cancelled' : 'assistant.draft.edited')}</AppText>
    </View>;
  }
  const confirmed = content.status === 'confirmed';
  return <Appear style={styles.assistantRow}>
    <Surface style={{ gap: space.m }}>
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {confirmed && <Ionicons name="checkmark-circle" size={16} color={p.income} accessible={false} />}
          <AppText secondary variant="eyebrow">{t('assistant.draft.eyebrow', { status: t(confirmed ? 'assistant.draft.saved' : 'assistant.draft.pending'), kind: t(expense ? 'movement.expense' : 'movement.income') })}</AppText>
        </View>
        <Money minor={draft.amountMinor} currency={draft.currency} size={30} tone={expense ? 'expense' : 'income'} />
      </View>
      <View style={{ gap: 0 }}>
        <DraftRow label={t(expense ? 'assistant.draft.merchant' : 'assistant.draft.source')} value={draft.merchant.trim() || t('assistant.draft.missingText')} missing={!draft.merchant.trim()} />
        <DraftRow label={t('selection.category')} value={draft.category.trim() ? categoryName : t('assistant.draft.missingChoice')} missing={!draft.category.trim()}
          leading={draft.category.trim() ? <CategoryBadge category={draft.category} kind={draft.kind} size={28} /> : undefined} />
        <DraftRow label={t(expense ? 'entryForm.paidWith' : 'entryForm.receivedIn')} value={account?.name ?? t('assistant.draft.missingChoice')} missing={!account}
          leading={account ? <AccountBadge accountId={account.id} size={28} /> : undefined} />
        <DraftRow label={t('selection.date')} value={activityDateLabel(draft.dateISO, day, locale)} last />
      </View>
      {confirmed
        ? <ActionButton label={t('assistant.draft.viewEntry')} secondary compact onPress={() => content.entryId && onOpenEntry(content.entryId)} />
        : <View style={{ gap: space.s }}>
          {gaps.length > 0 && <AppText secondary variant="footnote">{t('assistant.draft.gaps', { count: gaps.length })}</AppText>}
          <View style={{ flexDirection: 'row', gap: space.s }}>
            <ActionButton label={t('assistant.draft.confirm')} onPress={onConfirm} busy={busy} disabled={gaps.length > 0} containerStyle={{ flex: 1 }} compact />
            <ActionButton label={t('assistant.draft.edit')} secondary onPress={onEdit} disabled={busy} containerStyle={{ flex: 1 }} compact />
          </View>
          <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel={t('assistant.draft.discardLabel')} onPress={onCancel} disabled={busy} style={{ alignSelf: 'center', minHeight: 36, paddingHorizontal: 12 }}>
            <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>{t('assistant.draft.discard')}</AppText>
          </PressFeedback>
        </View>}
    </Surface>
  </Appear>;
}

function DraftRow({ label, value, leading, missing = false, last = false }: { label: string; value: string; leading?: ReactNode; missing?: boolean; last?: boolean }) {
  const p = usePalette();
  const { t, speechLanguage } = useI18n();
  return <View accessible accessibilityLabel={t('assistant.draft.row', { label, value })} accessibilityLanguage={speechLanguage} style={[styles.draftRow, { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
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
