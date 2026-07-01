import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { shortcutCaptureSearchFromUrl } from '../domain/shortcutCapture.js';

function deliverShortcutUrl(url) {
  const search = shortcutCaptureSearchFromUrl(url);
  if (!search) return;
  window.__finanzappPendingShortcutSearch = search;
  window.dispatchEvent(new CustomEvent('finanzapp:shortcutCapture', { detail: { search } }));
}

if (Capacitor.isNativePlatform()) {
  App.addListener('appUrlOpen', (event) => deliverShortcutUrl(event && event.url));
  App.getLaunchUrl().then((launch) => deliverShortcutUrl(launch && launch.url)).catch(() => {});
}
