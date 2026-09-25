import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BUILD_MERCHANT_MARK_PREVIEW, merchantMark, merchantMarkPreview } from '../src/ui/merchant-mark.ts';

// Producto 24UX2: what a row draws for a merchant. Pure; nothing here renders or reaches the network.

test('production draws the category glyph for every merchant, recognized or not', () => {
  for (const name of ['Netflix', 'App Store', 'Mercado Pago', 'Almacén Don Pepe', 'Apple', '']) {
    assert.equal(JSON.stringify(merchantMark(name)), JSON.stringify({ kind: 'category' }), name);
  }
});

test('the development preview marks only recognized brands, with their initial', () => {
  const preview = merchantMark('Mercado Pago', true);
  assert.equal(preview.kind === 'monogram' ? preview.brand.id + ':' + preview.letter : preview.kind, 'mercado-pago:M');
  const store = merchantMark('App Store', true);
  assert.equal(store.kind === 'monogram' ? store.brand.id : store.kind, 'apple');
  for (const name of ['Apple', 'Steam', 'Pago Netflix', 'Netflix y Spotify', 'Personal', 'Almacén', '']) {
    assert.equal(merchantMark(name, true).kind, 'category', name);
  }
});

test('the preview is development-only', () => {
  assert.equal(merchantMarkPreview('1', true), true);
  assert.equal(merchantMarkPreview('1', false), false, 'a release or preview build never draws it');
  assert.equal(merchantMarkPreview(undefined, true), false);
  assert.equal(merchantMarkPreview('true', true), false);
  assert.equal(BUILD_MERCHANT_MARK_PREVIEW, false, 'Node is not a development bundle');
});

test('no logo path exists: no image, provider, key, network call or brand asset', () => {
  const adapter = readFileSync(new URL('../src/ui/merchant-mark.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(adapter, /fetch\(|XMLHttpRequest|require\(|https?:\/\/|logo\.dev|brandfetch|clearbit|api[_-]?key|token=/i);
  const components = readFileSync(new URL('../src/ui/components.tsx', import.meta.url), 'utf8');
  const badge = components.slice(components.indexOf('export function MerchantBadge'), components.indexOf('/** A liquid account as one designed object'));
  assert.doesNotMatch(badge, /<Image|source=|uri/);
  // No brand image is tracked anywhere in the app.
  const images = execFileSync('git', ['ls-files', '*.png', '*.jpg', '*.jpeg', '*.svg', '*.webp', '*.gif'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.equal(images.some(file => /netflix|spotify|apple|mercado|brand|logo|merchant/i.test(file)), false, JSON.stringify(images));
});
