/* FinanzApp service worker — minimal offline app shell.
   Infrastructure only: no UI, no push, no user-data caching. */
'use strict';

var CACHE = 'finanzapp-shell-v62';

// App shell assets to precache. Kept intentionally small.
var SHELL = [
  '/',
  '/index.html',
  '/support.js',
  '/domain.iife.js',
  '/capacitor-deep-links.iife.js',
  '/finanzapp.css',
  '/vendor/react.production.min.js',
  '/vendor/react-dom.production.min.js',
  '/vendor/supabase.js',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon-32.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // Use addAll but tolerate individual failures so install never breaks.
      return Promise.all(SHELL.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin provider requests

  // API responses contain market data and must never be served stale from the
  // app-shell cache. When offline, report the failure so the UI keeps its last
  // explicitly persisted quote and can label it as such.
  if (url.pathname.indexOf('/api/') === 0) {
    event.respondWith(fetch(new Request(req, { cache: 'no-store' })).catch(function () {
      return new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }));
    return;
  }

  // Navigations: network-first so updates are picked up, fall back to cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('/index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('/index.html').then(function (r) { return r || caches.match('/'); });
      })
    );
    return;
  }

  // Same-origin static assets: network-first prevents a fresh HTML document from
  // running against an older JS/CSS bundle. The verified shell remains available
  // as an offline fallback.
  event.respondWith(
    fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return caches.match(req); })
  );
});
