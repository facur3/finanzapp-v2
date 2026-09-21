import type { Account, Currency, Entry, EntryKind } from '@finanzapp/domain';
import type { AssistantFact, AssistantResult, CaptureDraft } from '../../../../packages/integrations/contracts.js';

/** The Assistant conversation as pure data: one current conversation, messages
 * in local order, a composer draft and a phase. Nothing here touches React,
 * React Native, SQLite or the network, so the reducer runs in Node tests and
 * the screen only renders it. Chat history, folders and search are not a
 * FinanzApp feature: the conversation is ephemeral and resets on demand.
 *
 * Two product rules live in this module and nowhere else:
 * - a parsed sentence becomes a **draft** the user confirms; the reducer never
 *   produces an Entry on its own, it only marks a draft confirmed once the
 *   screen reports that the ledger accepted the write;
 * - a financially meaningful gap (which account paid, what kind, how much)
 *   becomes a **clarification** with real options, never a silent guess. */

export type AssistantReason = 'unavailable' | 'session' | 'offline' | 'limit' | 'failed' | 'info';

/** A number the answer rests on, taken from the local evidence that was sent, never from model prose. */
export type EvidenceRow = { id: string; label: string; amountMinor: number; signed: boolean };
export type EvidenceLink = { label: 'Ver movimientos' | 'Ver categoría' | 'Ver presupuesto'; href: { pathname: string; params?: Record<string, string> } };

export type ResolvedDraft = {
  kind: EntryKind; amountMinor: number; currency: Currency; merchant: string; category: string; dateISO: string;
  /** Null until the user names the account: the reducer never picks one when several could pay. */
  accountId: string | null;
};

export type DraftField = 'kind' | 'amount' | 'paymentMethod' | 'category';
export type ClarificationOption = { id: string; label: string };

export type AnswerContent = { kind: 'answer'; rows: EvidenceRow[]; links: EvidenceLink[] };
export type DraftContent = { kind: 'draft'; draft: ResolvedDraft; status: 'pending' | 'confirmed' | 'cancelled' | 'edited'; entryId: string | null };
export type ClarificationContent = { kind: 'clarification'; field: DraftField | null; options: ClarificationOption[]; chosen: string | null };
export type AssistantContent = AnswerContent | DraftContent | ClarificationContent;

export type Message =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; status: 'streaming' | 'done' | 'stopped'; text: string; content: AssistantContent | null }
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
  | { type: 'delta'; text: string }
  | { type: 'answer'; text: string; content: AssistantContent | null; pending?: ConversationState['pending'] }
  | { type: 'fail'; reason: AssistantReason; text: string; sent: string }
  | { type: 'stop' }
  | { type: 'choose'; messageId: string; optionId: string; label: string; next: { text: string; content: AssistantContent; pending: ConversationState['pending'] } | null }
  | { type: 'draft-confirmed'; messageId: string; entryId: string }
  | { type: 'draft-cancelled'; messageId: string }
  /** The draft went to the entry form; the form's own save is the write. */
  | { type: 'draft-edited'; messageId: string }
  /** A note the screen adds outside a request (a refused confirm, a test-view reminder). */
  | { type: 'note'; reason: AssistantReason; text: string }
  | { type: 'reset' };

const id = (state: ConversationState, prefix: string) => `${prefix}-${state.nextId}`;

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
        messages: [...state.messages, { id: id(state, 'a'), role: 'assistant', status: 'streaming', text: action.text, content: null }] };
    }
    case 'answer': {
      if (state.phase === 'idle') return state;
      const last = state.messages.at(-1);
      const done = { role: 'assistant' as const, status: 'done' as const, text: action.text, content: action.content };
      const messages = last?.role === 'assistant' && last.status === 'streaming'
        ? [...state.messages.slice(0, -1), { ...last, ...done, text: action.text || last.text }]
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
      if (action.next) messages.push({ id: `a-${state.nextId + 1}`, role: 'assistant', status: 'done', text: action.next.text, content: action.next.content });
      return { ...state, messages, pending: action.next?.pending ?? null, nextId: state.nextId + 2 };
    }
    case 'draft-confirmed':
    case 'draft-cancelled':
    case 'draft-edited': {
      const target = state.messages.find(message => message.id === action.messageId);
      if (!target || target.role !== 'assistant' || target.content?.kind !== 'draft' || target.content.status !== 'pending') return state;
      const status = action.type === 'draft-confirmed' ? 'confirmed' : action.type === 'draft-cancelled' ? 'cancelled' : 'edited';
      const content: DraftContent = { ...target.content, status, entryId: action.type === 'draft-confirmed' ? action.entryId : null };
      return { ...state, messages: state.messages.map(message => message === target ? { ...target, content } : message) };
    }
    case 'note':
      return { ...state, messages: [...state.messages, { id: id(state, 's'), role: 'system', reason: action.reason, text: action.text, retryText: null }], nextId: state.nextId + 1 };
    case 'reset':
      return { ...emptyConversation, nextId: state.nextId };
  }
}

