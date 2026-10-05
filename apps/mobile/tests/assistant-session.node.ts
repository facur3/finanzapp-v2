import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { REASON_TEXT, emptyConversation, type ConversationAction } from '../src/assistant/conversation.ts';
import { conversationSession, createConversationSession, lastUserWords } from '../src/assistant/session.ts';

// Producto 24UX6A: the Assistant's conversation lives in an in-memory app session (src/assistant/session.ts), not in the
// screen, so leaving the root-stack screen and coming back finds it. Pure: Node drives it directly, with the real reducer.
// Synthetic fixtures only.
// 25A-04: the session holds no write: a proposal is captured into the review store, which keeps it (its frozen ids make a
// retry idempotent; tests/assistant-review.node.ts on real SQLite and tests/assistant-routes.node.ts for the screen).

test('a new session is empty and idle, with no request, no capture in flight and nothing it could write', () => {
  const session = createConversationSession();
  const state = session.getState();
  assert.equal(state.conversation, emptyConversation);
  assert.equal(session.request.current, null);
  assert.equal(session.capturing.size, 0);
  assert.equal(session.presenter.current, null, 'no Assistant in front yet: nothing can present a review sheet');
  assert.deepEqual(Object.keys(session).sort(), ['capturing', 'dispatch', 'getState', 'presenter', 'request', 'reset', 'subscribe']);
  assert.equal(lastUserWords(state.conversation), null);
});

test('dispatch goes through the real conversation reducer and notifies every subscriber; unsubscribing stops the calls', () => {
  const session = createConversationSession();
  const calls: string[] = [];
  const offA = session.subscribe(() => calls.push('a'));
  session.subscribe(() => calls.push('b'));
  session.dispatch({ type: 'send', text: '  ¿Cuánto gasté en comida? ' });
  const state = session.getState().conversation;
  assert.equal(state.phase, 'thinking');
  assert.equal(state.messages.length, 1);
  assert.equal(state.messages[0].id, 'u-1');
  assert.equal(state.messages[0].text, '¿Cuánto gasté en comida?', 'the reducer trims, exactly as on screen');
  assert.equal(calls.join(), 'a,b');
  session.dispatch({ type: 'delta', text: 'En comida ' });
  assert.equal(session.getState().conversation.phase, 'streaming');
  assert.equal(calls.join(), 'a,b,a,b');
  offA();
  session.dispatch({ type: 'delta', text: 'llevás poco.' });
  assert.equal(calls.join(), 'a,b,a,b,b');
  const last = session.getState().conversation.messages.at(-1)!;
  assert.equal(last.role === 'assistant' && last.text, 'En comida llevás poco.');
});

test('no notification and the same state object when an action changes nothing (useSyncExternalStore re-renders on identity)', () => {
  const session = createConversationSession();
  let calls = 0;
  session.subscribe(() => { calls++; });
  const before = session.getState();
  const unchanged: ConversationAction[] = [
    { type: 'delta', text: 'late' }, // idle: a late event is ignored
    { type: 'stop' }, // idle: nothing to stop
    { type: 'compose', text: '' }, // same composer text
    { type: 'send', text: '   ' }, // nothing to send
  ];
  for (const action of unchanged) session.dispatch(action);
  assert.equal(calls, 0);
  assert.equal(session.getState(), before, 'getState is stable between changes');
  session.dispatch({ type: 'compose', text: 'Gasté' });
  assert.equal(calls, 1);
  assert.notEqual(session.getState(), before);
  const after = session.getState();
  session.dispatch({ type: 'compose', text: 'Gasté' });
  assert.equal(calls, 1);
  assert.equal(session.getState(), after);
});

