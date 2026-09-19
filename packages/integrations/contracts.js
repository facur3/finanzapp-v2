// Shared untrusted-input boundary. Pure JS: usable in Node and React Native.
export class InputError extends Error {}
export function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2100-12-31') return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const fail = () => { throw new InputError('Datos de captura inválidos.'); };
function keys(value, required) {
  if (!object(value) || Object.keys(value).some(k => !required.includes(k)) || required.some(k => !(k in value))) fail();
}
function text(value, max, nullable = false) {
  if (value === null && nullable) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail();
  return value.trim();
}
const currency = value => value === null || ['ARS', 'USD'].includes(value);
export function validateDraft(value) {
  keys(value, ['kind', 'amountMinor', 'currency', 'merchant', 'category', 'dateISO', 'paymentMethodRef']);
  if (!['expense', 'income', null].includes(value.kind) || !currency(value.currency)
    || (value.amountMinor !== null && (!Number.isSafeInteger(value.amountMinor) || value.amountMinor <= 0))
    || (value.dateISO !== null && !isDate(value.dateISO))) fail();
  return { kind: value.kind, amountMinor: value.amountMinor, currency: value.currency,
    merchant: text(value.merchant, 160, true), category: text(value.category, 80, true), dateISO: value.dateISO,
    paymentMethodRef: text(value.paymentMethodRef, 80, true) };
}
export function validateCapture(value) {
  keys(value, ['version', 'requestId', 'source', 'draft']);
  if (value.version !== 1 || typeof value.requestId !== 'string'
    || !/^[a-zA-Z0-9_-]{16,100}$/.test(value.requestId) || !['shortcut', 'assistant'].includes(value.source)) fail();
  return { version: 1, requestId: value.requestId, source: value.source, draft: validateDraft(value.draft) };
}
export function validateAssistantRequest(value) {
  keys(value, ['version', 'action', 'text', 'todayISO', 'currency', 'facts']);
  if (value.version !== 1 || !['parse', 'explain'].includes(value.action) || !isDate(value.todayISO)
    || !['ARS', 'USD'].includes(value.currency) || !Array.isArray(value.facts) || value.facts.length > 60) fail();
  const seen = new Set();
  const facts = value.facts.map(fact => {
    keys(fact, ['id', 'label', 'amountMinor', 'count', 'startISO', 'endISO']);
    const id = text(fact.id, 100);
    if (seen.has(id) || !Number.isSafeInteger(fact.amountMinor) || fact.amountMinor < 0
      || !Number.isSafeInteger(fact.count) || fact.count < 0 || !isDate(fact.startISO) || !isDate(fact.endISO)
      || fact.startISO > fact.endISO || fact.endISO > value.todayISO) fail();
    seen.add(id);
    return { id, label: text(fact.label, 160), amountMinor: fact.amountMinor, count: fact.count, startISO: fact.startISO, endISO: fact.endISO };
  });
  if (value.action === 'parse' && facts.length) fail();
  return { version: 1, action: value.action, text: text(value.text, 2000), todayISO: value.todayISO, currency: value.currency, facts };
}
export function validateAssistantResult(value, request) {
  keys(value, ['kind', 'message', 'draft', 'factIds']);
  if (!['draft', 'answer', 'clarification'].includes(value.kind) || !Array.isArray(value.factIds)
    || value.factIds.length > 60 || value.factIds.some(id => !request.facts.some(fact => fact.id === id))) fail();
  if ((value.kind === 'draft') !== (value.draft !== null) || (request.action === 'explain' && value.kind === 'draft')
    || (request.action === 'parse' && value.kind === 'answer')
    || (request.action === 'explain' && value.kind === 'answer' && !value.factIds.length)) fail();
  const draft = value.draft === null ? null : validateDraft(value.draft);
  if (draft?.dateISO && draft.dateISO > request.todayISO) fail();
  return { kind: value.kind, message: text(value.message, 4000), draft, factIds: [...new Set(value.factIds)] };
}
