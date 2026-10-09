import { isLegacyCurrency, majorStringToMinor, type Account, type Currency, type Entry, type EntryKind, type LegacyCurrency, type ReviewDraft } from '@finanzapp/domain';
import type { AssistantFact } from '../../../../packages/integrations/contracts.js';
import type { AssistantResultV2, ClarificationField, DroppableField, NavigationIntent, ProposalDraft } from '../../../../packages/integrations/assistant-protocol.js';
import { factCategory } from '../integrations/evidence.ts';
import type { LanguageCode } from '../i18n/locale.ts';
import { translator, type MessageKey, type Translate } from '../i18n/messages.ts';

/** The Assistant conversation as pure data: one current conversation, messages
 * in local order, a composer draft and a phase. Nothing here touches React,
 * React Native, SQLite or the network, so the reducer runs in Node tests and
 * the screen only renders it. Chat history, folders and search are not a
 * FinanzApp feature: the conversation is ephemeral and resets on demand.
 *
 * Two product rules live in this module and nowhere else:
 * - a parsed sentence becomes a **proposal**: since 25A-04 it is captured as a review item (`ProposalContent`) and
 *   reviewed, confirmed or discarded in «Para revisar» only; nothing in the conversation builds or writes an Entry;
 * - a financially meaningful gap (which account paid, what kind, how much)
 *   becomes a **clarification** with real options, never a silent guess.
 *
 * Language: this module holds no interface copy. What the app itself says
 * (its clarification questions, option labels, notes, evidence names and link
 * labels) is stored as a catalogue key and translated when it is rendered, so
 * a thread already on screen follows a language change. The model's words
 * (`AssistantResultV2.message`) and the user's words are content: stored and
 * shown exactly as they arrived, never translated. */

export type AssistantReason = 'unavailable' | 'session' | 'offline' | 'limit' | 'failed' | 'info';

/** What an evidence row is about, from the fact id (plus the stored category
 * name), so the screen names it in the interface language. `other` is a fact
 * this build has no name for (a future id): its protocol label is shown as is. */
export type EvidenceSubject = { kind: 'expenses' } | { kind: 'income' } | { kind: 'refunds' } | { kind: 'category'; category: string } | { kind: 'other'; label: string };
/** A number the answer rests on, taken from the local evidence that was sent,
 * never from model prose. `previousOnly`: cited only for the previous period. */
export type EvidenceRow = { id: string; subject: EvidenceSubject; previousOnly: boolean; amountMinor: number; signed: boolean };
/** A link under an answer; `id` is stable data, its label is `assistant.links.<id>` at render. */
export type EvidenceLinkId = 'movements' | 'category' | 'budget';
export type EvidenceLink = { id: EvidenceLinkId; href: { pathname: string; params?: Record<string, string> } };

/** What `resolveDraft` reads: a protocol v4 proposal, or a parked draft re-read (its kind may still be unknown). */
export type DraftInput = Omit<ProposalDraft, 'kind'> & { kind: EntryKind | null };

export type ResolvedDraft = {
  /** `amountMinor` is the model's `amount` scaled by the resolved currency's exponent (`majorStringToMinor`), never before
   * the currency is known; `amount` is that decimal as the model stated it, kept so a parked draft is scaled again by the
   * currency it is finally resolved in. */
  kind: EntryKind; amountMinor: number; amount?: string; currency: Currency; merchant: string; category: string; dateISO: string;
  /** Null until the user names the account: the reducer never picks one when several could pay. */
  accountId: string | null;
  /** 25A-04: whether the model's draft named the currency and the date. When it did not, the conversation still offers
   * the accounts of the screen's currency and shows today, as before, but the review draft keeps both unknown
   * (`reviewDraftFromAssistant`): neither is ever invented in what is captured. Absent means stated. */
  currencyStated?: boolean;
  dateStated?: boolean;
  /** 25A-04: whether the person named the account (matched by name) or chose it in a clarification, rather than it being
   * the one account of the screen's currency that fits. Only a stated destination lends its currency to an unstated one. */
  destinationStated?: boolean;
  /** 25A-04: the account the model named («con la Visa»), kept while a clarification about something else is open, so the
   * next turn still matches it (and it still counts as stated). Conversation data only, never captured. */
  paymentMethodRef?: string | null;
  /** 25A-06 (owner decision D): the model stated no currency and the device resolved it by a rule: the destination the
   * person named or chose lends its own, every destination the domain offers for the kind shares one currency, or the
   * person chose it in a clarification. Captured as the draft's currency (`reviewDraftFromAssistant`), visible and
   * editable in the review. Absent or false with `currencyStated` false: the currency is only the screen's, for the
   * conversation, never captured. */
  currencyInferred?: boolean;
};

