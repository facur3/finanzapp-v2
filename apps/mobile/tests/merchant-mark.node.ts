import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BUILD_LOGO_PROVIDER, BUILD_MERCHANT_MARK_PREVIEW, NO_LOGOS, merchantMark, merchantMarkPreview, type MerchantLogoProvider } from '../src/ui/merchant-mark.ts';

// Producto 24UX2: what a row draws for a merchant. Pure; nothing here renders or reaches the network.
const logos = (source: any, attribution: string | null = null): MerchantLogoProvider => ({ id: 'fake', logoFor: () => ({ source, attribution }) });

test('an unrecognized or ambiguous merchant always draws its category glyph, whatever the provider has', () => {
  const provider = logos({ uri: 'https://logos.example/x.png' });
  for (const name of ['Almacén Don Pepe', 'Pago Netflix', 'Netflix y Spotify', 'Personal', '', '   ']) {
    assert.equal(merchantMark(name, provider).kind, 'category', name);
  }
});

test('this build has no logo provider: a recognized merchant still draws its category glyph', () => {
  assert.equal(BUILD_LOGO_PROVIDER, NO_LOGOS);
  assert.equal(JSON.stringify(merchantMark('Netflix')), JSON.stringify({ kind: 'category' }));
  assert.equal(merchantMark('Netflix', NO_LOGOS, 'dark').kind, 'category');
});

test('a recognized merchant draws a provider logo only from an https URI or a bundled asset', () => {
  const mark = merchantMark('netflix.com', logos({ uri: 'https://logos.example/netflix.png' }, 'Logos by Example'));
  assert.equal(mark.kind, 'logo');
  if (mark.kind === 'logo') {
    assert.equal(mark.brand.id, 'netflix');
    assert.equal(mark.logo.attribution, 'Logos by Example');
  }
  assert.equal(merchantMark('Netflix', logos(7)).kind, 'logo', 'a bundled asset id');
  for (const source of [{ uri: 'http://logos.example/n.png' }, { uri: 'file:///tmp/n.png' }, { uri: 'data:image/png;base64,AAAA' }, { uri: 'https://a b' }, 0, -1, 1.5, null, {}]) {
    assert.equal(merchantMark('Netflix', logos(source)).kind, 'category', JSON.stringify(source));
  }
});

test('a provider that throws or has nothing gives the category glyph, and it is asked with the theme', () => {
  const failing: MerchantLogoProvider = { id: 'failing', logoFor: () => { throw new Error('offline'); } };
  assert.equal(merchantMark('Spotify', failing).kind, 'category');
  const asked: string[] = [];
  const recording: MerchantLogoProvider = { id: 'rec', logoFor: (brand, scheme) => { asked.push(brand.id + ':' + scheme); return null; } };
  merchantMark('Spotify Premium', recording, 'dark');
  merchantMark('Almacén', recording, 'dark');
  assert.equal(asked.join(','), 'spotify:dark', 'only a recognized brand is ever looked up');
});

test('the monogram preview is development-only and never replaces a real logo', () => {
  assert.equal(merchantMarkPreview('1', true), true);
  assert.equal(merchantMarkPreview('1', false), false, 'a release or preview build never draws it');
  assert.equal(merchantMarkPreview(undefined, true), false);
  assert.equal(merchantMarkPreview('true', true), false);
  assert.equal(BUILD_MERCHANT_MARK_PREVIEW, false, 'Node is not a development bundle');
  const preview = merchantMark('Mercado Pago', NO_LOGOS, 'light', true);
  assert.equal(preview.kind === 'monogram' ? preview.brand.id + ':' + preview.letter : preview.kind, 'mercado-pago:M');
  assert.equal(merchantMark('Almacén', NO_LOGOS, 'light', true).kind, 'category');
  assert.equal(merchantMark('Netflix', logos({ uri: 'https://l.example/n.png' }), 'light', true).kind, 'logo');
});

test('the adapter holds no key, no provider URL and no network call', () => {
  const source = readFileSync(new URL('../src/ui/merchant-mark.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|logo\.dev|brandfetch|clearbit|api[_-]?key|token=/i);
});
