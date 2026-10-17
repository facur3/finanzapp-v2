import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { FlatList, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { isLedgerCurrency, postingAccountsFor, todayKey, type Currency, type ReviewArchive } from '@finanzapp/domain';
import { assistantForBuild } from '../src/assistant/runtime';
import { DROPPED_TEXT, REASON_TEXT, SUGGESTIONS, classifyIntent, completeDraft, contentFromResult, ownsPending, optionText, shouldAutoscroll, type AssistantContent,
  type ClarificationOption, type EvidenceLink, type Message, type ProposalContent, type ResolvedContent } from '../src/assistant/conversation';
import { assistantCapture, proposalContent } from '../src/assistant/review-proposal';
import { conversationSession } from '../src/assistant/session';
import { monthlyEvidence } from '../src/integrations/evidence';
import { useI18n } from '../src/i18n/provider';
import { useLedger } from '../src/storage/LedgerProvider';
import type { ReviewItem } from '../src/storage/review-database';
import { AssistantComposer } from '../src/ui/assistant-composer';
import { AnswerEvidence, AssistantText, ClarificationChoices, ProposalCard, Suggestions, SystemNote, UserMessage, type ProposalState } from '../src/ui/assistant-messages';
import { AppText, IconButton } from '../src/ui/components';
import { Appear, Restored, announce, impactHaptic } from '../src/ui/motion';
import { availableCurrencies, historyCurrencies } from '../src/ui/presentation';
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
 * The screen owns no financial rules and never writes the ledger. It sends text to the client boundary
 * (`assistantForBuild`, disconnected in this build) and reduces the events into the conversation model. Producto 25A-04:
 * a resolved draft becomes a proposal captured into the review store (`captureReview`, the store's capture, with an item
 * id and a write id fixed once, so a retry never makes a second item); once it is stored, the review sheet
 * (`/review-sheet/[id]`) is presented over the Assistant, where it is confirmed, edited or discarded through the review
 * store's one write path (25A-02, 25A-03). Closing the sheet leaves it pending: the card's «Revisar» reopens it, and
 * «Para revisar» keeps it as the durable inbox. The card reads the review item, never the conversation's snapshot, so an
 * edit is what the card shows. The fixture view captures and presents nothing.
 * Questions are explained against `monthlyEvidence`, aggregated on-device;
 * the answer's rows and links come from those facts, never from prose.
 *
 * Language: the app's own words (title, notes, suggestions, the questions it
 * asks) follow the interface language and are stored as catalogue keys; the
 * model's answer and the user's words are shown exactly as they arrived. */
