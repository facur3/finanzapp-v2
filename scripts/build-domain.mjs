#!/usr/bin/env node
/* Bundles the ES-module financial domain (src/domain/) into a single CLASSIC
   IIFE script (public/domain.iife.js) that sets window.FinanzDomain.
   Why classic + synchronous: the x-dc component boots inside
   loadReactUmd().then(init) and may run before a deferred <script type=module>
   executes (a race). A classic <script> in <head> runs synchronously during
   parse, guaranteeing window.FinanzDomain exists before first render.
   The IIFE is generated (git-ignored) so src/domain/ stays the single source of
   truth — also unit-tested via `npm test`. */
import { build } from 'esbuild';

await build({
  entryPoints: ['src/domain/index.js'],
  bundle: true,
  format: 'iife',
  target: 'es2019',
  outfile: 'public/domain.iife.js',
  banner: { js: '/* GENERATED from src/domain — do not edit. Run: npm run build:domain */' },
});

console.log('build:domain — wrote public/domain.iife.js');