/** The four prompts an empty conversation offers. Never more; they disappear once a conversation starts. */
export const SUGGESTIONS = ['¿Por qué gasté más este mes?', '¿Cuánto gasté en comida?', 'Registrar un gasto', '¿Cómo voy con mi presupuesto?'] as const;

/** A question about recorded money is explained against local evidence; anything else is parsed as an action. */
export function classifyIntent(text: string): 'explain' | 'parse' {
  const t = text.trim().toLowerCase();
  if (/[?¿]/.test(t)) return 'explain';
  return /^(cu[aá]nt[oa]s?|por qu[eé]|c[oó]mo voy|cu[aá]l|qu[eé] tal)\b/.test(t) ? 'explain' : 'parse';
}

/** Whether new content should pull the list to its end: only when the reader is already near it. */
export function shouldAutoscroll(offsetY: number, contentHeight: number, viewportHeight: number, threshold = 80): boolean {
  if (contentHeight <= viewportHeight) return true;
  return contentHeight - viewportHeight - offsetY <= threshold;
}

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

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
    .map(item => ({ id: item.label, label: item.label }));
}

/** Turn a CaptureDraft (the server contract, every field nullable) into either a
 * confirmable draft or the one clarification that blocks it, in this order:
 * kind, amount, account, category. `accounts` are the ones that may carry a
 * posting in the draft's currency. A named payment method matches one account
 * by name (accent- and case-insensitive); with exactly one eligible account it
 * is implied; otherwise the user is asked, with the accounts as the options. */
export function resolveDraft(draft: CaptureDraft, accounts: Account[], entries: Entry[], currency: Currency, todayISO: string):
  { kind: 'draft'; draft: ResolvedDraft } | { kind: 'clarification'; field: DraftField; question: string; options: ClarificationOption[]; partial: Partial<ResolvedDraft> } {
  const resolvedCurrency = draft.currency ?? currency;
  const partial: Partial<ResolvedDraft> = { currency: resolvedCurrency, merchant: draft.merchant ?? '', category: draft.category ?? '',
    dateISO: draft.dateISO ?? todayISO, ...(draft.kind ? { kind: draft.kind } : {}), ...(draft.amountMinor ? { amountMinor: draft.amountMinor } : {}) };
  if (!draft.kind) return { kind: 'clarification', field: 'kind', question: '¿Fue un gasto o un ingreso?', options: [{ id: 'expense', label: 'Gasto' }, { id: 'income', label: 'Ingreso' }], partial };
  if (!draft.amountMinor) return { kind: 'clarification', field: 'amount', question: '¿De cuánto fue? Escribilo con el importe.', options: [], partial };
  const eligible = accounts.filter(account => account.currency === resolvedCurrency);
  const named = draft.paymentMethodRef ? eligible.filter(account => fold(account.name).includes(fold(draft.paymentMethodRef!)) || fold(draft.paymentMethodRef!).includes(fold(account.name))) : [];
  const accountId = named.length === 1 ? named[0].id : eligible.length === 1 ? eligible[0].id : null;
  if (!accountId) return { kind: 'clarification', field: 'paymentMethod', question: draft.kind === 'expense' ? '¿Con qué lo pagaste?' : '¿En qué cuenta ingresó?',
    options: eligible.map(account => ({ id: account.id, label: account.name })), partial: { ...partial, accountId: null } };
  if (!draft.category) return { kind: 'clarification', field: 'category', question: '¿En qué categoría lo anoto?', options: categoryOptions(entries, draft.kind), partial: { ...partial, accountId } };
  return { kind: 'draft', draft: { kind: draft.kind, amountMinor: draft.amountMinor, currency: resolvedCurrency, merchant: draft.merchant ?? '',
    category: draft.category, dateISO: draft.dateISO ?? todayISO, accountId } };
}

/** Apply a chosen option to a parked draft. Returns the next turn: another clarification (still parked) or the draft. */
export function completeDraft(pending: { draft: Partial<ResolvedDraft>; field: DraftField }, optionId: string, accounts: Account[], entries: Entry[], todayISO: string):
  { text: string; content: AssistantContent; pending: ConversationState['pending'] } {
  const draft = { ...pending.draft };
  if (pending.field === 'kind') draft.kind = optionId === 'income' ? 'income' : 'expense';
  else if (pending.field === 'paymentMethod') draft.accountId = optionId;
  else if (pending.field === 'category') draft.category = optionId;
  const currency = draft.currency ?? 'ARS';
  const capture: CaptureDraft = { kind: draft.kind ?? null, amountMinor: draft.amountMinor ?? null, currency, merchant: draft.merchant || null,
    category: draft.category || null, dateISO: draft.dateISO ?? null, paymentMethodRef: null };
  const next = resolveDraft(capture, draft.accountId ? accounts.filter(account => account.id === draft.accountId) : accounts, entries, currency, todayISO);
  if (next.kind === 'draft') return { text: 'Revisá el borrador antes de guardarlo.', pending: null,
    content: { kind: 'draft', draft: { ...next.draft, accountId: draft.accountId ?? next.draft.accountId }, status: 'pending', entryId: null } };
  return { text: next.question, content: { kind: 'clarification', field: next.field, options: next.options, chosen: null },
    pending: { draft: { ...next.partial, accountId: draft.accountId ?? next.partial.accountId ?? null }, field: next.field } };
}