export type DraftField = 'kind' | 'amount' | 'currency' | 'paymentMethod' | 'category';
/** A chip under a clarification. `label` is user data shown as is (an account
 * name); `labelKey` is the app's own word (Gasto/Ingreso), translated at
 * render; `category` marks a stored category name of that kind, shown with its
 * localized built-in name when it has one (an income preset is only found as
 * income); `currency` is a currency to choose, shown by its name in the
 * interface language. Exactly one of `label`, `labelKey` and `currency` is set. */
export type ClarificationOption = { id: string; label?: string; labelKey?: MessageKey; category?: EntryKind; currency?: Currency };

/** The words a chip shows (and that are repeated as the user's message once chosen). A currency chip shows the
 * currency's name in the interface language when the caller can name it, its code otherwise. */
export function optionText(option: ClarificationOption, t: Translate = translator('es'), currencyName?: (currency: Currency) => string): string {
  if (option.currency) return currencyName ? currencyName(option.currency) : option.currency;
  return option.labelKey ? t(option.labelKey) : option.label ?? '';
}

/** `currency` is the one the facts were computed in: the rows keep it even if the screen later shows another. */
export type AnswerContent = { kind: 'answer'; rows: EvidenceRow[]; links: EvidenceLink[]; currency: Currency };
/** A resolved draft before the screen turns it into a proposal (it never reaches the reducer). */
export type ResolvedContent = { kind: 'draft'; draft: ResolvedDraft };
/** 25A-04: the frozen capture of one Assistant proposal into the review store: its item id, its write id and its capture
 * key are fixed once, with the review draft, so a retry resends exactly the same capture (the store answers a repeat with
 * the item it already holds, never a second one, and never overwrites an item edited since). */
export type AssistantCapture = { id: string; writeId: string; captureKey: string; at: string; draft: ReviewDraft };
/** A financial proposal in the thread. `capture.draft` is a snapshot to draw while the item is not (yet) in the store;
 * once captured, the review item is the only source of truth and the card reads it, never this snapshot.
 * - `preview`: the fixture view; never captured;
 * - `capturing` / `failed`: the capture is in flight / did not land (nothing was written anywhere; Reintentar resends it);
 * - `captured`: the review item exists. */
export type ProposalContent = { kind: 'proposal'; capture: AssistantCapture; status: 'preview' | 'capturing' | 'failed' | 'captured' };
export type ClarificationContent = { kind: 'clarification'; field: DraftField | null; options: ClarificationOption[]; chosen: string | null };
export type AssistantContent = AnswerContent | ProposalContent | ClarificationContent;

export type Message =
  | { id: string; role: 'user'; text: string }
  /** `text` is the model's prose, untouched. `textKey` is set instead when the
   * app itself speaks (a clarification it asks); the screen translates it. `language` is the interface language the
   * reply was asked in (protocol v3), kept with the message so VoiceOver reads it in that language after a change. */
  | { id: string; role: 'assistant'; status: 'streaming' | 'done' | 'stopped'; text: string; textKey?: MessageKey; content: AssistantContent | null; language?: LanguageCode }
  /** `text` is a catalogue key (the app's own notes) or a caught message; the note shows it through `errorText`. */
  | { id: string; role: 'system'; reason: AssistantReason; text: string; retryText: string | null };

export type Phase = 'idle' | 'thinking' | 'streaming';

export type ConversationState = {
  messages: Message[];
  composer: string;
  phase: Phase;
  /** A draft parked behind a clarification; completed by the chosen option. */
  pending: { draft: Partial<ResolvedDraft>; field: DraftField } | null;
  nextId: number;
};

export const emptyConversation: ConversationState = { messages: [], composer: '', phase: 'idle', pending: null, nextId: 1 };

export type ConversationAction =
  | { type: 'compose'; text: string }
  | { type: 'send'; text: string }
  | { type: 'delta'; text: string; language?: LanguageCode }
  | { type: 'answer'; text: string; textKey?: MessageKey; content: AssistantContent | null; pending?: ConversationState['pending']; language?: LanguageCode }
  | { type: 'fail'; reason: AssistantReason; text: string; sent: string }
  | { type: 'stop' }
  | { type: 'choose'; messageId: string; optionId: string; label: string; next: { textKey: MessageKey; content: AssistantContent; pending: ConversationState['pending'] } | null }
  /** 25A-04: the capture of a proposal into the review store started, landed or failed. */
  | { type: 'proposal'; messageId: string; status: 'capturing' | 'captured' | 'failed' }
  /** A note the screen adds outside a request (a refused confirm, a test-view reminder). */
  | { type: 'note'; reason: AssistantReason; text: string }
  | { type: 'reset' };

