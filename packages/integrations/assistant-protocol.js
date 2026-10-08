// Assistant protocol v2 (Producto 25A-05): the one closed contract between the app, the server and any model.
// Pure JS, no dependencies: the server validates a provider's output with it, and the app validates the server's reply
// with it again before anything becomes a review draft. Structured-output validity is never trusted on its own.
//
// The model is untrusted. Its output is exactly one of four types and carries financial facts only:
// - `answer`: prose that cites ids of the facts the device sent (never others), and at most one typed navigation intent
//   pointing at one of those cited facts (the device builds the route from its own evidence, never from the model);
// - `proposal`: one draft of a supported kind (expense or income) with every unknown fact `null`; no account or card id
//   exists in it, only the person's own words for the means of payment (`paymentMethodRef`), resolved on the device;
// - `clarification`: one question about one typed field, with candidate ids only from those the request supplied;
// - `out_of_scope`: a short redirection to what FinanzApp does.
// No field carries code, SQL, a command, a URL, a tool name, a route or a database operation, and the validators refuse
// prose that tries to smuggle one (a URL, a code fence, a markdown link, a hidden character).
import { InputError, isDate } from './contracts.js';

export const ASSISTANT_PROTOCOL_VERSION = 2;
export const RESULT_TYPES = ['answer', 'proposal', 'clarification', 'out_of_scope'];
export const PROPOSAL_KINDS = ['expense', 'income'];
export const PROTOCOL_CURRENCIES = ['ARS', 'USD'];
export const CLARIFICATION_FIELDS = ['kind', 'amount', 'currency', 'date', 'merchant', 'category', 'destination', 'period'];
export const NAVIGATION_TARGETS = ['movements', 'category', 'budget'];

/** Hard bounds. The server refuses a request outside them before any quota, reservation or provider call; the
 * merchant, category and amount bounds are the review draft's own (packages/domain, pinned by a drift test). */