export default function AssistantScreen() {
  const params = useLocalSearchParams<{ currency?: string }>();
  const { snapshot, archive, review, reviewVersion, captureReview, getReviewItem, refreshReview } = useLedger();
  const day = useCurrentDay();
  const p = usePalette();
  const reduced = useReduceMotion();
  const { t, errorText, speechLanguage, region, language } = useI18n();
  const session = conversationSession();
  // The thread, the phase and the parked draft, each its own subscription: typing (a 'compose') changes none of them, so
  // the screen and its cells do not re-render on a keystroke; only the composer reads the draft words (`Composer`).
  const messages = useSyncExternalStore(session.subscribe, () => session.getState().conversation.messages, () => session.getState().conversation.messages);
  const phase = useSyncExternalStore(session.subscribe, () => session.getState().conversation.phase, () => session.getState().conversation.phase);
  const pending = useSyncExternalStore(session.subscribe, () => session.getState().conversation.pending, () => session.getState().conversation.pending);
  const dispatch = session.dispatch;
  const client = useMemo(() => assistantForBuild(undefined, undefined, randomUUID), []);
  const list = useRef<FlatList<Message>>(null);
  // `pinned`: the reader is at the end of the thread. Only the reader's own scrolls (a drag and its momentum, a tap on the
  // status bar) change it, so
  // neither the list's own scrollToEnd nor the viewport shrinking under the keyboard can unpin it.
  const scroll = useRef({ content: 0, viewport: 0, pinned: true, reading: false });
  // Coming back to a conversation that is already there (from the hub's «Continuar»): open at its last exchange, once.
  const returning = useRef(messages.length > 0);
  // The rows already there when the screen mounts are restored history, not arrivals: they skip their entrance.
  const restored = useRef<ReadonlySet<string> | null>(null);
  restored.current ??= new Set(messages.map(message => message.id));

  const currencies = availableCurrencies(snapshot?.accounts ?? []);
  const currency: Currency = typeof params.currency === 'string' && currencies.includes(params.currency as Currency) ? params.currency as Currency : currencies[0] ?? 'ARS';
  // The accounts an expense may post to now, as the review draft's own rule (`postingAccountsFor`): never an archived or
  // deleted card, so no chip or implied account is one the capture would then drop.
  const accounts = useMemo(() => postingAccountsFor('expense', snapshot?.accounts ?? [], archive?.cards, archive?.debts), [snapshot?.accounts, archive?.cards, archive?.debts]);
  // An income draft may only land in a cash account (24B6); a card is neither offered nor implied for it.
  const incomeAccounts = useMemo(() => postingAccountsFor('income', snapshot?.accounts ?? [], archive?.cards, archive?.debts), [snapshot?.accounts, archive?.cards, archive?.debts]);
  const entries = snapshot?.entries ?? [];
  const busy = phase !== 'idle';
  const preview = client.mode === 'fixture';

  /** A resolved draft becomes a proposal with its ids fixed now (a retry reuses them); anything else passes through. The
   * basis is taken from the ledger as it is when the answer arrives (a ref), not when the request was sent. */
  const latest = useRef(archive);
  latest.current = archive;
  const toContent = useCallback((content: AssistantContent | ResolvedContent | null): AssistantContent | null => {
    if (content?.kind !== 'draft') return content;
    // 25A-04 capture rule: an unstated date is the device's local day now, at capture (`todayKey()`), never a guess.
    return proposalContent(assistantCapture(content.draft, (latest.current ?? { accounts: [], records: [] }) as ReviewArchive,
      { id: randomUUID(), writeId: randomUUID() }, new Date().toISOString(), todayKey()), preview);
  }, [preview]);

  /** Producto 25D2: iOS has no live regions, so VoiceOver is told what the thread did, once per event and from the handler
   * that dispatched it (never from the messages: the thread is mounted again on every visit and would read its history
   * aloud): the request going out, the finished reply (never a streamed piece), the next question after a chip, a note, a
   * capture that failed. Only while the Assistant is in front (a reply that lands under the review sheet, or after the
   * person left, is not spoken over another screen), in the words the thread shows, read when they are said, so a language
   * change mid-answer is followed. The reply sheet a capture presents speaks for itself. */
  const front = useRef(false);
  // One push per tap on «Revisar» or «Ver movimiento»: a second tap while the sheet rises never stacks a second one. Open
  // again once the Assistant is in front again.
  const navigating = useRef(false);
  const pushOnce = useCallback((to: Parameters<typeof router.push>[0]) => {
    if (navigating.current) return;
    navigating.current = true;
    router.push(to);
  }, []);
  const words = useRef({ t, errorText });
  words.current = { t, errorText };
  const say = useCallback((text: string) => { if (front.current) announce(text); }, []);
  const sayReply = useCallback(() => {
    const reply = session.getState().conversation.messages.at(-1);
    if (reply?.role !== 'assistant') return;
    const text = reply.textKey ? words.current.t(reply.textKey) : reply.text;
    if (text) say(words.current.t('assistant.message.assistant', { text }));
  }, [session, say]);
  const sayNote = useCallback((text: string) => say(words.current.errorText(text)), [say]);

  /** While the Assistant is the screen in front it registers, on the session, how to present the review sheet. A capture
   * takes the presenter (clearing it) once its item is stored: at most one sheet at a time, only over an Assistant in
   * front, and the one in front now even if the request was sent from an earlier mount. Coming back (a sheet closed)
   * registers it again. */
  useFocusEffect(useCallback(() => {
    const present = (itemId: string) => { router.push({ pathname: '/review-sheet/[id]', params: { id: itemId } }); };
    session.presenter.current = present;
    front.current = true;
    navigating.current = false;
    return () => { front.current = false; if (session.presenter.current === present) session.presenter.current = null; };
  }, [session]));

  /** Stores a proposal in the review store, from the session (so it finishes even if the screen closes). Only a proposal
   * not yet captured is sent, always as it was frozen; a failure writes nothing anywhere and leaves Reintentar. Once the
   * item is durably stored, and only then, the review sheet is presented over the Assistant if it is still in front; if
   * not (the person left, or another sheet is open), the card offers «Revisar» and the item waits in «Para revisar». */
  const capture = useCallback(async (messageId: string) => {
    const message = session.getState().conversation.messages.find(item => item.id === messageId);
    if (message?.role !== 'assistant' || message.content?.kind !== 'proposal') return;
    const { status, capture: frozen } = message.content;
    if (status === 'preview' || status === 'captured') return;
    if (status === 'capturing' && session.capturing.has(messageId)) return;
    session.capturing.add(messageId);
    dispatch({ type: 'proposal', messageId, status: 'capturing' });
    try {
      await captureReview({ id: frozen.id, writeId: frozen.writeId, captureKey: frozen.captureKey, draft: frozen.draft, at: frozen.at });
      dispatch({ type: 'proposal', messageId, status: 'captured' });
      const present = session.presenter.current;
      session.presenter.current = null;
      present?.(frozen.id);
    } catch {
      dispatch({ type: 'proposal', messageId, status: 'failed' });
      say(words.current.t('assistant.proposal.failed'));
    } finally {
      session.capturing.delete(messageId);
    }
  }, [session, dispatch, captureReview, say]);
  /** Every proposal the thread just added that is waiting for its capture. */
  const captureNew = useCallback(() => {
    for (const message of session.getState().conversation.messages) {
      if (message.role === 'assistant' && message.content?.kind === 'proposal' && message.content.status === 'capturing' && !session.capturing.has(message.id)) void capture(message.id);
    }
  }, [session, capture]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || session.request.current) return;
    // A tick says the message left; the disconnected build sends nothing, so it gives none before its note.
    if (client.mode !== 'disconnected') impactHaptic();
    dispatch({ type: 'send', text });
    const action = classifyIntent(text);
    // Protocol v5 carries every currency of the domain's creation gate (a held three-decimal one never), for recording and
    // for questions: a question's facts travel as exact decimals in that currency's major units (JPY and CLP included).
    if (!isLedgerCurrency(currency)) { dispatch({ type: 'fail', reason: 'unavailable', text: REASON_TEXT.unavailable, sent: raw }); sayNote(REASON_TEXT.unavailable); return; }
    const facts = action === 'explain' && snapshot ? monthlyEvidence(snapshot, currency, day) : [];
    const controller = new AbortController();
    session.request.current = controller;
    // The thinking state, said once as the request leaves (the disconnected build says only its note).
    if (client.mode !== 'disconnected') say(words.current.t('assistant.message.thinkingLabel'));
    try {
      // The region and the language are the interface's, as configured when the ask is sent (protocol v3): the region lets a
      // regional currency word («pesos») resolve, the language is the one the reply is written in; the message keeps it.
      for await (const event of client.ask({ action, text, todayISO: day, currency, region, language, facts }, controller.signal)) {
        if (controller.signal.aborted) break;
        if (event.type === 'delta') dispatch({ type: 'delta', text: event.text, language });
        else if (event.type === 'result') {
          const { content, ...rest } = contentFromResult(event.result, event.facts, accounts, entries, currency, day, incomeAccounts);
          // The facts count the accounts in `currency` only: with other currencies in the ledger the rows say so, so they are
          // never read as Inicio's consolidated total.
          const scoped = content?.kind === 'answer' && historyCurrencies(snapshot?.accounts ?? []).length > 1 ? { ...content, scoped: true } : content;
          dispatch({ type: 'answer', ...rest, content: toContent(scoped), language });
          sayReply();
          // 25A-06 (decision A): a name the model copied past its bound was left null at the server, never cut: the thread
          // says which one right under the reply, and the review (the card's row, the sheet's gap, Editar) asks for it.
          for (const field of event.dropped ?? []) { dispatch({ type: 'note', reason: 'info', text: DROPPED_TEXT[field] }); sayNote(DROPPED_TEXT[field]); }
          captureNew();
        }
        // A failure's message is the integration client's catalogue key or empty (then the reason's own note); the note translates it through errorText.
        else {
          const note = event.reason === 'failed' && event.message ? event.message : REASON_TEXT[event.reason];
          dispatch({ type: 'fail', reason: event.reason, text: note, sent: raw });
          sayNote(note);
        }
      }
    } catch {
      if (!controller.signal.aborted) { dispatch({ type: 'fail', reason: 'failed', text: REASON_TEXT.failed, sent: raw }); sayNote(REASON_TEXT.failed); }
    } finally {
      if (session.request.current === controller) session.request.current = null;
    }
  }, [client, session, dispatch, snapshot, accounts, incomeAccounts, entries, currency, region, language, day, toContent, captureNew, say, sayReply, sayNote]);

  const stop = useCallback(() => { session.request.current?.abort(); session.request.current = null; dispatch({ type: 'stop' }); }, [session, dispatch]);

  // `shown` is what the chip displayed: it becomes the user's own words in the thread.
  const choose = useCallback((messageId: string, option: ClarificationOption, shown?: string) => {
    const state = session.getState().conversation;
    const resolved = state.pending && ownsPending(state, messageId) ? completeDraft(state.pending, option.id, accounts, entries, day, incomeAccounts) : null;
    const next = resolved ? { ...resolved, content: toContent(resolved.content)! } : null;
    dispatch({ type: 'choose', messageId, optionId: option.id, label: shown ?? optionText(option, t), next });
    if (next) sayReply();
    captureNew();
  }, [session, dispatch, accounts, incomeAccounts, entries, day, t, toContent, captureNew, sayReply]);

  // A captured proposal that is not in the tray is read from the store itself. Confirmed or dismissed there, the card
  // keeps that item (a confirmed card draws what was recorded, edits included) and it is never looked up again. Still
  // pending (the tray could not be read again after the capture), the card shows the stored item, «Revisar» opens it (the
  // sheet reads the store too) and the tray is asked to reload; it is read again whenever the tray changes or a review
  // operation ran (`reviewVersion`: a confirmation or an edit whose tray reload failed). Unreadable or failing: nothing is
  // kept and the card keeps «Revisar».
  const tray = review && review !== 'unavailable' ? review : null;
  const [stored, setStored] = useState<Record<string, ReviewItem | null>>({});
  const captured = messages.flatMap(item => item.role === 'assistant' && item.content?.kind === 'proposal' && item.content.status === 'captured' ? [item.content.capture.id] : []);
  const settled = (id: string) => stored[id] === null || (!!stored[id] && stored[id]!.status !== 'pending');
  const missing = tray ? captured.filter(id => !tray.items.some(row => row.id === id) && !settled(id)) : [];
  // The provider's functions are new on every render: they are read through refs, and the effect runs only when the set of
  // missing proposals or the tray itself changes, so a lookup never re-renders into another lookup.
  const lookup = useRef({ getReviewItem, refreshReview });
  lookup.current = { getReviewItem, refreshReview };
  useEffect(() => {
    let live = true;
    for (const id of missing) {
      lookup.current.getReviewItem(id).then(item => {
        if (!live) return;
        setStored(current => ({ ...current, [id]: item }));
        if (item?.status === 'pending') void lookup.current.refreshReview();
      }, () => { /* Unknown: the card keeps «Revisar». */ });
    }
    return () => { live = false; };
  }, [missing.join(','), tray, reviewVersion]);
  const proposalState = (content: ProposalContent): ProposalState => {
    if (content.status !== 'captured') return { kind: content.status };
    const id = content.capture.id;
    const item = tray?.items.find(row => row.id === id) ?? (stored[id]?.status === 'pending' ? stored[id]! : undefined);
    if (item) return { kind: 'pending', item, conflict: !!tray?.conflicts.includes(item.id), writable: tray?.writable ?? false };
    const closed = stored[id];
    if (closed === null) return { kind: 'gone' };
    if (closed?.status === 'confirmed' && closed.receipt) return { kind: 'confirmed', item: closed, record: closed.receipt.type };
    if (closed?.status === 'dismissed') return { kind: 'dismissed' };
    return { kind: 'unknown' };
  };

  /** The next step when the Assistant cannot help now: the manual expense form, in the screen's currency when an account holds it. */
  const recordManually = useCallback(() => {
    router.push({ pathname: '/new-entry', params: { kind: 'expense', ...(currencies.includes(currency) ? { currency } : {}) } });
  }, [currencies.join(','), currency]);

  const open = useCallback((href: EvidenceLink['href']) => {
    // 25Q4: Movimientos opens whole and from the top on a fresh `reset`, made at the tap, so the same evidence followed twice
    // resets twice (the dock keeps a search, a filter and the scroll).
    const params = href.pathname === '/activity' ? { ...href.params, reset: String(Date.now()) } : href.params;
    const to = params ? { pathname: href.pathname, params } : href.pathname;
    if (TAB_ROOTS.has(href.pathname)) router.dismissTo(to);
    else router.push(to);
  }, []);

  // Follow the thread only while the reader is at its end; a reader who scrolled up is never pulled back down. Whether
  // they are is read from their own scrolls, at the moment they scroll, against the viewport of that moment.
  const read = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    scroll.current.pinned = shouldAutoscroll(contentOffset.y, contentSize.height, layoutMeasurement.height);
  };
  const reading = (on: boolean) => (event: NativeSyntheticEvent<NativeScrollEvent>) => { scroll.current.reading = on; read(event); };
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => { if (scroll.current.reading) read(event); };
  /** A tap on the status bar takes the reader to the top without a drag: they left the end, so a streamed word no longer
   * pulls them back down (read against the sizes the list last reported; the content may still fit the viewport). */
  const onScrollToTop = () => { scroll.current.pinned = shouldAutoscroll(0, scroll.current.content, scroll.current.viewport); };
  /** A reopened thread: until both sizes are known nothing scrolls; then one jump to its end, not animated. */
  const returnToEnd = () => {
    if (!returning.current) return false;
    if (scroll.current.content <= 0 || scroll.current.viewport <= 0) return true;
    returning.current = false;
    list.current?.scrollToEnd({ animated: false });
    return true;
  };
  /** New content (a message, a streamed word): followed with the list's own scroll, still under Reduce Motion. */
  const onContentSizeChange = (_width: number, height: number) => {
    scroll.current.content = height;
    if (!returnToEnd() && scroll.current.pinned) list.current?.scrollToEnd({ animated: !reduced });
  };
  /** The viewport changed (the keyboard rising or falling, a rotation): a reader at the end stays at the end, in lockstep
   * with the frame and never animated (each frame of the keyboard is a layout; an animation would chase a moving end). */
  const onLayout = (height: number) => {
    const before = scroll.current.viewport;
    scroll.current.viewport = height;
    if (!returnToEnd() && before > 0 && before !== height && scroll.current.pinned) list.current?.scrollToEnd({ animated: false });
  };

  const renderItem = ({ item }: { item: Message }) => restored.current!.has(item.id) ? <Restored>{row(item)}</Restored> : row(item);
  const row = (item: Message) => {
    if (item.role === 'user') return <Appear><UserMessage text={item.text} /></Appear>;
    if (item.role === 'system') return <Appear><SystemNote message={item} onRetry={text => void send(text)} onRecord={recordManually} /></Appear>;
    return <View style={{ gap: space.m }}>
      {(item.text || item.textKey || item.status === 'streaming') && <AssistantText text={item.textKey ? t(item.textKey) : item.text} ownWords={!!item.textKey} status={item.status} language={item.language} />}
      {item.content?.kind === 'answer' && <AnswerEvidence content={item.content} onOpen={open} />}
      {/* Chips answer only the app's own question that holds the parked draft: a chip of the model's question (nothing to
          complete; a request carries no previous turn) or of an older one would only echo its words. Those are answered by typing. */}
      {item.content?.kind === 'clarification' && ownsPending({ messages, pending }, item.id) && <ClarificationChoices options={item.content.options} chosen={item.content.chosen} onChoose={(option, shown) => choose(item.id, option, shown)} />}
      {item.content?.kind === 'proposal' && <ProposalCard content={item.content} state={proposalState(item.content)} archive={archive as ReviewArchive | null}
        onReview={id => pushOnce({ pathname: '/review-sheet/[id]', params: { id } })} onRetry={() => void capture(item.id)}
        onOpenRecord={(record, id) => pushOnce(record === 'plan' ? { pathname: '/installment/[id]', params: { id } } : { pathname: '/entry/[id]', params: { id } })} />}
    </View>;
  };

  // 24UX6C: no permanent «not connected» line. In a disconnected build the limitation is said where it matters: a sent
  // message (typed or a suggestion) gets the `unavailable` note in the thread and its words go back to the composer.

  return <View style={{ flex: 1, backgroundColor: p.background }}>
    <Stack.Screen options={{ title: t('assistant.title'),
      headerRight: messages.length ? () => <IconButton name="create-outline" label={t('assistant.newChat')} onPress={session.reset} /> : undefined }} />
    {client.mode === 'fixture' && <View accessible accessibilityRole="text" accessibilityLanguage={speechLanguage} style={{ backgroundColor: p.warningSoft, paddingHorizontal: space.xl, paddingVertical: space.s }}>
      <AppText variant="footnote" style={{ color: p.warning, fontWeight: '600', textAlign: 'center' }}>{t('assistant.fixtureBanner')}</AppText>
    </View>}
    <FlatList ref={list} data={messages} keyExtractor={message => message.id} renderItem={renderItem}
      contentInsetAdjustmentBehavior="automatic" keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled"
      onScroll={onScroll} scrollEventThrottle={32} onScrollBeginDrag={reading(true)} onScrollEndDrag={reading(false)}
      onMomentumScrollBegin={reading(true)} onMomentumScrollEnd={reading(false)} onScrollToTop={onScrollToTop}
      onLayout={event => onLayout(event.nativeEvent.layout.height)} onContentSizeChange={onContentSizeChange}
      contentContainerStyle={{ padding: space.xl, gap: space.l, flexGrow: 1, justifyContent: messages.length ? 'flex-start' : 'center' }}
      ListEmptyComponent={<Suggestions items={SUGGESTIONS.map(key => t(key))} onPick={text => void send(text)} disabled={busy} />} />
    <Composer session={session} onSend={text => void send(text)} onStop={stop} busy={busy} />
  </View>;
}

/** The composer with its own subscription to the draft words: a keystroke re-renders this, not the thread. */
function Composer({ session, onSend, onStop, busy }: { session: ReturnType<typeof conversationSession>; onSend: (text: string) => void; onStop: () => void; busy: boolean }) {
  const value = useSyncExternalStore(session.subscribe, () => session.getState().conversation.composer, () => session.getState().conversation.composer);
  return <AssistantComposer value={value} onChange={text => session.dispatch({ type: 'compose', text })} onSend={() => onSend(value)} onStop={onStop} busy={busy} />;
}
