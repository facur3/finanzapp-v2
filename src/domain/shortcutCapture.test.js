import { describe, expect, it } from 'vitest';
import { parseShortcutCaptureParams } from './shortcutCapture.js';

const categories = {
  comida: { name: 'Comida', type: 'gasto' },
  auto: { name: 'Auto', type: 'gasto' },
  compras: { name: 'Compras', type: 'gasto' },
  ingreso: { name: 'Ingreso', type: 'ingreso' },
};

const accounts = {
  banco: { name: 'Banco' },
  archived: { name: 'Archivada' },
};
const archived = { archived: true };

describe('parseShortcutCaptureParams', () => {
  it('returns null unless quickAdd=expense is present', () => {
    expect(parseShortcutCaptureParams('?source=shortcut', { categories, accounts })).toBe(null);
  });

  it('parses and validates supported shortcut params', () => {
    const capture = parseShortcutCaptureParams(
      '?quickAdd=expense&source=shortcut&amount=12.50&merchant=Starbucks&category=comida&account=banco&tags=cafe,apple-pay&note=Apple%20Pay',
      { categories, accounts, archived }
    );

    expect(capture).toEqual({
      quickAdd: 'expense',
      shortcut: true,
      amount: '12.50',
      merchant: 'Starbucks',
      note: 'Apple Pay',
      category: 'comida',
      account: 'banco',
      tags: ['cafe', 'apple-pay'],
    });
  });

  it('drops invalid optional params safely', () => {
    const capture = parseShortcutCaptureParams(
      '?quickAdd=expense&amount=-1&category=ingreso&account=archived&tags=Café,cafe,#Apple%20Pay,abcdefghijklmnopqrstuvwxyz0123456789&merchant=%E2%80%AEStarbucks',
      { categories, accounts, archived }
    );

    expect(capture.amount).toBe('');
    expect(capture.category).toBe('');
    expect(capture.account).toBe('');
    expect(capture.tags).toEqual(['cafe', 'apple-pay', 'abcdefghijklmnopqrstuvwxyz012345']);
    expect(capture.merchant).toBe('Starbucks');
    expect(capture.shortcut).toBe(false);
  });
});
