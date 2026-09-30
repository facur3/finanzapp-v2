import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { PreferenceStore } from '../src/i18n/preference.ts';
import { THEME_PREFERENCE_KEY, createThemePreferenceStore, effectiveScheme, nativeScheme, themePreferenceFrom, type NativeScheme, type ThemePreference } from '../src/ui/theme-preference.ts';

// Producto 24UX6A: Más → Apariencia over a key-value store in memory. How the whole app repaints on an iPhone, the
// keyboard and the alerts following the choice, and a relaunch after a force quit remain device acceptance items.
function memory(initial: Record<string, string> = {}) {
  const rows = new Map(Object.entries(initial));
  const failing = { read: false, write: false };
  const store: PreferenceStore = {
    getItemSync: key => { if (failing.read) throw new Error('unreadable'); return rows.get(key) ?? null; },
    setItemSync: (key, value) => { if (failing.write) throw new Error('disk full'); rows.set(key, value); },
    removeItemSync: key => { if (failing.write) throw new Error('disk full'); return rows.delete(key); },
  };
  return { rows, failing, store: () => store };
}

test('24UX6A: a new installation follows the device; a stored choice is read back as it was saved', () => {
  const { store } = memory();
  const applied: NativeScheme[] = [];
  assert.equal(createThemePreferenceStore(store, scheme => applied.push(scheme)).getState(), 'system');
  assert.deepEqual(applied, ['unspecified'], 'iOS keeps deciding');
  for (const stored of ['light', 'dark'] as const) {
    const told: NativeScheme[] = [];
    assert.equal(createThemePreferenceStore(memory({ [THEME_PREFERENCE_KEY]: stored }).store, scheme => told.push(scheme)).getState(), stored);
    assert.deepEqual(told, [stored], 'applied when the store is created, before the first frame');
  }
  assert.equal(THEME_PREFERENCE_KEY, 'finanzapp.appearance');
  for (const junk of ['Dark', 'sepia', '', 'system', null, undefined, 1]) assert.equal(themePreferenceFrom(junk), 'system', JSON.stringify(junk) + ' reads as Sistema');
});

test('24UX6A: a choice is saved before it is applied; Sistema removes the key; the choice survives a relaunch', () => {
  const { rows, store } = memory();
  const events: string[] = [];
  const preferences = createThemePreferenceStore(store, scheme => events.push('apply:' + scheme + ':' + (rows.get(THEME_PREFERENCE_KEY) ?? '-')));
  const unsubscribe = preferences.subscribe(() => events.push('notify:' + preferences.getState()));
  assert.equal(preferences.set('dark'), true);
  assert.equal(rows.get(THEME_PREFERENCE_KEY), 'dark');
  assert.equal(events.slice(1).join(), 'apply:dark:dark,notify:dark', 'written, then told to iOS, then the screens repaint');
  // A force quit: a new store over the same rows opens dark.
  assert.equal(createThemePreferenceStore(store).getState(), 'dark');
  assert.equal(preferences.set('system'), true);
  assert.equal(rows.has(THEME_PREFERENCE_KEY), false, 'Sistema is the absence of the key');
  assert.equal(events.at(-2), 'apply:unspecified:-', 'the decision goes back to the device');
  assert.equal(createThemePreferenceStore(store).getState(), 'system');
  // The same choice again is still told to iOS (idempotent) but repaints nothing.
  const before = events.length;
  assert.equal(preferences.set('system'), true);
  assert.equal(events.slice(before).join(), 'apply:unspecified:-');
  unsubscribe();
  preferences.set('light');
  assert.equal(events.some(event => event === 'notify:light'), false, 'an unsubscribed screen hears nothing');
});

test('24UX6A: a refused write changes nothing, says so, and never resets the store; an unreadable store follows the device', () => {
  const { rows, failing, store } = memory({ [THEME_PREFERENCE_KEY]: 'light' });
  const applied: NativeScheme[] = [];
  const preferences = createThemePreferenceStore(store, scheme => applied.push(scheme));
  let notified = 0;
  preferences.subscribe(() => { notified++; });
  failing.write = true;
  assert.equal(preferences.set('dark'), false, 'the chooser keeps its checkmark and shows the error');
  assert.equal(preferences.set('system'), false);
  assert.equal(preferences.getState(), 'light');
  assert.deepEqual(applied, ['light'], 'iOS is never told a choice that was not saved');
  assert.equal(notified, 0);
  assert.equal(rows.get(THEME_PREFERENCE_KEY), 'light', 'the stored choice is untouched');
  assert.equal(preferences.set('sepia' as ThemePreference), false, 'an unknown value is refused before any write');
  failing.read = true;
  assert.equal(createThemePreferenceStore(store).getState(), 'system', 'an unreadable store is not an error');
  // A failing native call keeps the palette's own decision.
  failing.read = false; failing.write = false;
  const throwing = createThemePreferenceStore(store, () => { throw new Error('no native module'); });
  assert.equal(throwing.set('dark'), true);
  assert.equal(throwing.getState(), 'dark');
});

test('24UX6A: the palette follows the choice, or the device while the choice is Sistema; iOS hears the same', () => {
  assert.equal(effectiveScheme('system', 'dark'), 'dark');
  assert.equal(effectiveScheme('system', 'light'), 'light');
  assert.equal(effectiveScheme('system', null), 'light', 'a device that does not say reads as light, the iOS default');
  assert.equal(effectiveScheme('system', 'unspecified'), 'light');
  assert.equal(effectiveScheme('light', 'dark'), 'light', 'a fixed choice wins over the device');
  assert.equal(effectiveScheme('dark', 'light'), 'dark');
  assert.deepEqual((['system', 'light', 'dark'] as const).map(nativeScheme), ['unspecified', 'light', 'dark']);
});

test('24UX6A: one store for the app, created before the first render; the palettes themselves are unchanged', () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const layout = read('../app/_layout.tsx');
  const splash = layout.indexOf('SplashScreen.preventAutoHideAsync');
  const created = layout.indexOf('themePreferenceStore();');
  assert.ok(splash >= 0 && created > splash && created < layout.indexOf('export default function'), 'module scope, beside the splash guard, before any screen renders');
  const theme = read('../src/ui/theme.ts');
  assert.match(theme, /createThemePreferenceStore\(defaultPreferenceStore, scheme => Appearance\.setColorScheme\(scheme\)\)/);
  assert.match(theme, /effectiveScheme\(preference, useColorScheme\(\)\)/, 'usePalette reads the choice, then the device');
  assert.equal((theme.match(/useColorScheme\(\)/g) ?? []).length, 2, 'the device is read only through the choice (and the chooser\'s «ahora …» line)');
  // Not ledger data: nothing in the database, the backups or the domain knows the key.
  const files = [...readdirSync(new URL('../src/storage/', import.meta.url)).map(file => '../src/storage/' + file),
    ...readdirSync(new URL('../../../packages/domain/', import.meta.url)).filter(file => file.endsWith('.ts')).map(file => '../../../packages/domain/' + file)];
  assert.ok(files.some(file => file.endsWith('domain/ledger.ts')) && files.some(file => file.endsWith('storage/database.ts')), 'the scan reaches the archive (what a backup carries) and the database code');
  for (const file of files) assert.equal(/finanzapp\.appearance|THEME_PREFERENCE_KEY|theme-preference/.test(read(file)), false, file);
});
