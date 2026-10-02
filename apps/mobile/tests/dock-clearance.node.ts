import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DOCK, DOCK_INDICATOR_STEPS, dockClearance, dockIndicatorInset, dockRestGap, tabBarBottomGap } from '../src/ui/dock-geometry.ts';
import * as dockGeometry from '../src/ui/dock-geometry.ts';
import { realModule } from './real-module.ts';

// Producto 25OPS1: the final-scroll clearance above the floating dock, after the owner's iPhone pass of 25UX1 (the last
// row of Inicio, Reportes and Más rested partly behind the pill and sprang back under it after an overscroll). The
// clearance is content layout on every platform (bottom padding), never a native `contentInset`; only the scroll
// indicator's inset is native, and it is asserted again whenever React Native may have overwritten it. What a Node test
// cannot see, the rest position on a real iPhone, VoiceOver and the indicator itself, stays in the device checklist.

type Inset = { extraPadding: number; indicator: { bottom: number } | undefined };

/** The real hook module over a minimal React. `mount()` is one scroller using the hook (its own state by call order,
 * its effects run once with their cleanup kept); every mount shares the one module, as the roots do in the app. */
function hook({ os = 'ios', inTabs = true, bottom = 34 }: { os?: string; inTabs?: boolean; bottom?: number } = {}) {
  type Instance = { state: unknown[]; effects: { deps: unknown[]; cleanup?: () => void }[]; cursor: number; effectCursor: number };
  const listeners = new Map<string, Set<() => void>>();
  let current: Instance;
  const TAB_CONTEXT = { name: 'BottomTabBarHeightContext' };
  const modules: Record<string, unknown> = {
    react: {
      useContext: (context: unknown) => { assert.equal(context, TAB_CONTEXT, 'the tab navigator\'s own context'); return inTabs ? 83 : undefined; },
      useState: (initial: unknown) => {
        const { state } = current;
        const index = current.cursor++;
        if (!(index in state)) state[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
        return [state[index], (value: unknown) => { state[index] = value; }];
      },
      useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
        const { effects } = current;
        const index = current.effectCursor++;
        const previous = effects[index];
        if (previous && previous.deps.every((dep, i) => dep === deps[i])) return;
        previous?.cleanup?.();
        effects[index] = { deps, cleanup: effect() ?? undefined };
      },
    },
    'expo-router/tabs': { BottomTabBarHeightContext: TAB_CONTEXT },
    'react-native': { Platform: { OS: os }, Keyboard: { addListener: (event: string, listener: () => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
      return { remove: () => listeners.get(event)!.delete(listener) };
    } } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom, left: 0, right: 0 }) },
    './dock-geometry.ts': dockGeometry,
  };
  const exports = realModule('src/ui/dock-clearance.ts', (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected dock-clearance dependency: ' + name);
    return modules[name];
  });
  const mount = () => {
    const instance: Instance = { state: [], effects: [], cursor: 0, effectCursor: 0 };
    return {
      render: (): Inset => { current = instance; instance.cursor = 0; instance.effectCursor = 0; const { extraPadding, indicator } = exports.useDockInset(); return { extraPadding, indicator }; },
      unmount: () => instance.effects.forEach(effect => effect.cleanup?.()),
    };
  };
  return {
    mount, render: () => mount().render(),
    clearance: (): number => exports.useDockClearance(),
    emit: (event: string) => listeners.get(event)?.forEach(listener => listener()),
    listening: (event: string) => listeners.get(event)?.size ?? 0,
  };
}

test('25OPS1: at the real end of the scroll the last row rests above the pill, on every device', () => {
  // The base paddings the four roots keep under their last row: Inicio, Reportes and Más 48, Movimientos 40.
  for (const base of [48, 40]) for (const bottom of [0, 21, 34, 48]) {
    const pillTop = tabBarBottomGap(bottom) + DOCK.height;
    // The content's end sits `base + clearance` above the window's bottom: layout, with no overscroll.
    const lastRowBottom = base + dockClearance(bottom);
    assert.ok(lastRowBottom > pillTop, 'the last row ends above the pill');
    assert.equal(dockRestGap(bottom, base), lastRowBottom - pillTop);
    assert.equal(dockRestGap(bottom, base), base + DOCK.top, 'its air: the root\'s own padding and the 8 pt over the pill, the same with and without a home indicator');
  }
  // Enough to clear the dock, never a second screenful: the clearance is the dock's own extent above the window's bottom.
  assert.equal(dockClearance(34), 88);
  assert.equal(dockClearance(0), 78);
  assert.ok(dockClearance(34) - (tabBarBottomGap(34) + DOCK.height) === DOCK.top, 'nothing beyond the dock but its 8 pt');
  // The safe area is counted once: through the dock's air, never added again on top of the clearance.
  assert.ok(dockClearance(34) < 34 + DOCK.height + DOCK.top, 'not the whole home-indicator inset plus the dock');
});