const id = (state: ConversationState, prefix: string) => `${prefix}-${state.nextId}`;

/** 25A-05: whether a tapped clarification owns the parked draft. The draft is parked by the newest assistant message
 * (an answer or a chosen option always replaces it), so a chip on an older clarification only repeats its words: it
 * never completes, clears or changes the draft parked behind a newer question. */
export function ownsPending(state: ConversationState, messageId: string): boolean {
  return state.pending !== null && state.messages.findLast(message => message.role === 'assistant')?.id === messageId;
}

export function conversationReducer(state: ConversationState, action: ConversationAction): ConversationState {
  switch (action.type) {
    case 'compose':
      return state.composer === action.text ? state : { ...state, composer: action.text };
    case 'send': {
      const text = action.text.trim();
      if (!text || state.phase !== 'idle') return state;
      return { ...state, messages: [...state.messages, { id: id(state, 'u'), role: 'user', text }], composer: '', phase: 'thinking', nextId: state.nextId + 1 };
    }
    case 'delta': {
      if (state.phase === 'idle') return state;
      const last = state.messages.at(-1);
      if (last?.role === 'assistant' && last.status === 'streaming') {
        return { ...state, phase: 'streaming', messages: [...state.messages.slice(0, -1), { ...last, text: last.text + action.text }] };
      }
      return { ...state, phase: 'streaming', nextId: state.nextId + 1,
        messages: [...state.messages, { id: id(state, 'a'), role: 'assistant', status: 'streaming', text: action.text, content: null, ...(action.language ? { language: action.language } : {}) }] };
    }
    case 'answer': {
      if (state.phase === 'idle') return state;
      const last = state.messages.at(-1);
      const done = { role: 'assistant' as const, status: 'done' as const, text: action.text, content: action.content, ...(action.textKey ? { textKey: action.textKey } : {}),
        ...(action.language ? { language: action.language } : {}) };
      const messages = last?.role === 'assistant' && last.status === 'streaming'
        ? [...state.messages.slice(0, -1), { ...last, ...done, text: action.textKey ? '' : action.text || last.text }]
        : [...state.messages, { id: id(state, 'a'), ...done }];
      return { ...state, messages, phase: 'idle', pending: action.pending ?? null, nextId: state.nextId + 1 };
    }
    case 'fail': {
      if (state.phase === 'idle') return state;
      const last = state.messages.at(-1);
      const withoutPartial = last?.role === 'assistant' && last.status === 'streaming' && !last.text ? state.messages.slice(0, -1) : state.messages;
      if (action.reason === 'unavailable' || action.reason === 'session') {
        // Nothing left the device: the user's words go back to the composer, exactly as typed, and the thread only keeps the note.
        const lastUser = withoutPartial.findLast(message => message.role === 'user');
        const withoutUser = withoutPartial.filter(message => message !== lastUser);
        return { ...state, phase: 'idle', composer: action.sent,
          messages: [...withoutUser, { id: id(state, 's'), role: 'system', reason: action.reason, text: action.text, retryText: null }], nextId: state.nextId + 1 };
      }
      return { ...state, phase: 'idle',
        messages: [...withoutPartial, { id: id(state, 's'), role: 'system', reason: action.reason, text: action.text, retryText: action.sent }], nextId: state.nextId + 1 };
    }
    case 'stop': {
      if (state.phase === 'idle') return state;
      const last = state.messages.at(-1);
      const messages = last?.role === 'assistant' && last.status === 'streaming'
        ? last.text ? [...state.messages.slice(0, -1), { ...last, status: 'stopped' as const }] : state.messages.slice(0, -1)
        : state.messages;
      return { ...state, phase: 'idle', messages };
    }
    case 'choose': {
      const index = state.messages.findIndex(message => message.id === action.messageId);
      const message = state.messages[index];
      if (!message || message.role !== 'assistant' || message.content?.kind !== 'clarification' || message.content.chosen) return state;
      const chosen = { ...message, content: { ...message.content, chosen: action.optionId } };
      const messages = [...state.messages.slice(0, index), chosen, ...state.messages.slice(index + 1),
        { id: id(state, 'u'), role: 'user' as const, text: action.label }];
      const owner = ownsPending(state, action.messageId);
      if (action.next && owner) messages.push({ id: `a-${state.nextId + 1}`, role: 'assistant', status: 'done', text: '', textKey: action.next.textKey, content: action.next.content });
      return { ...state, messages, pending: owner ? action.next?.pending ?? null : state.pending, nextId: state.nextId + 2 };
    }
    case 'proposal': {
      // A preview never captures, and a captured proposal never goes back: its item is the source of truth from then on.
      const target = state.messages.find(message => message.id === action.messageId);
      if (!target || target.role !== 'assistant' || target.content?.kind !== 'proposal') return state;
      const current = target.content.status;
      if (current === 'preview' || current === 'captured' || current === action.status) return state;
      const content: ProposalContent = { ...target.content, status: action.status };
      return { ...state, messages: state.messages.map(message => message === target ? { ...target, content } : message) };
    }
    case 'note':
      return { ...state, messages: [...state.messages, { id: id(state, 's'), role: 'system', reason: action.reason, text: action.text, retryText: null }], nextId: state.nextId + 1 };
    case 'reset':
      return { ...emptyConversation, nextId: state.nextId };
  }
}