export const PROTOCOL_LIMITS = Object.freeze({
  requestBytes: 24000, requestId: /^[A-Za-z0-9_-]{16,100}$/, textChars: 2000, facts: 60, factIdChars: 100, factLabelChars: 160,
  messageChars: 1200, proposals: 1, candidateIds: 8, merchantChars: 120, categoryChars: 60, referenceChars: 80,
  maxAmountMinor: 10 ** 15 - 1,
});

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const refuse = () => { throw new InputError('Datos del asistente inválidos.'); };
function exact(value, keys) {
  if (!object(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) refuse();
}

// The review draft's hidden characters (packages/domain/review-drafts.ts), plus line breaks in a name.
const HIDDEN = /[\u0000-\u001f\u007f-\u009f\u200b\u2028-\u202e\u2060-\u2064\u2066-\u2069\ufeff\ufff9-\ufffb]/;
// Prose may break lines; nothing else hidden.
const HIDDEN_IN_PROSE = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b\u2028-\u202e\u2060-\u2064\u2066-\u2069\ufeff\ufff9-\ufffb]/;
// The person's own text: controls and bidirectional overrides are refused; zero-width joiners stay (emoji sequences).
const HIDDEN_IN_INPUT = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/;
// Beyond the Basic Multilingual Plane: tag characters (invisible ASCII smuggling) and lone surrogates.
const INVISIBLE = /[\u{E0000}-\u{E007F}]|\p{Cs}/u;
// Something to follow, call or run, not words to read: a scheme with an address, a bare www host, a host with a path,
// an e-mail address, a markdown link or image, a code fence. A bare domain name ("Netflix.com") is a merchant's name.
const ACTIONABLE = /[a-z][a-z0-9+.-]*:\/\/|\bwww\.|\]\(|```|\b(?:javascript|vbscript|file|mailto|tel|sms|intent):\S|\bdata:[a-z]+\/|[^\s@]+@[^\s@]+\.[a-z]{2,}|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/\S/i;

/** Whether a string from the model may be shown or kept: plain words, no link, no code, no hidden character. */
export function isSafeModelText(value, max, prose = false) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
    && !(prose ? HIDDEN_IN_PROSE : HIDDEN).test(value) && !INVISIBLE.test(value) && !ACTIONABLE.test(value);
}
const modelText = (value, max, prose = false) => isSafeModelText(value, max, prose) ? value.trim() : refuse();
const nullableName = (value, max) => value === null ? null : modelText(value, max);

/** Whether the person's own text (or a stored name sent as a fact label) may travel in a request. */
export function isSafeInputText(value, max) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max && !HIDDEN_IN_INPUT.test(value) && !INVISIBLE.test(value);
}
const inputText = (value, max) => isSafeInputText(value, max) ? value.trim() : refuse();

function fact(value, todayISO) {
  exact(value, ['id', 'label', 'amountMinor', 'count', 'startISO', 'endISO']);
  const id = inputText(value.id, PROTOCOL_LIMITS.factIdChars);
  if (!/^[A-Za-z0-9_.-]+$/.test(id) || !Number.isSafeInteger(value.amountMinor) || value.amountMinor < 0
    || !Number.isSafeInteger(value.count) || value.count < 0 || !isDate(value.startISO) || !isDate(value.endISO)
    || value.startISO > value.endISO || value.endISO > todayISO) refuse();
  return { id, label: inputText(value.label, PROTOCOL_LIMITS.factLabelChars), amountMinor: value.amountMinor, count: value.count,
    startISO: value.startISO, endISO: value.endISO };
}

const REQUEST_KEYS = ['version', 'requestId', 'action', 'text', 'todayISO', 'currency', 'region', 'facts'];
/** The request the app sends. `requestId` is fresh per ask: the server reserves budget once per id, so a repeated
 * delivery of the same request is refused instead of charged twice. `region` is the configured region (two letters),
 * the only thing that lets a regional currency word («pesos») resolve. A `parse` request carries no ledger facts. */
export function validateAssistantRequestV2(value) {
  exact(value, REQUEST_KEYS);
  if (value.version !== ASSISTANT_PROTOCOL_VERSION || typeof value.requestId !== 'string' || !PROTOCOL_LIMITS.requestId.test(value.requestId)
    || !['parse', 'explain'].includes(value.action) || !isDate(value.todayISO) || !PROTOCOL_CURRENCIES.includes(value.currency)
    || typeof value.region !== 'string' || !/^[A-Z]{2}$/.test(value.region)
    || !Array.isArray(value.facts) || value.facts.length > PROTOCOL_LIMITS.facts) refuse();
  const facts = value.facts.map(item => fact(item, value.todayISO));
  if (new Set(facts.map(item => item.id)).size !== facts.length || (value.action === 'parse' && facts.length)) refuse();
  return { version: ASSISTANT_PROTOCOL_VERSION, requestId: value.requestId, action: value.action, text: inputText(value.text, PROTOCOL_LIMITS.textChars),
    todayISO: value.todayISO, currency: value.currency, region: value.region, facts };
}

/** What the model reads: the request without its id or version. Nothing else of the ledger. */
export function modelInput(request) {
  const { action, text, todayISO, currency, region, facts } = request;
  return { action, text, todayISO, currency, region, facts };
}

const PROPOSAL_KEYS = ['kind', 'amountMinor', 'currency', 'merchant', 'category', 'dateISO', 'paymentMethodRef'];
function proposal(value, todayISO) {
  exact(value, PROPOSAL_KEYS);
  if (!PROPOSAL_KINDS.includes(value.kind)
    || (value.amountMinor !== null && (!Number.isSafeInteger(value.amountMinor) || value.amountMinor <= 0 || value.amountMinor > PROTOCOL_LIMITS.maxAmountMinor))
    || (value.currency !== null && !PROTOCOL_CURRENCIES.includes(value.currency))
    // A movement already made is never in the future of the person's own day.
    || (value.dateISO !== null && (!isDate(value.dateISO) || value.dateISO > todayISO))) refuse();
  return { kind: value.kind, amountMinor: value.amountMinor, currency: value.currency,
    merchant: nullableName(value.merchant, PROTOCOL_LIMITS.merchantChars), category: nullableName(value.category, PROTOCOL_LIMITS.categoryChars),
    dateISO: value.dateISO, paymentMethodRef: nullableName(value.paymentMethodRef, PROTOCOL_LIMITS.referenceChars) };
}

function ids(value, allowed, max) {
  if (!Array.isArray(value) || value.length > max || value.some(id => typeof id !== 'string' || !allowed.has(id))
    || new Set(value).size !== value.length) refuse();
  return [...value];
}

const CATEGORY_FACT = /(^|\.)category\.\d+$/;
const BUDGET_FACT = /^budget(\.|$)/;
function navigation(value, cited) {
  if (value === null) return null;
  exact(value, ['target', 'factId']);
  if (!NAVIGATION_TARGETS.includes(value.target) || !cited.includes(value.factId)
    || (value.target === 'category' && !CATEGORY_FACT.test(value.factId))
    || (value.target === 'budget' && !BUDGET_FACT.test(value.factId))) refuse();
  return { target: value.target, factId: value.factId };
}

// ── Figures in a reply to a question ─────────────────────────────────────────────────────────────────────────────
// Financial calculations belong to the deterministic domain, never to the model (production-plan.md §5.2, owner
// decision of 2026-10-08): the prose may restate the figures of the facts it CITES, an amount in exact minor units or
// a count, a year of their periods, a number written in a cited fact's label, a day-sized bare integer, and nothing
// else: nothing computed (no difference, percentage, rounding or total), nothing from an uncited fact, and never a
// number from the person's question (a threshold the person asked about is not a ledger figure; the model refers to it
// without repeating it). The prose's numeric writing is a contract, not a guess: a v2 reply is rioplatense Spanish
// whatever the request's region (assistant-prompt.js), so an amount is written as in Argentina, a point grouping
// thousands and a comma before one or two centavos («1.234,56», «1.000», «0,50»); any other writing («1,000»,
// «842.50», «1,234.56», «1.23.456», «0500») is refused, since what a person reads («$1.000» is one thousand) must be
// the fact's value. Each amount is converted to minor units exactly, by digits (never a float, never rounded;
// stricter than the domain's input reader, which also accepts extra zero decimals: pinned by a drift test) and
// compared as integers: 1,99 is 199, never 200. The reader sees Western digits: a figure in words («el doble»,
// «medio millón»), the direction word or a small computed count rests on the instructions and on reading a live
// report, never on this check, which is a partial defence in depth, not a verification of what the prose claims.
// An exponent («2e6») is one token; a minus before the figure or its currency mark, spaced or not («-184.500»,
// «- $ 184.500», «$ - 184.500»), rewrites a non-negative fact: both are refused, fail closed, so a spaced dash before
// an amount is also refused; only a dash right after a digit (an ISO date, a range) is not a sign (Codex reviews).
const FIGURE = /(\d[\d.,]*\d(?:[eE][+-]?\d+)?|\d(?:[eE][+-]?\d+)?)(\s*(?:%|％|por\s*ciento\b|porciento\b|per\s*cent\b|percent\b)|\s*(?:mil|k|lucas)\b|\s*mill[oó]n(?:es)?\b)?/giu;
// Any dash or minus (every Unicode dash, the minus sign, the small and fullwidth hyphen-minus) before the figure.
const SIGNED_BEFORE = /(?<!\d)[\p{Pd}\u2212]\s*(?:(?:\$|u\$s|USD|ARS)\s*)?$/iu;
const PERCENT = /^(?:%|％|por\s*ciento|porciento|per\s*cent|percent)$/i;
const MONEY_BEFORE = /(?:\$|u\$s|\b(?:USD|ARS))\s*$/i;
const MONEY_AFTER = /^\s*(?:pesos|mangos|d[oó]lares|dollars|bucks|USD|ARS)\b/i;
// A digit of another script or a numeric symbol («٣», «３», «²», «½») is never a restated fact; a format or combining
// character glued to a digit would split a figure into digits that pass alone.
const FOREIGN_DIGIT = /(?![0-9])[\p{Nd}\p{No}]/u;
const GLUED_BEFORE = /[\p{Cf}\p{Mn}\p{Me}]$/u;
const GLUED_AFTER = /^[\p{Cf}\p{Mn}\p{Me}]/u;
const spaced = value => value.replace(/\s+/g, ' ').trim().toLowerCase();
/** Minor digits of every protocol currency (ARS, USD): the domain's `minorUnitExponent`, pinned by a drift test. */
const MINOR_DIGITS = 2;
/** The one writing of an amount in a v2 reply: whole pesos as plain digits or in groups of three separated by a point
 * (no leading zero but a lone «0»), then optionally a comma and one or two centavos. */
const AMOUNT = /^(0|[1-9]\d{0,2}(?:\.\d{3})*|[1-9]\d*)(?:,(\d{1,2}))?$/;
/** The exact minor-unit value of a figure token written under the reply's numeric contract, under a multiplier suffix
 * («mil», «millones»): one value, or none when the writing is not the contract's or the amount is out of bounds. */
export function figureMinorUnits(token, suffix = '') {
  const match = AMOUNT.exec(token);
  if (!match) return [];
  const shift = suffix.toLowerCase().startsWith('mill') ? 6 : suffix ? 3 : 0;
  const minor = BigInt(match[1].replace(/\./g, '') + (match[2] ?? '').padEnd(MINOR_DIGITS, '0')) * 10n ** BigInt(shift);
  return minor > BigInt(PROTOCOL_LIMITS.maxAmountMinor) ? [] : [minor];
}
/** The figures of a reply's prose that the facts it cites do not support exactly: each is a reason to refuse the reply.
 * `evidenceIds` are the cited facts; nothing else in the request supports a figure (not an uncited fact, not the
 * person's question). */
export function unsupportedFigures(message, request, evidenceIds = []) {
  const facts = (Array.isArray(request.facts) ? request.facts : []).filter(item => evidenceIds.includes(item.id));
  const amounts = new Set(facts.map(item => BigInt(item.amountMinor))), counts = new Set(facts.map(item => BigInt(item.count)));
  const years = new Set([...facts.flatMap(item => [item.startISO, item.endISO]), request.todayISO].map(iso => String(iso).slice(0, 4)));
  // A number in a cited fact's label (a category name such as «Plan 2030») may appear only inside an occurrence of that
  // name in the prose, written as the label writes it, and bare: never as money, signed, with a suffix, alone, or
  // elsewhere in the message (Codex reviews of this change).
  const names = facts.map(item => spaced(String(item.label ?? '').split(':').pop())).filter(name => /\d/.test(name));
  const spans = names.flatMap(name => [...message.matchAll(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'), 'giu'))]
    .map(match => [match.index, match.index + match[0].length]));
  const found = [];
  const foreign = FOREIGN_DIGIT.exec(message);
  if (foreign) found.push(foreign[0]);
  for (const match of message.matchAll(FIGURE)) {
    const before = message.slice(0, match.index), after = message.slice(match.index + match[0].length);
    if (GLUED_BEFORE.test(before) || GLUED_AFTER.test(after) || SIGNED_BEFORE.test(before) || /[eE]/.test(match[1])) { found.push(match[0]); continue; }
    const suffix = (match[2] ?? '').trim();
    if (PERCENT.test(suffix)) { found.push(match[0]); continue; }
    const money = MONEY_BEFORE.test(before) || MONEY_AFTER.test(after);
    const bare = !suffix && !money && /^\d+$/.test(match[1]);
    const named = bare && spans.some(([start, end]) => match.index >= start && match.index + match[0].length <= end);
    const supported = named || figureMinorUnits(match[1], suffix).some(value => amounts.has(value))
      || (bare && (Number(match[1]) <= 31 || counts.has(BigInt(match[1])) || (match[1].length === 4 && years.has(match[1]))));
    if (!supported) found.push(match[0]);
  }
  return found;
}

const RESULT_KEYS = ['type', 'message', 'evidenceIds', 'navigation', 'proposals', 'clarification'];
/** Validate a result against the request it answers; returns a fresh object holding only the protocol's keys.
 * Run by the server on the provider's output and by the app on the server's reply. */
export function validateAssistantResultV2(value, request) {
  exact(value, RESULT_KEYS);
  if (!RESULT_TYPES.includes(value.type) || !Array.isArray(value.proposals) || !Array.isArray(value.evidenceIds)) refuse();
  const supplied = new Set(request.facts.map(item => item.id));
  const message = modelText(value.message, PROTOCOL_LIMITS.messageChars, true);
  const evidenceIds = ids(value.evidenceIds, supplied, PROTOCOL_LIMITS.facts);
  // A figure the cited facts do not hold exactly is the model's own arithmetic or invention: never shown, whatever the
  // reply's type to a question. A draft or a question on `parse` may reformulate the person's own number.
  if (request.action === 'explain' && unsupportedFigures(message, request, evidenceIds).length) refuse();
  const empty = !evidenceIds.length && value.navigation === null && !value.proposals.length && value.clarification === null;
  const base = { type: value.type, message, evidenceIds: [], navigation: null, proposals: [], clarification: null };
  switch (value.type) {
    case 'answer': {
      // An answer exists only for a question, and only over cited facts: uncited prose is not an answer.
      if (request.action !== 'explain' || !evidenceIds.length || value.proposals.length || value.clarification !== null) refuse();
      return { ...base, evidenceIds, navigation: navigation(value.navigation, evidenceIds) };
    }
    case 'proposal': {
      if (request.action !== 'parse' || value.proposals.length < 1 || value.proposals.length > PROTOCOL_LIMITS.proposals
        || evidenceIds.length || value.navigation !== null || value.clarification !== null) refuse();
      return { ...base, proposals: value.proposals.map(item => proposal(item, request.todayISO)) };
    }
    case 'clarification': {
      exact(value.clarification, ['field', 'candidateIds']);
      if (!CLARIFICATION_FIELDS.includes(value.clarification.field) || value.proposals.length || value.navigation !== null) refuse();
      return { ...base, evidenceIds, clarification: { field: value.clarification.field,
        candidateIds: ids(value.clarification.candidateIds, supplied, PROTOCOL_LIMITS.candidateIds) } };
    }
    default:
      if (!empty) refuse();
      return base;
  }
}

/** The output schema handed to a model's structured-output mode. Only the portable subset of JSON Schema: every key
 * required, nullable where unknown, no numeric or length bounds (vendors differ; the validators above enforce them). */
const nullable = type => ({ type: [type, 'null'] });
const PROPOSAL_SCHEMA = { type: 'object', additionalProperties: false, required: PROPOSAL_KEYS, properties: {
  kind: { type: 'string', enum: PROPOSAL_KINDS }, amountMinor: nullable('integer'),
  currency: { type: ['string', 'null'], enum: [...PROTOCOL_CURRENCIES, null] }, merchant: nullable('string'), category: nullable('string'),
  dateISO: nullable('string'), paymentMethodRef: nullable('string') } };
export const ASSISTANT_RESULT_SCHEMA = Object.freeze({ type: 'object', additionalProperties: false, required: RESULT_KEYS, properties: {
  type: { type: 'string', enum: RESULT_TYPES },
  message: { type: 'string' },
  evidenceIds: { type: 'array', items: { type: 'string' } },
  navigation: { anyOf: [{ type: 'null' }, { type: 'object', additionalProperties: false, required: ['target', 'factId'], properties: {
    target: { type: 'string', enum: NAVIGATION_TARGETS }, factId: { type: 'string' } } }] },
  proposals: { type: 'array', items: PROPOSAL_SCHEMA },
  clarification: { anyOf: [{ type: 'null' }, { type: 'object', additionalProperties: false, required: ['field', 'candidateIds'], properties: {
    field: { type: 'string', enum: CLARIFICATION_FIELDS }, candidateIds: { type: 'array', items: { type: 'string' } } } }] },
} });
