import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

/** Loads a real app module (path relative to apps/mobile, e.g. 'src/ui/commitment-actions.ts') inside a route
 * harness, resolving its imports through that harness's own `require` (its mock map), so the module's handler
 * logic runs for real while its hosts stay descriptors. `Error` is shared with the host realm so a module's
 * `cause instanceof Error` recognises errors thrown by host-side mocks (see the harness notes). */
export function realModule(path: string, require: (name: string) => unknown): Record<string, any> {
  const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} as Record<string, any> };
  runInNewContext(code, { module, exports: module.exports, require, Error, Date });
  return module.exports;
}

/** The descriptor twin of `src/ui/swipe-actions.tsx`: `SwipeRow` is found by type and carries its `actions`;
 * `swipeAccessibility` is the real mapping (actions → VoiceOver custom actions). */
export const swipeActionsMock = {
  SwipeRow: 'SwipeRow',
  swipeAccessibility: (actions: { key: string; label: string; onPress: () => void }[]) => ({
    accessibilityActions: actions.map(action => ({ name: action.key, label: action.label })),
    onAccessibilityAction: (event: { nativeEvent: { actionName: string } }) => actions.find(action => action.key === event.nativeEvent.actionName)?.onPress(),
  }),
};