/** The four prompts an empty conversation offers, as catalogue keys. Never
 * more; they disappear once a conversation starts. A tapped chip sends its
 * text in the interface language, as if the user had typed it. */
export const SUGGESTIONS = ['assistant.suggestions.whySpentMore', 'assistant.suggestions.foodSpending', 'assistant.suggestions.recordExpense',
  'assistant.suggestions.budgetProgress'] as const satisfies readonly MessageKey[];

/** A question about recorded money is explained against local evidence;
 * anything else is parsed as an action. It reads the user's own words, so it
 * knows the question openers of every interface language. */
export function classifyIntent(text: string): 'explain' | 'parse' {
  const t = text.trim().toLowerCase();
  if (/[?¿]/.test(t)) return 'explain';
  return /^(cu[aá]nt[oa]s?|por qu[eé]|c[oó]mo voy|cu[aá]l|qu[eé] tal|how (much|many|am i|is|are)|why|what)\b/.test(t) ? 'explain' : 'parse';
}

/** Whether new content should pull the list to its end: only when the reader is already near it. */
export function shouldAutoscroll(offsetY: number, contentHeight: number, viewportHeight: number, threshold = 80): boolean {
  if (contentHeight <= viewportHeight) return true;
  return contentHeight - viewportHeight - offsetY <= threshold;
}

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
/** Folded words joined by one space, so a name is matched as whole words, never as a fragment of another word. */
const words = (value: string) => fold(value).split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean).join(' ');
/** 25A-05: the person's words for a means of payment as the model copies them («con la Visa», "my Visa", «en efectivo»),
 * without a leading preposition and article or possessive, so they are matched against account names like a bare name. */
const reference = (value: string) => {
  const name = words(value).replace(/^(?:(?:con|with|on|en) )?(?:(?:la|el|los|las|mi|mis|my|the) )?/, '');
  // Only a preposition or an article («con la») names no account: matched as is it would find any «La …» account.
  return /^(?:con|with|on|en|la|el|los|las|mi|mis|my|the)$/.test(name) ? '' : name;
};

