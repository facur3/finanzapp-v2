import { describe, expect, it } from 'vitest';
import { shortcutCaptureSearchFromUrl } from './shortcutCapture.js';

describe('shortcutCaptureSearchFromUrl', () => {
  it('normalizes native finanzapp quick-add URLs into the existing web capture query', () => {
    expect(
      shortcutCaptureSearchFromUrl(
        'finanzapp://quick-add-expense?amount=12.50&merchant=Starbucks&category=comida&tags=cafe,apple-pay&note=Apple%20Pay'
      )
    ).toBe('?quickAdd=expense&source=shortcut&amount=12.50&merchant=Starbucks&category=comida&tags=cafe%2Capple-pay&note=Apple+Pay');
  });

  it('keeps existing PWA quickAdd URLs working', () => {
    expect(shortcutCaptureSearchFromUrl('https://finanzapp-v2-rho.vercel.app/?quickAdd=expense&source=shortcut&amount=12.50')).toBe(
      '?quickAdd=expense&source=shortcut&amount=12.50'
    );
  });

  it('supports single-slash native scheme URLs too', () => {
    expect(shortcutCaptureSearchFromUrl('finanzapp:/quick-add-expense?amount=1')).toBe('?quickAdd=expense&source=shortcut&amount=1');
  });

  it('ignores unrelated URLs', () => {
    expect(shortcutCaptureSearchFromUrl('finanzapp://settings')).toBe('');
    expect(shortcutCaptureSearchFromUrl('not a url')).toBe('');
  });
});