test('25OPS1: inside a tab root the clearance is bottom padding on every platform, and never a native content inset', () => {
  for (const os of ['ios', 'android']) for (const bottom of [0, 34]) {
    const inset = hook({ os, bottom }).render();
    assert.equal(inset.extraPadding, dockClearance(bottom), os + ': the whole clearance is content layout');
    assert.equal(Object.keys(hook({ os, bottom }).mount().render()).sort().join(), 'extraPadding,indicator', 'no `inset`, no `contentInset`: nothing for the native scroll view to lose');
  }
  assert.equal(hook({ os: 'android' }).render().indicator, undefined, 'the indicator inset is iOS\'s');
  const ios = hook({ os: 'ios' }).render();
  assert.ok(ios.indicator && ios.indicator.bottom > 88 && ios.indicator.bottom <= 88.25, 'the indicator ends above the dock, within a quarter point of the clearance');
});

test('25OPS1: off the tabs (a pushed screen, a modal, the capture hub) nothing changes', () => {
  for (const os of ['ios', 'android']) {
    const off = hook({ os, inTabs: false });
    assert.equal(off.clearance(), 0);
    const none = off.render();
    assert.deepEqual([none.extraPadding, none.indicator], [0, undefined]);
    assert.equal(off.listening('keyboardDidHide'), 0, 'and no keyboard listener');
  }
  const android = hook({ os: 'android' });
  android.render();
  assert.equal(android.listening('keyboardDidHide'), 0);
});

test('25OPS1: the indicator inset is asserted again after a keyboard hides and on every mount', () => {
  const app = hook();
  const root = app.mount();
  const first = root.render();
  assert.equal(app.listening('keyboardDidHide'), 1);
  assert.equal(root.render().indicator!.bottom, first.indicator!.bottom, 'a plain re-render changes nothing');
  assert.equal(app.listening('keyboardDidHide'), 1, 'one listener, not one per render');
  // React Native's keyboard handling leaves the native indicator inset at 0 on a scroller that adjusts for the keyboard
  // (the prop did not change, so it is never handed over again): the next value differs, so it is.
  app.emit('keyboardDidHide');
  const second = root.render();
  assert.notEqual(second.indicator!.bottom, first.indicator!.bottom, 'a new value: React Native hands it to the native view');
  assert.equal(second.extraPadding, first.extraPadding, 'the layout never moves');
  assert.ok(Math.abs(second.indicator!.bottom - first.indicator!.bottom) < 0.25, 'by a sub-pixel step');
  // A second scroller (another root, or the same root mounted again on a recycled native view) never repeats the value.
  const other = app.mount();
  const fresh = other.render();
  assert.notEqual(fresh.indicator!.bottom, second.indicator!.bottom);
  assert.notEqual(fresh.indicator!.bottom, first.indicator!.bottom);
  assert.equal(fresh.extraPadding, first.extraPadding);
  assert.equal(app.listening('keyboardDidHide'), 2);
  root.unmount();
  other.unmount();
  assert.equal(app.listening('keyboardDidHide'), 0, 'the listener goes with the root');
});

test('25OPS1: the indicator step is pure, sub-pixel and never repeats between consecutive assertions', () => {
  for (let assertion = 0; assertion < 3 * DOCK_INDICATOR_STEPS; assertion++) {
    const value = dockIndicatorInset(88, assertion);
    assert.ok(value > 88 && value <= 88.25);
    assert.notEqual(value, dockIndicatorInset(88, assertion + 1));
  }
  assert.equal(dockIndicatorInset(78, 0), 78 + 1 / (4 * DOCK_INDICATOR_STEPS));
});

test('25OPS1: the four tab-root scrollers take the one shared clearance, as padding, and pass no contentInset', () => {
  const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const roots: [string, RegExp][] = [
    ['app/(tabs)/index.tsx', /paddingBottom: 48 \+ dock\.extraPadding/],
    ['app/(tabs)/reports.tsx', /paddingBottom: 48 \+ dock\.extraPadding/],
    ['src/ui/entry-list.tsx', /paddingBottom: 40 \+ dock\.extraPadding/],
    ['src/ui/components.tsx', /paddingBottom: styles\.content\.paddingBottom \+ dock\.extraPadding/],
  ];
  for (const [path, padding] of roots) {
    const code = read(path);
    assert.match(code, /const dock = useDockInset\(\);/, path + ': the shared hook, called once');
    assert.match(code, padding, path + ': the clearance on top of the scroller\'s own bottom padding');
    assert.match(code, /scrollIndicatorInsets=\{dock\.indicator\}/, path + ': the indicator ends above the dock');
    assert.doesNotMatch(code, /contentInset=/, path + ': no native content inset (it did not hold on the iPhone)');
    assert.doesNotMatch(code, /dockClearance|useDockClearance|tabBarBottomGap/, path + ': no geometry of its own');
  }
  // Nothing else in the app reads the clearance: a pushed screen cannot inherit the dock's padding by accident.
  const source = read('src/ui/dock-clearance.ts');
  assert.match(source, /BottomTabBarHeightContext/, 'a scene of the tab navigator is what has a clearance');
  assert.match(source, /inTabs \? dockClearance\(insets\.bottom\) : 0/);
  assert.doesNotMatch(source, /contentInset\b(?!`)/, 'the hook hands out no content inset');
});