/** Categories the user has already recorded for that kind, most used first, as chips for a category clarification. */
export function categoryOptions(entries: Entry[], kind: EntryKind, limit = 4): ClarificationOption[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const entry of entries) {
    if (entry.kind !== kind) continue;
    const key = fold(entry.category);
    const current = counts.get(key);
    if (current) current.count += 1; else counts.set(key, { label: entry.category, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit)
    .map(item => ({ id: item.label, label: item.label, category: kind }));
}

/** The minor units of a stated amount in the resolved currency, or null when it has no exact value there: more decimals
 * than the currency has («1.999» pesos, «12.5» yen) or more digits than an amount may have. Never rounded or cut. */
function minorIn(amount: string, currency: Currency): number | null {
  const reading = majorStringToMinor(amount, currency);
  return reading.ok && reading.minor > 0 ? reading.minor : null;
}

/** Turn a draft (a protocol proposal, or a parked draft re-read; every field nullable) into either a confirmable draft
 * or the one clarification that blocks it, in this order: kind, amount, then currency and destination together, then
 * category. `accounts` are the destinations the domain offers an expense; `incomeAccounts` an income (cash only, 24B6).
 *
 * Amount (protocol v4, 25A-06): the model states the number the person meant as an exact decimal in major units; it is
 * scaled to minor units here, by the resolved currency's exponent (`majorStringToMinor`), only once that currency is
 * known. An amount the currency cannot hold exactly is asked again, never rounded.
 *
 * Currency, by the owner's decision D (25A-06), on the device and never by the model, which knows no account:
 * 1. a currency the person stated (the model's draft) takes precedence;
 * 2. with none stated, a named destination that matches exactly one account or card lends its currency;
 * 3. otherwise, when every destination the domain offers for the kind shares one currency, that currency is inferred;
 * 4. when several currencies are possible and nothing was named, the person is asked which currency, with those as chips;
 * 5. a currency never implies an account: among several destinations of that currency the person is asked;
 * 6. a named destination that matches none or several is asked about, never replaced by the only eligible account;
 * 7. a stated currency that contradicts the only account(s) the name matches is asked about, never converted;
 * 8. with no destination at all, the currency stays unknown (the screen's stands in for the conversation only) and the
 *    person is asked, with no chips;
 * 9. only a destination in a currency the protocol carries (ARS, USD: the model's amount is in its minor units) can lend
 *    its currency, be inferred or be offered; an account in another currency (JPY, MXN) never lends one, and a ledger
 *    that holds one next to ARS or USD asks instead of inferring, so «pesos» is never silently another currency (Codex
 *    review of PR #98); a name is ambiguous when it matches several destinations of any currency, carried or not, and
 *    the carried match is then asked about, never picked for being the only one the protocol can carry.
 * A named payment method matches an account whose name holds all its words, in order (accent- and case-insensitive:
 * "Visa" is "Visa Galicia", never account "a", and "Visa a crédito" is not "a" either). */
export function resolveDraft(draft: DraftInput, accounts: Account[], entries: Entry[], currency: Currency, todayISO: string, incomeAccounts: Account[] = accounts):
  { kind: 'draft'; draft: ResolvedDraft } | { kind: 'clarification'; field: DraftField; question: MessageKey; options: ClarificationOption[]; partial: Partial<ResolvedDraft> } {
  const stated = { currencyStated: draft.currency !== null, dateStated: draft.dateISO !== null, paymentMethodRef: draft.paymentMethodRef };
  const base: Partial<ResolvedDraft> = { merchant: draft.merchant ?? '', category: draft.category ?? '', dateISO: draft.dateISO ?? todayISO, ...stated,
    ...(draft.kind ? { kind: draft.kind } : {}), ...(draft.amount ? { amount: draft.amount } : {}) };
  // Until the kind is known the destinations are unknown too: the screen's currency stands in, for the conversation only.
  const partial: Partial<ResolvedDraft> = { currency: draft.currency ?? currency, currencyInferred: false, ...base };
  if (!draft.kind) return { kind: 'clarification', field: 'kind', question: 'assistant.clarify.kind',
    options: [{ id: 'expense', labelKey: 'movement.expense' }, { id: 'income', labelKey: 'movement.income' }], partial };
  if (!draft.amount) return { kind: 'clarification', field: 'amount', question: 'assistant.clarify.amount', options: [], partial };
  // An income goes to a cash account (24B6): a card is never offered or implied for it. Only a destination in a currency
  // the protocol carries can hold the draft (rule 9); the whole pool still decides whether the currency is ambiguous.
  const pool = draft.kind === 'income' ? incomeAccounts : accounts;
  const carried = pool.filter(account => isLegacyCurrency(account.currency));
  // Named but without a letter or digit ("💳") still names something: it matches nothing and is asked.
  const ref = draft.paymentMethodRef?.trim() ? reference(draft.paymentMethodRef) : null;
  const matches = (list: Account[]) => ref ? list.filter(account => ` ${words(account.name)} `.includes(` ${ref} `)) : [];
  const chips = (list: Account[]): ClarificationOption[] => list.map(account => ({ id: account.id, label: account.name }));
  const paidWith: MessageKey = draft.kind === 'expense' ? 'assistant.clarify.paidWith' : 'assistant.clarify.receivedIn';
  const ask = (field: DraftField, question: MessageKey, options: ClarificationOption[], resolved: Partial<ResolvedDraft>) =>
    ({ kind: 'clarification' as const, field, question, options, partial: { ...base, ...resolved, accountId: null } });
  let resolvedCurrency: Currency = draft.currency ?? currency;
  let currencyInferred = false;
  if (draft.currency) {
    // Rule 7: the name matches only account(s) in another currency: asked, with the destinations of the stated currency.
    if (ref && matches(pool.filter(account => account.currency === draft.currency)).length === 0 && matches(pool).length >= 1) {
      return ask('paymentMethod', 'assistant.clarify.currencyConflict', chips(carried.filter(account => account.currency === draft.currency)), { currency: draft.currency });
    }
  } else if (ref) {
    // Whether a name is ambiguous is decided against every destination offered for the kind, carried or not: «Galicia»
    // with a «Galicia» in pesos and a «Galicia MXN» matches two, and the carried one is never picked for being the only
    // one the protocol can carry (rule 6; an independent review of PR #98).
    const namedAll = matches(pool);
    const named = matches(carried);
    if (namedAll.length === 1 && named.length === 1) { resolvedCurrency = named[0].currency; currencyInferred = true; } // rule 2
    else {
      // Several matches, or only one the protocol cannot carry, or none: asked for the destination among the carried
      // matches, or among every carried destination, never replaced by one of them (25A-04); the choice settles the
      // currency, known already when every destination offered shares one carried currency.
      const currencies = [...new Set(pool.map(account => account.currency))];
      const shared = currencies.length === 1 && isLegacyCurrency(currencies[0]) ? currencies[0] : null;
      return ask('paymentMethod', paidWith, chips(named.length ? named : carried), shared ? { currency: shared, currencyInferred: true } : { currency, currencyInferred: false });
    }
  } else {
    // The currencies in play: every destination's, those the protocol cannot carry included.
    const currencies = [...new Set(pool.map(account => account.currency))];
    if (currencies.length === 1 && isLegacyCurrency(currencies[0])) { resolvedCurrency = currencies[0]; currencyInferred = true; } // rule 3
    else if (currencies.length > 1) {
      // Several currencies possible: the currency is asked, never guessed from the screen (rule 4), with the currencies
      // the protocol carries as chips; none in play (another currency only) is asked for the destination, with no chips.
      const offered = [...new Set(carried.map(account => account.currency))];
      if (offered.length) return ask('currency', 'assistant.clarify.currency', offered.map(code => ({ id: code, currency: code })), { currency, currencyInferred: false });
    }
  }
  const amountMinor = minorIn(draft.amount, resolvedCurrency);
  if (amountMinor === null) return { kind: 'clarification', field: 'amount', question: 'assistant.clarify.amount', options: [],
    partial: { ...base, amount: undefined, currency: resolvedCurrency, currencyInferred } };
  const eligible = carried.filter(account => account.currency === resolvedCurrency);
  const named = matches(eligible);
  const accountId = ref !== null ? (named.length === 1 ? named[0].id : null) : eligible.length === 1 ? eligible[0].id : null;
  const destinationStated = named.length === 1;
  const resolved: Partial<ResolvedDraft> = { currency: resolvedCurrency, currencyInferred, amountMinor };
  if (!accountId) return ask('paymentMethod', paidWith, chips(eligible), resolved);
  if (!draft.category) return { kind: 'clarification', field: 'category', question: 'assistant.clarify.category', options: categoryOptions(entries, draft.kind), partial: { ...base, ...resolved, accountId, destinationStated } };
  return { kind: 'draft', draft: { kind: draft.kind, amountMinor, amount: draft.amount, currency: resolvedCurrency, merchant: draft.merchant ?? '',
    category: draft.category, dateISO: draft.dateISO ?? todayISO, accountId, ...stated, currencyInferred, destinationStated } };
}

/** Apply a chosen option to a parked draft. Returns the next turn: another clarification (still parked) or the draft. */
export function completeDraft(pending: { draft: Partial<ResolvedDraft>; field: DraftField }, optionId: string, accounts: Account[], entries: Entry[], todayISO: string, incomeAccounts: Account[] = accounts):
  { textKey: MessageKey; content: ResolvedContent | ClarificationContent; pending: ConversationState['pending'] } {
  const draft = { ...pending.draft };
  if (pending.field === 'kind') draft.kind = optionId === 'income' ? 'income' : 'expense';
  else if (pending.field === 'paymentMethod') draft.accountId = optionId;
  else if (pending.field === 'category') draft.category = optionId;
  // A currency the person chose is theirs: resolved by the device's rule, captured, never a guess of the screen's.
  else if (pending.field === 'currency' && isLegacyCurrency(optionId)) { draft.currency = optionId; draft.currencyInferred = true; }
  // The currency is passed on only when it is known (stated by the model, chosen or inferred); otherwise the
  // re-resolution infers it again from the destinations left, or asks. The screen's currency stands in for display only.
  const known = (draft.currencyStated ?? true) || (draft.currencyInferred ?? false);
  const fallback: LegacyCurrency = isLegacyCurrency(draft.currency) ? draft.currency : 'ARS';
  // A named account is matched again (it was asked about something else first); a chosen one is already fixed below.
  const capture: DraftInput = { kind: draft.kind ?? null, amount: draft.amount ?? null, currency: known ? fallback : null, merchant: draft.merchant || null,
    category: draft.category || null, dateISO: draft.dateISO ?? null, paymentMethodRef: draft.accountId ? null : draft.paymentMethodRef ?? null };
  const chosen = (pool: Account[]) => draft.accountId ? pool.filter(account => account.id === draft.accountId) : pool;
  const next = resolveDraft(capture, chosen(accounts), entries, fallback, todayISO, chosen(incomeAccounts));
  // What the model stated is carried from the first turn: the re-resolution above passes a date, and a currency when known.
  // An account chosen now, or named or chosen in an earlier turn, is a stated destination; the one account left by the
  // filter above is not. A currency inferred or chosen in any turn stays inferred.
  const named = (resolved: { destinationStated?: boolean }) => resolved.destinationStated ?? false;
  const inferred = (resolved: { currencyInferred?: boolean }) => (draft.currencyInferred ?? false) || (resolved.currencyInferred ?? false);
  const stated = { currencyStated: pending.draft.currencyStated ?? true, dateStated: pending.draft.dateStated ?? true,
    paymentMethodRef: pending.draft.paymentMethodRef ?? null };
  const destinationStated = pending.field === 'paymentMethod' || (pending.draft.destinationStated ?? false);
  if (next.kind === 'draft') return { textKey: 'assistant.clarify.reviewDraft', pending: null,
    content: { kind: 'draft', draft: { ...next.draft, accountId: draft.accountId ?? next.draft.accountId, ...stated, currencyInferred: inferred(next.draft), destinationStated: destinationStated || named(next.draft) } } };
  return { textKey: next.question, content: { kind: 'clarification', field: next.field, options: next.options, chosen: null },
    pending: { draft: { ...next.partial, accountId: draft.accountId ?? next.partial.accountId ?? null, ...stated, currencyInferred: inferred(next.partial), destinationStated: destinationStated || named(next.partial) }, field: next.field } };
}

/** What a fact is about, decided by its id; only a category's stored name is read from the label (see `factCategory`). */
export function factSubject(fact: AssistantFact): EvidenceSubject {
  const category = factCategory(fact);
  if (category !== null) return { kind: 'category', category };
  if (/(^|\.)expenses$/.test(fact.id)) return { kind: 'expenses' };
  if (/(^|\.)income$/.test(fact.id)) return { kind: 'income' };
  // 24T3: the period's devoluciones (a positive fact, never income), named in the interface language.
  if (/(^|\.)refunds$/.test(fact.id)) return { kind: 'refunds' };
  return { kind: 'other', label: fact.label };
}
const subjectKey = (subject: EvidenceSubject) => subject.kind === 'category' ? 'category:' + subject.category : subject.kind === 'other' ? 'other:' + subject.label : subject.kind;

/** The row's name in the interface language. `categoryName` resolves a stored
 * category to its display name (a built-in one is localized; a custom one is
 * the user's word). */
export function evidenceLabel(row: EvidenceRow, t: Translate = translator('es'), categoryName: (stored: string) => string = stored => stored): string {
  const { subject } = row;
  const label = subject.kind === 'expenses' ? t('assistant.evidence.expenses') : subject.kind === 'income' ? t('assistant.evidence.income')
    : subject.kind === 'refunds' ? t('assistant.evidence.refunds')
    : subject.kind === 'category' ? categoryName(subject.category) : subject.label;
  return row.previousOnly ? t('assistant.evidence.previousMonth', { label }) : label;
}

/** Rows and links for an answer, from the evidence the answer cites (`evidenceIds`)
 * and never from its prose. When the same subject is cited for both the current
 * and the previous period the row is the signed difference; otherwise it is
 * the amount. Links open the FinanzApp screens that hold those records. The
 * model's navigation intent only moves the link it names first when that link
 * was derived here from the same cited fact: it never adds a link or a route. */
export function answerContent(result: { evidenceIds: string[]; navigation?: NavigationIntent | null }, facts: AssistantFact[], currency: Currency): AnswerContent {
  const cited = result.evidenceIds.map(id => facts.find(fact => fact.id === id)).filter((fact): fact is AssistantFact => !!fact);
  const current = cited.filter(fact => fact.id.startsWith('current.'));
  const previous = cited.filter(fact => fact.id.startsWith('previous.'));
  const rows: EvidenceRow[] = [];
  const key = (fact: AssistantFact) => subjectKey(factSubject(fact));
  for (const fact of current) {
    const subject = factSubject(fact);
    const before = previous.find(other => key(other) === subjectKey(subject));
    rows.push(before ? { id: fact.id, subject, previousOnly: false, amountMinor: fact.amountMinor - before.amountMinor, signed: true }
      : { id: fact.id, subject, previousOnly: false, amountMinor: fact.amountMinor, signed: false });
  }
  for (const fact of previous) if (!current.some(other => key(other) === key(fact))) rows.push({ id: fact.id, subject: factSubject(fact), previousOnly: true, amountMinor: fact.amountMinor, signed: false });
  const links: EvidenceLink[] = [];
  const categories = current.filter(fact => factCategory(fact) !== null);
  if (categories.length === 1) links.push({ id: 'category', href: { pathname: '/spending-detail',
    params: { currency, startISO: categories[0].startISO, endISO: categories[0].endISO, category: factCategory(categories[0])! } } });
  const budget = cited.find(fact => fact.id.startsWith('budget'));
  if (budget) links.push({ id: 'budget', href: { pathname: '/budgets', params: { currency } } });
  if (cited.length) links.push({ id: 'movements', href: { pathname: '/activity' } });
  const intent = result.navigation;
  const source: Record<EvidenceLinkId, (id: string) => boolean> = { category: id => categories.length === 1 && categories[0].id === id,
    budget: id => budget?.id === id, movements: id => cited.some(fact => fact.id === id) };
  const first = intent ? links.findIndex(link => link.id === intent.target && source[link.id](intent.factId)) : -1;
  if (first > 0) links.unshift(...links.splice(first, 1));
  return { kind: 'answer', rows: rows.slice(0, 5), links, currency };
}

/** The protocol's clarification fields the conversation has a field for; the others (currency, date, merchant, period)
 * are asked in the model's words only. */
const CLARIFIED: Partial<Record<ClarificationField, DraftField>> = { kind: 'kind', amount: 'amount', category: 'category', destination: 'paymentMethod' };

/** A chip for a fact the device sent, named like its evidence row: the app's word, or the stored category name. */
function factOption(fact: AssistantFact): ClarificationOption {
  const subject = factSubject(fact);
  if (subject.kind === 'category') return { id: fact.id, label: subject.category, category: 'expense' };
  if (subject.kind === 'other') return { id: fact.id, label: subject.label };
  return { id: fact.id, labelKey: `assistant.evidence.${subject.kind}` };
}

/** The content for a validated protocol v2 result. A proposal is resolved locally, exactly as a draft always was (the
 * person's words for the means of payment against the real local accounts; a resolved one is turned into a proposal by the
 * screen, which fixes its ids); answers get evidence from the cited local facts; a clarification gets chips only for the
 * candidates that are facts this device sent; out of scope is the model's words alone. */
export function contentFromResult(result: AssistantResultV2, facts: AssistantFact[], accounts: Account[], entries: Entry[], currency: Currency, todayISO: string, incomeAccounts: Account[] = accounts):
  { text: string; textKey?: MessageKey; content: AnswerContent | ClarificationContent | ResolvedContent | null; pending: ConversationState['pending'] } {
  const proposal = result.type === 'proposal' ? result.proposals[0] : undefined;
  if (proposal) {
    const resolved = resolveDraft(proposal, accounts, entries, currency, todayISO, incomeAccounts);
    if (resolved.kind === 'draft') return { text: result.message, content: { kind: 'draft', draft: resolved.draft }, pending: null };
    return { text: '', textKey: resolved.question, content: { kind: 'clarification', field: resolved.field, options: resolved.options, chosen: null }, pending: { draft: resolved.partial, field: resolved.field } };
  }
  if (result.type === 'clarification' && result.clarification) {
    const options = result.clarification.candidateIds.map(id => facts.find(fact => fact.id === id)).filter((fact): fact is AssistantFact => !!fact).map(factOption);
    return { text: result.message, content: { kind: 'clarification', field: CLARIFIED[result.clarification.field] ?? null, options, chosen: null }, pending: null };
  }
  if (result.type === 'answer') return { text: result.message, content: answerContent(result, facts, currency), pending: null };
  return { text: result.message, content: null, pending: null };
}

/** The note for each disconnected state, as a catalogue key (stored in the
 * system message and translated by the note), in one place so screen and tests agree. */
export const REASON_TEXT: Record<AssistantReason, MessageKey | ''> = {
  unavailable: 'assistant.reasons.unavailable',
  session: 'assistant.reasons.session',
  offline: 'assistant.reasons.offline',
  limit: 'assistant.reasons.limit',
  failed: 'assistant.reasons.failed',
  info: '',
};

/** 25A-06 (decision A): the note for an optional name the server boundary left null because the model copied the
 * person's words past the protocol's bound (never cut): which one, and that the review asks for it. An `info` system
 * message after the reply; the person's own message stays in the thread as written. */
export const DROPPED_TEXT: Record<DroppableField, MessageKey> = { merchant: 'assistant.dropped.merchant', category: 'assistant.dropped.category' };
