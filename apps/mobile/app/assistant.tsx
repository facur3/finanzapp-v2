import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { FlatList, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { isLegacyCurrency, postingAccountsFor, validateEntry, type Currency } from '@finanzapp/domain';
import { assistantForBuild } from '../src/assistant/runtime';
import { REASON_TEXT, SUGGESTIONS, classifyIntent, completeDraft, contentFromResult, entryFromDraft,
  optionText, shouldAutoscroll, type ClarificationOption, type DraftContent, type EvidenceLink, type Message } from '../src/assistant/conversation';
import { conversationSession } from '../src/assistant/session';
import { monthlyEvidence } from '../src/integrations/evidence';
import { useI18n } from '../src/i18n/provider';
import { useLedger } from '../src/storage/LedgerProvider';
import { AssistantComposer } from '../src/ui/assistant-composer';
import { AnswerEvidence, AssistantText, ClarificationChoices, DraftCard, Suggestions, SystemNote, UserMessage } from '../src/ui/assistant-messages';
import { AppText, IconButton } from '../src/ui/components';
import { postingAccounts } from '../src/ui/liability-presentation';
import { Appear, impactHaptic, successHaptic } from '../src/ui/motion';
import { availableCurrencies } from '../src/ui/presentation';
import { space, useCurrentDay, usePalette, useReduceMotion } from '../src/ui/theme';

/** The tab roots: an evidence link to one of them goes back to the tabs already under the Assistant and selects that tab
 * (`router.dismissTo`, a pop to the existing tabs route); `navigate` from this stack screen would push a second copy of the
 * tabs over the Assistant instead. The conversation stays in the session. */
const TAB_ROOTS = new Set(['/', '/activity', '/reports', '/settings']);

/** The Assistant: one conversation over the local ledger, a screen of the root
 * stack (Producto 24UX6A, decision 005), opened from the capture hub («+» →
 * Asistente) and pushed full-screen over the tabs; back returns to the screen
 * where «+» was tapped. It is not a tab. The conversation lives in memory for
 * the app session (`conversationSession`), so leaving and coming back finds it
 * as it was; nothing is persisted, and closing the app clears it.
 *
 * The screen owns no financial rules. It sends text to the client boundary
 * (`assistantForBuild`, disconnected in this build), reduces the events into
 * the conversation model, and writes the ledger in exactly one place: when
 * the user confirms a draft card, the draft becomes an Entry that the domain
 * validates and the storage repository saves. Nothing else here can write.
 * Questions are explained against `monthlyEvidence`, aggregated on-device;
 * the answer's rows and links come from those facts, never from prose.
 *
 * Language: the app's own words (title, notes, suggestions, the questions it
 * asks) follow the interface language and are stored as catalogue keys; the
 * model's answer and the user's words are shown exactly as they arrived. */
export default function AssistantScreen() {
  const params = useLocalSearchParams<{ currency?: string }>();
  const { snapshot, archive, addEntry } = useLedger();
  const day = useCurrentDay();
  const p = usePalette();
  const reduced = useReduceMotion();
  const { t, speechLanguage } = useI18n();
  const session = conversationSession();
  const { conversation: state, writing } = useSyncExternalStore(session.subscribe, session.getState, session.getState);
  const dispatch = session.dispatch;
  const client = useMemo(() => assistantForBuild(), []);
  const list = useRef<FlatList<Message>>(null);
  const scroll = useRef({ offset: 0, content: 0, viewport: 0 });
  // Coming back to a conversation that is already there (from the hub's «Continuar»): open at its last exchange, once.
  const returning = useRef(state.messages.length > 0);

  const currencies = availableCurrencies(snapshot?.accounts ?? []);
  const currency: Currency = typeof params.currency === 'string' && currencies.includes(params.currency as Currency) ? params.currency as Currency : currencies[0] ?? 'ARS';
  const accounts = useMemo(() => postingAccounts(snapshot?.accounts ?? [], archive?.debts), [snapshot?.accounts, archive?.debts]);
  // An income draft may only land in a cash account (24B6); a card is neither offered nor implied for it.
  const incomeAccounts = useMemo(() => postingAccountsFor('income', snapshot?.accounts ?? [], archive?.cards, archive?.debts), [snapshot?.accounts, archive?.cards, archive?.debts]);
  const entries = snapshot?.entries ?? [];
  const busy = state.phase !== 'idle';

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || session.request.current) return;
    impactHaptic();
    dispatch({ type: 'send', text });
    const action = classifyIntent(text);
    // Contract v1 knows ARS and USD only: the client never sends another currency (docs/currency.md §7.5, stage 7 brings the next version).
    if (!isLegacyCurrency(currency)) { dispatch({ type: 'fail', reason: 'unavailable', text: REASON_TEXT.unavailable, sent: raw }); return; }
    const facts = action === 'explain' && snapshot ? monthlyEvidence(snapshot, currency, day) : [];
    const controller = new AbortController();
    session.request.current = controller;
    try {
      for await (const event of client.ask({ action, text, todayISO: day, currency, facts }, controller.signal)) {
        if (controller.signal.aborted) break;
        if (event.type === 'delta') dispatch({ type: 'delta', text: event.text });
        else if (event.type === 'result') dispatch({ type: 'answer', ...contentFromResult(event.result, event.facts, accounts, entries, currency, day, incomeAccounts) });
        // A failure's message is the integration client's catalogue key or empty (then the reason's own note); the note translates it through errorText.
        else dispatch({ type: 'fail', reason: event.reason, text: event.reason === 'failed' && event.message ? event.message : REASON_TEXT[event.reason], sent: raw });
      }
    } catch {
      if (!controller.signal.aborted) dispatch({ type: 'fail', reason: 'failed', text: REASON_TEXT.failed, sent: raw });
    } finally {
      if (session.request.current === controller) session.request.current = null;
    }
  }, [client, session, dispatch, snapshot, accounts, incomeAccounts, entries, currency, day]);

  const stop = useCallback(() => { session.request.current?.abort(); session.request.current = null; dispatch({ type: 'stop' }); }, [session, dispatch]);

  // `shown` is what the chip displayed: it becomes the user's own words in the thread.
  const choose = useCallback((messageId: string, option: ClarificationOption, shown?: string) => {
    const next = state.pending ? completeDraft(state.pending, option.id, accounts, entries, day, incomeAccounts) : null;
    dispatch({ type: 'choose', messageId, optionId: option.id, label: shown ?? optionText(option, t), next });
  }, [dispatch, state.pending, accounts, incomeAccounts, entries, day, t]);

  const confirm = useCallback(async (messageId: string, content: DraftContent) => {
    // Only a pending draft can be written, and only one write at a time: a stale tap on a confirmed card is a no-op.
    if (writing || content.status !== 'pending') return;
    if (client.mode === 'fixture') { dispatch({ type: 'note', reason: 'info', text: 'assistant.fixtureConfirmRefused' }); return; }
    session.setWriting(messageId);
    try {
      // Build once, validate with the domain, write through the repository. A retry reuses the same Entry.
      const entry = session.writes.get(messageId) ?? entryFromDraft(content.draft, randomUUID(), new Date().toISOString());
      validateEntry(entry, accounts);
      session.writes.set(messageId, entry);
      await addEntry(entry);
      session.writes.delete(messageId);
      successHaptic();
      dispatch({ type: 'draft-confirmed', messageId, entryId: entry.id });
    } catch (cause) {
      dispatch({ type: 'note', reason: 'failed', text: cause instanceof Error ? cause.message : 'assistant.saveFailed' });
    } finally {
      session.setWriting(null);
    }
  }, [session, dispatch, writing, client.mode, accounts, addEntry]);

  const edit = useCallback((messageId: string, content: DraftContent) => {
    const { draft } = content;
    dispatch({ type: 'draft-edited', messageId });
    router.push({ pathname: '/new-entry', params: { kind: draft.kind, currency: draft.currency, ...(draft.accountId ? { accountId: draft.accountId } : {}),
      amountMinor: String(draft.amountMinor), merchant: draft.merchant, category: draft.category, date: draft.dateISO } });
  }, [dispatch]);

  const open = useCallback((href: EvidenceLink['href']) => {
    const to = href.params ? { pathname: href.pathname, params: href.params } : href.pathname;
    if (TAB_ROOTS.has(href.pathname)) router.dismissTo(to);
    else router.push(to);
  }, []);

  // Follow new content only when the reader is already at the end; a reader who scrolled up is never pulled back down.
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => { scroll.current.offset = event.nativeEvent.contentOffset.y; };
  const follow = () => {
    if (returning.current && scroll.current.content > 0 && scroll.current.viewport > 0) {
      returning.current = false;
      list.current?.scrollToEnd({ animated: false });
      return;
    }
    const { offset, content, viewport } = scroll.current;
    if (shouldAutoscroll(offset, content, viewport)) list.current?.scrollToEnd({ animated: !reduced });
  };

  const renderItem = ({ item }: { item: Message }) => {
    if (item.role === 'user') return <Appear><UserMessage text={item.text} /></Appear>;
    if (item.role === 'system') return <Appear><SystemNote message={item} onRetry={text => void send(text)} /></Appear>;
    return <View style={{ gap: space.m }}>
      {(item.text || item.textKey || item.status === 'streaming') && <AssistantText text={item.textKey ? t(item.textKey) : item.text} ownWords={!!item.textKey} status={item.status} />}
      {item.content?.kind === 'answer' && <AnswerEvidence content={item.content} onOpen={open} />}
      {item.content?.kind === 'clarification' && <ClarificationChoices options={item.content.options} chosen={item.content.chosen} onChoose={(option, shown) => choose(item.id, option, shown)} />}
      {item.content?.kind === 'draft' && <DraftCard content={item.content} accounts={accounts} busy={writing === item.id}
        onConfirm={() => void confirm(item.id, item.content as DraftContent)} onEdit={() => edit(item.id, item.content as DraftContent)}
        onCancel={() => dispatch({ type: 'draft-cancelled', messageId: item.id })} onOpenEntry={entryId => router.push({ pathname: '/entry/[id]', params: { id: entryId } })} />}
    </View>;
  };

  // 24UX6C: no permanent «not connected» line. In a disconnected build the limitation is said where it matters: a sent
  // message (typed or a suggestion) gets the `unavailable` note in the thread and its words go back to the composer.

  return <View style={{ flex: 1, backgroundColor: p.background }}>
    <Stack.Screen options={{ title: t('assistant.title'),
      headerRight: state.messages.length ? () => <IconButton name="create-outline" label={t('assistant.newChat')} onPress={session.reset} /> : undefined }} />
    {client.mode === 'fixture' && <View accessible accessibilityRole="text" accessibilityLanguage={speechLanguage} style={{ backgroundColor: p.warningSoft, paddingHorizontal: space.xl, paddingVertical: space.s }}>
      <AppText variant="footnote" style={{ color: p.warning, fontWeight: '600', textAlign: 'center' }}>{t('assistant.fixtureBanner')}</AppText>
    </View>}
    <FlatList ref={list} data={state.messages} keyExtractor={message => message.id} renderItem={renderItem}
      contentInsetAdjustmentBehavior="automatic" keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled"
      onScroll={onScroll} scrollEventThrottle={32}
      onLayout={event => { scroll.current.viewport = event.nativeEvent.layout.height; follow(); }}
      onContentSizeChange={(_width, height) => { scroll.current.content = height; follow(); }}
      contentContainerStyle={{ padding: space.xl, gap: space.l, flexGrow: 1, justifyContent: state.messages.length ? 'flex-start' : 'center' }}
      ListEmptyComponent={<Suggestions items={SUGGESTIONS.map(key => t(key))} onPick={text => void send(text)} disabled={busy} />} />
    <AssistantComposer value={state.composer} onChange={text => dispatch({ type: 'compose', text })} onSend={() => void send(state.composer)} onStop={stop} busy={busy} />
  </View>;
}