/** Fields a confirmable draft still lacks. Confirm stays disabled while any remain; Editar completes them in the form. */
export function draftGaps(draft: ResolvedDraft): ('merchant' | 'category' | 'account')[] {
  const gaps: ('merchant' | 'category' | 'account')[] = [];
  if (!draft.merchant.trim()) gaps.push('merchant');
  if (!draft.category.trim()) gaps.push('category');
  if (!draft.accountId) gaps.push('account');
  return gaps;
}

/** The Entry a confirmed draft becomes. The caller validates it with the domain and writes it; nothing here writes. */
export function entryFromDraft(draft: ResolvedDraft, entryId: string, createdAt: string): Entry {
  if (!draft.accountId) throw new Error('Elegí con qué cuenta se pagó antes de confirmar.');
  return { id: entryId, accountId: draft.accountId, kind: draft.kind, amountMinor: draft.amountMinor, merchant: draft.merchant.trim(),
    category: draft.category.trim(), dateISO: draft.dateISO, createdAt };
}

const CATEGORY_PREFIX = 'Categoría de gasto: ';
const factLabel = (fact: AssistantFact) => fact.label.startsWith(CATEGORY_PREFIX) ? fact.label.slice(CATEGORY_PREFIX.length) : fact.label;

/** Rows and links for an answer, from the evidence the answer cites (`factIds`)
 * and never from its prose. When the same label is cited for both the current
 * and the previous period the row is the signed difference; otherwise it is
 * the amount. Links open the FinanzApp screens that hold those records. */
export function answerContent(result: Pick<AssistantResult, 'factIds'>, facts: AssistantFact[], currency: Currency): AnswerContent {
  const cited = result.factIds.map(id => facts.find(fact => fact.id === id)).filter((fact): fact is AssistantFact => !!fact);
  const current = cited.filter(fact => fact.id.startsWith('current.'));
  const previous = cited.filter(fact => fact.id.startsWith('previous.'));
  const rows: EvidenceRow[] = [];
  for (const fact of current) {
    const label = factLabel(fact);
    const before = previous.find(other => factLabel(other) === label);
    rows.push(before ? { id: fact.id, label, amountMinor: fact.amountMinor - before.amountMinor, signed: true } : { id: fact.id, label, amountMinor: fact.amountMinor, signed: false });
  }
  for (const fact of previous) if (!current.some(other => factLabel(other) === factLabel(fact))) rows.push({ id: fact.id, label: factLabel(fact) + ' (mes anterior)', amountMinor: fact.amountMinor, signed: false });
  const links: EvidenceLink[] = [];
  const categories = current.filter(fact => fact.id.includes('.category.'));
  if (categories.length === 1) links.push({ label: 'Ver categoría', href: { pathname: '/spending-detail',
    params: { currency, startISO: categories[0].startISO, endISO: categories[0].endISO, category: factLabel(categories[0]) } } });
  if (cited.some(fact => fact.id.startsWith('budget'))) links.push({ label: 'Ver presupuesto', href: { pathname: '/budgets', params: { currency } } });
  if (cited.length) links.push({ label: 'Ver movimientos', href: { pathname: '/activity' } });
  return { kind: 'answer', rows: rows.slice(0, 5), links };
}

/** The content the reducer stores for a validated server result. Drafts are resolved locally; answers get evidence. */
export function contentFromResult(result: AssistantResult, facts: AssistantFact[], accounts: Account[], entries: Entry[], currency: Currency, todayISO: string):
  { text: string; content: AssistantContent | null; pending: ConversationState['pending'] } {
  if (result.kind === 'draft' && result.draft) {
    const resolved = resolveDraft(result.draft, accounts, entries, currency, todayISO);
    if (resolved.kind === 'draft') return { text: result.message, content: { kind: 'draft', draft: resolved.draft, status: 'pending', entryId: null }, pending: null };
    return { text: resolved.question, content: { kind: 'clarification', field: resolved.field, options: resolved.options, chosen: null }, pending: { draft: resolved.partial, field: resolved.field } };
  }
  if (result.kind === 'clarification') return { text: result.message, content: { kind: 'clarification', field: null, options: [], chosen: null }, pending: null };
  return { text: result.message, content: answerContent(result, facts, currency), pending: null };
}

/** Copy for the disconnected states, in one place so screen and tests agree. */
export const REASON_TEXT: Record<AssistantReason, string> = {
  unavailable: 'El Asistente todavía no está conectado en esta versión. Tu mensaje quedó escrito para cuando lo esté.',
  session: 'Iniciá sesión para usar el Asistente. Tu mensaje sigue en el cuadro.',
  offline: 'Sin conexión. Tus movimientos no cambiaron; podés reintentar.',
  limit: 'Llegaste al límite de consultas de hoy. Podés registrar manualmente.',
  failed: 'No se pudo completar la consulta. Tus movimientos no cambiaron.',
  info: '',
};
