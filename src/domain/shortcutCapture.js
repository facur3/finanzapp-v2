import { resolveCategoryId, uniqueTags } from './merchantRules.js';

function cleanText(value, max = 120) {
  return String(value || '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e]/g, '').trim().slice(0, max);
}

function parseAmount(value) {
  const raw = String(value || '').trim().replace(',', '.');
  if (!raw) return '';
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return '';
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 999999999) return '';
  return raw;
}

export function parseShortcutCaptureParams(search, { categories = {}, accounts = {}, archived = {} } = {}) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(String(search || '').replace(/^\?/, ''));
  if (params.get('quickAdd') !== 'expense') return null;

  const merchant = cleanText(params.get('merchant'), 80);
  const note = cleanText(params.get('note'), 160);
  const category = resolveCategoryId(cleanText(params.get('category'), 60), categories);
  const accountRaw = cleanText(params.get('account'), 80);
  const account = accountRaw && accounts[accountRaw] && !archived[accountRaw] ? accountRaw : '';
  const tags = uniqueTags(String(params.get('tags') || '').split(',')).slice(0, 12);

  return {
    quickAdd: 'expense',
    shortcut: params.get('source') === 'shortcut',
    amount: parseAmount(params.get('amount')),
    merchant,
    note,
    category,
    account,
    tags,
  };
}
