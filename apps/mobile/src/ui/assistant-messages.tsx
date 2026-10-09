import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { todayKey, type ReviewArchive } from '@finanzapp/domain';
import type { AnswerContent, ClarificationOption, Message, ProposalContent } from '../assistant/conversation';
import { evidenceLabel, optionText } from '../assistant/conversation';
import type { ReviewItem } from '../storage/review-database';
import type { LanguageCode } from '../i18n/locale';
import { useI18n } from '../i18n/provider';
import { useCategoryLook, useCategoryLookOf } from './category-hues';
import { AccountBadge, ActionButton, AppText, CategoryBadge, Money, PressFeedback, Surface, type IconName } from './components';
import { Appear, Reflow, selectionHaptic } from './motion';
import { activityDateLabel } from './presentation';
import { reviewFacts } from './review-presentation';
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
 * The model's words are content in the language they were asked in: protocol v3
 * sends the interface language with each ask (docs/i18n.md §11) and the message
 * keeps it as `language`, so VoiceOver reads a reply with the voice of that language
 * even after the interface changes. `ownWords` marks a turn the app wrote itself (a
 * clarification question, "review the draft"): it is already in the interface
 * language and follows the usual rule. */
export function AssistantText({ text, status, ownWords = false, language: replyLanguage }: { text: string; status: 'streaming' | 'done' | 'stopped'; ownWords?: boolean; language?: LanguageCode }) {
  const { t, language, speechLanguage } = useI18n();
  if (!text && status === 'streaming') return <Thinking />;
  // The interface's own words, or prose asked in the interface language: the usual rule (nothing when the device
  // agrees). Prose asked in another language (a reply kept on screen after a change) names its own language.
  const replyVoice = ownWords || !replyLanguage || replyLanguage === language ? speechLanguage : replyLanguage;
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
    {/* 24UX6C: the Assistant's mark is the lime accent circle with an ink glyph (14.1:1; the hub's lime tile uses an ink circle instead): it reads on both grounds. */}
    <View style={[styles.emptyGlyph, { backgroundColor: p.accent }]}><Ionicons name="sparkles" size={22} color={p.onAccent} accessible={false} /></View>
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
  const { t, currencyName } = useI18n();
  const expenseLook = useCategoryLookOf('expense');
  const incomeLook = useCategoryLookOf('income');
  if (!options.length || chosen) return null;
  return <Reflow fade style={[styles.chips, styles.assistantRow]}>
    {options.map(option => {
      // A currency to choose (25A-06) is named in the interface language («Pesos argentinos», "US dollars").
      const shown = option.category && option.label ? (option.category === 'income' ? incomeLook : expenseLook)(option.label).label : optionText(option, t, currencyName);
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
/** 25A-04: where a proposal stands, as the screen knows it: its capture (`preview`, `capturing`, `failed`), the live
 * review item while it is pending, or what became of it once it left the tray. */
export type ProposalState =
  | { kind: 'preview' | 'capturing' | 'failed' | 'unknown' | 'dismissed' | 'gone' }
  | { kind: 'pending'; item: ReviewItem; conflict: boolean; writable: boolean }
  /** The recorded item itself: the card draws what was confirmed (edits made in «Para revisar» included). */
  | { kind: 'confirmed'; item: ReviewItem; record: 'entry' | 'plan' };

/** A financial proposal of the Assistant (25A-04), compact: it is never confirmed in the card. Once captured it is a
 * review item: the card reads that item (an edit made in the review sheet or «Para revisar» is what it shows) and, while
 * it is pending (the review sheet was closed for later), offers «Revisar», which reopens the review sheet. Before the
 * capture lands it shows the frozen snapshot and says so; a failed capture offers Reintentar (the same capture again); a
 * confirmed proposal shows the stored values with «Registrado» and the link to the record; a discarded one, one line.
 * Nothing in it can write. The fixture view shows the card and says nothing is saved. */
export function ProposalCard({ content, state, archive, onReview, onRetry, onOpenRecord }: {
  content: ProposalContent; state: ProposalState; archive: ReviewArchive | null; onReview: (itemId: string) => void; onRetry: () => void;
  onOpenRecord: (record: 'entry' | 'plan', writeId: string) => void;
}) {
  const p = usePalette();
  const day = useCurrentDay();
  const { t, locale, speechLanguage, formatDate } = useI18n();
  // Once the item exists it is the source of truth: pending or confirmed, the card draws the stored draft; the capture's
  // snapshot only until then.
  const draft = state.kind === 'pending' || state.kind === 'confirmed' ? state.item.draft : content.capture.draft;
  const categoryName = useCategoryLook(draft.category ?? '', draft.kind ?? 'expense').label;
  if (state.kind === 'dismissed' || state.kind === 'gone') {
    const text = t(state.kind === 'dismissed' ? 'assistant.proposal.dismissed' : 'assistant.proposal.gone');
    return <View accessible accessibilityLabel={text} accessibilityLanguage={speechLanguage} style={[styles.assistantRow, styles.collapsed]}>
      <Ionicons name={state.kind === 'dismissed' ? 'close-circle-outline' : 'file-tray-outline'} size={16} color={p.tertiary} accessible={false} />
      <AppText tertiary variant="footnote">{text}</AppText>
    </View>;
  }
  const missing = t('assistant.proposal.missing');
  const expense = draft.kind !== 'income';
  const account = draft.destinationId ? archive?.accounts.find(item => item.id === draft.destinationId) : undefined;
  const card = account ? (archive?.cards ?? []).find(item => item.accountId === account.id) : undefined;
  const purchase = !card || draft.kind === 'income' ? null : draft.purchase === null ? missing : draft.purchase.mode === 'once' ? t('review.purchase.once')
    : draft.purchase.count === null ? t('review.purchase.installmentsOpen') : t('review.purchase.installments', { count: draft.purchase.count });
  const facts = state.kind === 'pending' && archive ? reviewFacts(state.item, archive, { todayISO: todayKey(), writable: state.writable, conflicts: state.conflict ? [state.item.id] : [] }) : null;
  const statusKey = state.kind === 'pending' ? 'pending' : state.kind;
  const kind = t(draft.kind === null ? 'review.kind.unknown' : draft.kind === 'expense' ? 'movement.expense' : 'movement.income');
  // What the proposal needs, in the review's own words: neutral when merely incomplete, never an error.
  const line = state.kind === 'preview' ? t('assistant.proposal.preview') : state.kind === 'capturing' ? t('assistant.proposal.capturing')
    : state.kind === 'failed' ? t('assistant.proposal.failed') : state.kind === 'confirmed' ? t('assistant.proposal.confirmed')
    : state.kind === 'unknown' || !facts ? t('assistant.proposal.unknown')
    : facts.state === 'ready' ? t('assistant.proposal.ready') : facts.state === 'incomplete' ? t('assistant.proposal.incomplete', { count: facts.gaps.length })
    : t(`review.state.${facts.state}`);
  const lineColor = state.kind === 'failed' || (facts && (facts.state === 'stale' || facts.state === 'interrupted' || facts.state === 'conflict')) ? p.warning : p.secondary;
  return <Appear style={styles.assistantRow}>
    <Surface style={{ gap: space.m }}>
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {state.kind === 'confirmed' && <Ionicons name="checkmark-circle" size={16} color={p.income} accessible={false} />}
          <AppText secondary variant="eyebrow">{t('assistant.proposal.eyebrow', { status: t(`assistant.proposal.status.${statusKey}`), kind })}</AppText>
        </View>
        {draft.amountMinor !== null && draft.currency !== null
          ? <Money minor={draft.amountMinor} currency={draft.currency} size={30} tone={expense ? 'expense' : 'income'} signed={!expense} />
          : <AppText variant="title2" style={{ color: p.secondary }}>{t('assistant.proposal.noAmount')}</AppText>}
      </View>
      <View style={{ gap: 0 }}>
        <ProposalRow label={t(expense ? 'assistant.proposal.merchant' : 'assistant.proposal.source')} value={draft.merchant ?? missing} missing={draft.merchant === null} />
        <ProposalRow label={t('selection.category')} value={draft.category ? categoryName : missing} missing={!draft.category}
          leading={draft.category ? <CategoryBadge category={draft.category} kind={draft.kind ?? 'expense'} size={28} /> : undefined} />
        <ProposalRow label={t('assistant.proposal.destination')} value={account?.name ?? missing} missing={!account}
          leading={account && !card ? <AccountBadge accountId={account.id} size={28} /> : undefined} />
        {purchase !== null && <ProposalRow label={t('assistant.proposal.payment')} value={purchase} missing={draft.purchase === null} />}
        <ProposalRow label={t('selection.date')} value={draft.dateISO ? activityDateLabel(draft.dateISO, day, locale) : missing} missing={!draft.dateISO}
          spoken={draft.dateISO ? formatDate(draft.dateISO, 'long') : undefined} last />
      </View>
      <AppText accessibilityLiveRegion="polite" variant="footnote" style={{ color: lineColor }}>{line}</AppText>
      {state.kind === 'failed' && <ActionButton label={t('assistant.proposal.retry')} icon="refresh" secondary compact onPress={onRetry} />}
      {(state.kind === 'pending' || state.kind === 'unknown') && <ActionButton label={t('assistant.proposal.review')} icon="file-tray-full-outline" secondary compact
        onPress={() => onReview(content.capture.id)} />}
      {state.kind === 'confirmed' && <ActionButton label={t(state.record === 'plan' ? 'assistant.proposal.viewPlan' : 'assistant.proposal.viewEntry')} secondary compact
        onPress={() => onOpenRecord(state.record, state.item.writeId)} />}
    </Surface>
  </Appear>;
}

function ProposalRow({ label, value, spoken, leading, missing = false, last = false }: { label: string; value: string; spoken?: string; leading?: ReactNode; missing?: boolean; last?: boolean }) {
  const p = usePalette();
  const { t, speechLanguage } = useI18n();
  return <View accessible accessibilityLabel={t('assistant.proposal.row', { label, value: spoken ?? value })} accessibilityLanguage={speechLanguage} style={[styles.draftRow, { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
    <AppText secondary variant="subhead" style={{ minWidth: 96, flexShrink: 1 }}>{label}</AppText>
    <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
      {leading}
      <AppText numberOfLines={2} style={{ flexShrink: 1, textAlign: 'right', fontWeight: '500', color: missing ? p.secondary : p.text }}>{value}</AppText>
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
