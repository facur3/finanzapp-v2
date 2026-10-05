// Shared untrusted-input boundary. Pure JS: usable in Node and React Native.
// Captures (contract v1). The Assistant speaks protocol v2 (`assistant-protocol.js`); its v1 validators were retired in
// 25A-05, never deployed.
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
