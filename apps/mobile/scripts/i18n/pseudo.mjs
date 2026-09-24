// Pseudo-localisation for layout testing, never shipped as a language.
//   long: every word accented and padded by ~40 % inside ⟦ ⟧, so a clipped or
//         concatenated string is visible (German and Finnish run 30–40 % longer);
//   rtl:  the text wrapped in Unicode right-to-left embedding, the shape
//         Arabic and Hebrew strings take.
// Placeholders are kept intact so the screens still fill them.
const ACCENTS = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', A: 'Å', E: 'É', I: 'Î', O: 'Ö', U: 'Û', c: 'ç', n: 'ñ', s: 'š', y: 'ý' };
const PLACEHOLDER = /(\{[a-zA-Z0-9_]+\})/;

export function pseudoText(text, mode = 'long') {
  const parts = text.split(PLACEHOLDER);
  const body = parts.map(part => PLACEHOLDER.test(part) ? part : [...part].map(char => ACCENTS[char] ?? char).join('')).join('');
  if (mode === 'rtl') return '‫' + body + '‬';
  const letters = text.replace(/\{[a-zA-Z0-9_]+\}/g, '').length;
  return '⟦' + body + '·'.repeat(Math.ceil(letters * 0.4)) + '⟧';
}

export function pseudoCatalogue(catalogue, mode = 'long') {
  return Object.fromEntries(Object.entries(catalogue).map(([key, value]) => [key,
    typeof value === 'string' ? pseudoText(value, mode) : pseudoCatalogue(value, mode)]));
}
