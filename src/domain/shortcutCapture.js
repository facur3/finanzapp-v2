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

export function shortcutCaptureSearchFromUrl(url) {
  let parsed;
  try {
    parsed = new URL(String(url || ''));
  } catch (e) {
    return '';
  }

  if (parsed.protocol === 'finanzapp:') {
    const route = (parsed.hostname || parsed.pathname || '').replace(/^\/+/, '').toLowerCase();
    if (route !== 'quick-add-expense') return '';
    const source = parsed.searchParams.get('source') || 'shortcut';
    const out = new URLSearchParams({ quickAdd: 'expense', source });
    ['amount', 'merchant', 'category', 'account', 'tags', 'note'].forEach((key) => {
      const value = parsed.searchParams.get(key);
      if (value != null && value !== '') out.set(key, value);
    });
    return '?' + out.toString();
  }

  if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.searchParams.get('quickAdd') === 'expense') {
    return parsed.search;
  }

  return '';
}