test('reset (New chat) aborts the request in flight, empties the conversation and keeps message ids increasing', () => {
  const session = createConversationSession();
  session.dispatch({ type: 'send', text: '¿Por qué gasté más este mes?' });
  session.dispatch({ type: 'delta', text: 'Gastaste ' });
  const controller = new AbortController();
  session.request.current = controller;
  let calls = 0;
  session.subscribe(() => { calls++; });
  session.reset();
  assert.equal(controller.signal.aborted, true, 'the request is aborted');
  assert.equal(session.request.current, null);
  const state = session.getState().conversation;
  assert.equal(state.messages.length, 0);
  assert.equal(state.phase, 'idle');
  assert.equal(state.composer, '');
  assert.equal(state.pending, null);
  assert.ok(calls >= 1, 'subscribers learn about the reset');
  assert.equal(lastUserWords(state), null);
  // A late event from the aborted request changes nothing.
  session.dispatch({ type: 'delta', text: 'late' });
  assert.equal(session.getState().conversation.messages.length, 0);
  // The next exchange gets new ids, never reusing u-1/a-2.
  session.dispatch({ type: 'send', text: 'Otra pregunta' });
  assert.equal(session.getState().conversation.messages[0].id, 'u-3');
  // Reset with nothing in flight is safe.
  const quiet = createConversationSession();
  quiet.reset();
  assert.equal(quiet.getState().conversation.messages.length, 0);
});

test('conversationSession() is one shared instance for the app process, distinct from sessions created for tests', async () => {
  const first = conversationSession();
  assert.equal(conversationSession(), first);
  const again = await import('../src/assistant/session.ts');
  assert.equal(again.conversationSession(), first, 'the same module instance hands out the same session');
  assert.notEqual(createConversationSession(), first);
});

test('lastUserWords is the person\'s last real words, and null when there is nothing to continue', () => {
  const session = createConversationSession();
  assert.equal(lastUserWords(session.getState().conversation), null, 'nothing said yet');
  // Only what was composed but not sent is not an exchange.
  session.dispatch({ type: 'compose', text: 'Gasté 500' });
  assert.equal(lastUserWords(session.getState().conversation), null);
  session.dispatch({ type: 'send', text: '¿Cuánto gasté en comida?' });
  assert.equal(lastUserWords(session.getState().conversation), '¿Cuánto gasté en comida?');
  session.dispatch({ type: 'answer', text: 'En comida llevás $10.', content: null });
  assert.equal(lastUserWords(session.getState().conversation), '¿Cuánto gasté en comida?', 'the answer is not the person\'s words');
  session.dispatch({ type: 'send', text: 'Y en transporte' });
  assert.equal(lastUserWords(session.getState().conversation), 'Y en transporte', 'the last one, not the first');
  // A failure that sent nothing (disconnected build) returns the words to the composer: they are no longer an exchange.
  const disconnected = createConversationSession();
  disconnected.dispatch({ type: 'send', text: '¿Por qué gasté más?' });
  disconnected.dispatch({ type: 'fail', reason: 'unavailable', text: REASON_TEXT.unavailable, sent: '¿Por qué gasté más?' });
  assert.equal(disconnected.getState().conversation.composer, '¿Por qué gasté más?');
  assert.equal(lastUserWords(disconnected.getState().conversation), null);
  // A request that did leave and failed keeps the person's message (it can be retried), so it can be continued.
  const offline = createConversationSession();
  offline.dispatch({ type: 'send', text: '¿Por qué gasté más?' });
  offline.dispatch({ type: 'fail', reason: 'offline', text: REASON_TEXT.offline, sent: '¿Por qué gasté más?' });
  assert.equal(lastUserWords(offline.getState().conversation), '¿Por qué gasté más?');
  // After New chat there is nothing to continue.
  session.reset();
  assert.equal(lastUserWords(session.getState().conversation), null);
});

test('nothing is persisted: the session module imports no storage, preference, React or native module', () => {
  const source = readFileSync(new URL('../src/assistant/session.ts', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/^import\s[^;]*?from\s+'([^']+)'/gm)].map(match => match[1]);
  assert.equal(imports.join(), './conversation.ts', '25A-04: not even the Entry type: the session holds no write');
  for (const forbidden of [/sqlite/i, /kv-store/, /preference/i, /AsyncStorage/, /SecureStore/, /localStorage/, /\bstorage\//, /from 'react/, /expo-/, /backup/i])
    assert.equal(forbidden.test(source.replace(/\/\*\*[\s\S]*?\*\//g, '')), false, 'no ' + forbidden + ' outside comments');
});
