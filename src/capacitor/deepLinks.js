import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
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

  let speechHandles = [];
  const clearSpeechHandles = async () => {
    const handles = speechHandles;
    speechHandles = [];
    await Promise.all(handles.map(handle => handle && handle.remove ? handle.remove().catch(() => {}) : null));
  };

  // The single-file UI cannot import ESM packages directly. Expose a deliberately
  // tiny adapter for native dictation while keeping the Web Speech API as its PWA
  // fallback. No audio leaves this adapter and only the transcript reaches the UI.
  window.FinanzNativeSpeech = {
    async available() {
      const result = await SpeechRecognition.available();
      return Boolean(result && result.available);
    },
    async start(callbacks = {}) {
      const availability = await SpeechRecognition.available();
      if (!availability || !availability.available) throw new Error('speech-unavailable');
      let permissions = await SpeechRecognition.checkPermissions();
      if (!permissions || permissions.speechRecognition !== 'granted') {
        permissions = await SpeechRecognition.requestPermissions();
      }
      if (!permissions || permissions.speechRecognition !== 'granted') throw new Error('speech-permission-denied');
      await clearSpeechHandles();
      speechHandles.push(await SpeechRecognition.addListener('partialResults', data => {
        const text = data && Array.isArray(data.matches) ? data.matches[0] : '';
        if (text && callbacks.onResult) callbacks.onResult(text);
      }));
      speechHandles.push(await SpeechRecognition.addListener('listeningState', data => {
        if (callbacks.onState) callbacks.onState(Boolean(data && data.status === 'started'));
      }));
      if (callbacks.onState) callbacks.onState(true);
      const result = await SpeechRecognition.start({
        language: 'es-AR',
        maxResults: 3,
        partialResults: true,
        popup: false,
        prompt: 'Contame qué pasó',
      });
      const text = result && Array.isArray(result.matches) ? result.matches[0] : '';
      if (text && callbacks.onResult) callbacks.onResult(text);
    },
    async stop() {
      // Some native recognizers take time to settle; never leave the UI blocked.
      await Promise.race([
        SpeechRecognition.stop().catch(() => {}),
        new Promise(resolve => setTimeout(resolve, 800)),
      ]);
      await clearSpeechHandles();
    },
  };
}
