import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILD_QA_PROFILE, profiledDatabase, profiledStore, qaProfileForBuild } from '../src/dev/qa-profile.ts';
import { DATABASE_NAME } from '../src/storage/database.ts';
import { RATES_DATABASE_NAME } from '../src/storage/rates-database.ts';
import { REVIEW_DATABASE_NAME } from '../src/storage/review-database.ts';
import type { PreferenceStore } from '../src/i18n/preference.ts';

// M1 (2026-10-17): device QA of a new installation on the owner's iPhone without opening the owner's data.

test('M1: only a development bundle with the variable runs a QA profile; a mistyped name still never falls through to the real files', () => {
  assert.equal(BUILD_QA_PROFILE, null, 'Node, like a release, runs the person\'s own data');
  assert.equal(qaProfileForBuild('m1', false), null, 'a release or preview bundle ignores it (__DEV__ is false)');
  for (const value of [undefined, '', '   ']) assert.equal(qaProfileForBuild(value, true), null, JSON.stringify(value));
  assert.deepEqual(['m1', 'M1', 'm-1 ', 'primera apertura', '¿?', 'x'.repeat(40)].map(value => qaProfileForBuild(value, true)),
    ['m1', 'm1', 'm1', 'primeraapertura', 'qa', 'x'.repeat(16)]);
});

test('M1: a profile opens its own three files and its own preference keys; the person\'s are never named', () => {
  assert.deepEqual([DATABASE_NAME, RATES_DATABASE_NAME, REVIEW_DATABASE_NAME].map(name => profiledDatabase(name, 'm1')),
    ['finanzapp-native-pilot-v1.qa-m1.sqlite', 'finanzapp-rates-v1.qa-m1.sqlite', 'finanzapp-review-v1.qa-m1.sqlite']);
  assert.equal(profiledDatabase(DATABASE_NAME, null), DATABASE_NAME, 'no profile: the person\'s own file');
  assert.equal(profiledDatabase(DATABASE_NAME), DATABASE_NAME);
  const rows = new Map([['finanzapp.onboarding', 'done'], ['finanzapp.language', 'en']]);
  const base: PreferenceStore = { getItemSync: key => rows.get(key) ?? null, setItemSync: (key, value) => { rows.set(key, value); }, removeItemSync: key => rows.delete(key) };
  const store = profiledStore(base, 'm1');
  assert.equal(store.getItemSync('finanzapp.onboarding'), null, 'a new installation: the person\'s onboarding mark is not seen');
  store.setItemSync('finanzapp.language', 'es');
  store.removeItemSync('finanzapp.onboarding');
  assert.deepEqual([...rows], [['finanzapp.onboarding', 'done'], ['finanzapp.language', 'en'], ['qa-m1:finanzapp.language', 'es']], 'the person\'s keys untouched');
  assert.equal(profiledStore(base, null), base);
});
