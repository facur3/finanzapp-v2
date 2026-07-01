export const DEFAULT_MERCHANT_RULES = [
  { key: 'cafe', match: ['starbucks', 'dunkin', 'cafe', 'café'], category: 'comida', tags: ['cafe'] },
  { key: 'movilidad', match: ['uber', 'lyft', 'taxi', 'cabify', 'didi'], category: 'transporte', tags: ['movilidad'] },
  { key: 'amazon', match: ['amazon'], category: 'compras', tags: ['online'] },
  { key: 'broker', match: ['cocos', 'schwab', 'broker', 'balanz', 'bull market'], category: 'inversiones', tags: ['broker'] },
  { key: 'nafta', match: ['shell', 'exxon', 'gas', 'ypf', 'axion'], category: 'transporte', tags: ['nafta'] },
];

export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizeTag(value) {
  return normalizeText(value).replace(/^#/, '').replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '').slice(0, 32);
}

export function uniqueTags(tags) {
  const seen = new Set();
  const out = [];
  for (const raw of tags || []) {
    const tag = normalizeTag(raw);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

export function suggestMerchant(merchant, rules = DEFAULT_MERCHANT_RULES) {
  const haystack = normalizeText(merchant);
  if (!haystack) return null;
  for (const rule of rules) {
    if ((rule.match || []).some((term) => haystack.indexOf(normalizeText(term)) >= 0)) {
      return { key: rule.key, category: rule.category, tags: uniqueTags(rule.tags) };
    }
  }
  return null;
}

export function resolveCategoryId(category, categories = {}) {
  const raw = normalizeText(category);
  if (!raw) return '';
  if (categories[category] && categories[category].type === 'gasto' && !categories[category].archived) return category;
  if (categories[raw] && categories[raw].type === 'gasto' && !categories[raw].archived) return raw;
  const byName = Object.keys(categories).find((id) => {
    const cat = categories[id] || {};
    return cat.type === 'gasto' && !cat.archived && normalizeText(cat.name) === raw;
  });
  if (byName) return byName;
  const aliases = { transporte: 'auto', transport: 'auto', nafta: 'auto' };
  const alias = aliases[raw];
  return alias && categories[alias] && categories[alias].type === 'gasto' && !categories[alias].archived ? alias : '';
}

export function applyMerchantSuggestion({ merchant, categories, currentCategory, categoryTouched, currentTags }) {
  const suggestion = suggestMerchant(merchant);
  if (!suggestion) return null;
  const category = categoryTouched ? currentCategory : resolveCategoryId(suggestion.category, categories) || currentCategory;
  return {
    key: suggestion.key,
    category,
    tags: uniqueTags([...(currentTags || []), ...suggestion.tags]),
    suggestedTags: suggestion.tags,
  };
}
