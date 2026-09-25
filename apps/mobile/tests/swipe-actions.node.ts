import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindLocale } from '../src/i18n/bind.ts';
import { lightPalette } from '../src/ui/palette.ts';
import { realModule } from './real-module.ts';

// Producto 24UX4: the trailing swipe row, loaded from source with its native hosts as descriptors. It proves the
// configuration and the handlers (tap closes then acts, one open row at a time, the VoiceOver twin), not the feel of
// the gesture on a device, which stays in the iPhone checklist.
type Node = { type: any; props: Record<string, any> };
const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
const modules: Record<string, unknown> = {
  react: { useRef: (initial: unknown) => ({ current: initial }) },
  'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
  'react-native': { Pressable: 'Pressable', View: 'View' },
  'react-native-gesture-handler/ReanimatedSwipeable': { __esModule: true, default: 'Swipeable' },
  '@expo/vector-icons/Ionicons': { __esModule: true, default: 'Ionicons' },
  // A device in English: VoiceOver is told the interface's language on every raw Pressable.
  '../i18n/provider': { useI18n: () => bindLocale('es-AR', undefined, 'en') },
  './components': { AppText: 'AppText' },
  './theme': { usePalette: () => lightPalette },
};
const load = () => realModule('src/ui/swipe-actions.tsx', name => {
  if (!Object.hasOwn(modules, name)) throw new Error('Unexpected swipe dependency: ' + name);
  return modules[name];
});
const calls: string[] = [];
const actions = [
  { key: 'pause', label: 'Pausar', icon: 'pause', tone: 'neutral', onPress: () => calls.push('pause') },
  { key: 'delete', label: 'Eliminar', icon: 'trash', tone: 'destructive', onPress: () => calls.push('delete') },
];

test('24UX4: a row with actions is a trailing swipeable that never overshoots and opens past half its actions', () => {
  const { SwipeRow } = load();
  const row: Node = SwipeRow({ actions, children: 'content' });
  assert.equal(row.type, 'Swipeable');
  assert.equal(row.props.overshootRight, false, 'no full-swipe action: nothing destructive runs without a tap');
  assert.equal(row.props.friction, 1, 'the row follows the finger 1:1');
  assert.equal(row.props.rightThreshold, 76, 'two 76 pt actions open past half their width');
  assert.equal(row.props.renderLeftActions, undefined, 'trailing only');
  assert.equal(row.props.childrenContainerStyle.backgroundColor, lightPalette.surface, 'the row is opaque over its actions');
  assert.equal(row.props.children, 'content');
  // A row without actions is just its content.
  const plain: Node = SwipeRow({ actions: [], children: 'content' });
  assert.equal(plain.type, 'Fragment');
});

test('24UX4: the actions are solid iOS buttons in order, delete last and red; a tap closes the row, then acts', () => {
  const { SwipeRow } = load();
  const row: Node = SwipeRow({ actions, children: 'content' });
  let closed = 0;
  const panel: Node = row.props.renderRightActions({ value: 0 }, { value: 0 }, { close: () => { closed++; calls.push('close'); } });
  const buttons: Node[] = panel.props.children;
  assert.equal(buttons.map(button => button.props.accessibilityLabel).join(','), 'Pausar,Eliminar');
  const fills = buttons.map(button => button.props.style({ pressed: false }).backgroundColor);
  assert.equal(fills.join(','), [lightPalette.swipeNeutral, lightPalette.swipeDestructive].join(','));
  assert.equal(buttons[1].props.style({ pressed: true }).opacity, 0.8, 'pressed feedback');
  assert.ok(buttons.every(button => button.props.accessibilityRole === 'button' && button.props.accessibilityLanguage === 'es'));
  assert.ok(buttons.every(button => button.props.style({ pressed: false }).minWidth === 76), '76 pt minimum, wider with a larger text size');
  calls.length = 0;
  buttons[1].props.onPress();
  assert.equal(calls.join(','), 'close,delete');
  assert.equal(closed, 1);
});

test('24UX4: opening one row closes the row that was open, like a UITableView', () => {
  const { SwipeRow } = load();
  const first: Node = SwipeRow({ actions, children: 'a' }), second: Node = SwipeRow({ actions, children: 'b' });
  const log: string[] = [];
  first.props.ref.current = { close: () => log.push('first closed') };
  second.props.ref.current = { close: () => log.push('second closed') };
  first.props.onSwipeableWillOpen('right');
  second.props.onSwipeableWillOpen('right');
  assert.equal(log.join(','), 'first closed');
  second.props.onSwipeableClose('right');
  first.props.onSwipeableWillOpen('right');
  assert.equal(log.join(','), 'first closed', 'a row closed by the finger is no longer tracked');
});

test('24UX4: the same actions reach VoiceOver as the row\'s custom actions', () => {
  const { swipeAccessibility } = load();
  const a11y = swipeAccessibility(actions);
  assert.equal(JSON.stringify(a11y.accessibilityActions), JSON.stringify([{ name: 'pause', label: 'Pausar' }, { name: 'delete', label: 'Eliminar' }]));
  calls.length = 0;
  a11y.onAccessibilityAction({ nativeEvent: { actionName: 'pause' } });
  a11y.onAccessibilityAction({ nativeEvent: { actionName: 'unknown' } });
  assert.equal(calls.join(','), 'pause');
});
