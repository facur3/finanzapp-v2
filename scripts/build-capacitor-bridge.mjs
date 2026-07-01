#!/usr/bin/env node
/* Bundles the tiny Capacitor native deep-link bridge. It no-ops on web/PWA and
   only activates inside the Capacitor iOS shell. */
import { build } from 'esbuild';

await build({
  entryPoints: ['src/capacitor/deepLinks.js'],
  bundle: true,
  format: 'iife',
  target: 'es2019',
  outfile: 'public/capacitor-deep-links.iife.js',
  banner: { js: '/* GENERATED from src/capacitor/deepLinks.js — do not edit. */' },
});

console.log('build:capacitor-bridge — wrote public/capacitor-deep-links.iife.js');
