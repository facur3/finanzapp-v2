import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';

// Babel is used through the same package Metro uses; no type package is added for a test.
const { transformSync } = createRequire(import.meta.url)('@babel/core') as { transformSync: (code: string, options: object) => { code: string } | null };

// The worklet boundary, checked with the real toolchain: every audited file
// goes through babel-preset-expo exactly as Metro compiles it for iOS
// (react-native-worklets/plugin included), and the emitted worklets are read
// back. A function that a UI-runtime callback captures must itself be a
// worklet, or the UI runtime holds a remote reference and throws "Tried to
// synchronously call a Remote Function" on the device, which is what the
// first Producto 22 device run did with composerBottomPadding. This proves the
// plugin output, not the iOS runtime itself: the iPhone still has the final word.
const root = resolve(new URL('..', import.meta.url).pathname);
const UI_HOOKS = /useAnimatedStyle|useAnimatedProps|useDerivedValue|useAnimatedScrollHandler|useAnimatedReaction|runOnUI|scheduleOnUI|Gesture\./;

function compile(file: string): string {
  const source = readFileSync(join(root, file), 'utf8');
  return transformSync(source, { filename: join(root, file), babelrc: false, configFile: false,
    presets: [['babel-preset-expo', { jsxRuntime: 'automatic' }]], caller: { name: 'metro', platform: 'ios', bundler: 'metro', isDev: true } })!.code!;
}
const compiled = new Map<string, string>();
const output = (file: string) => { if (!compiled.has(file)) compiled.set(file, compile(file)); return compiled.get(file)!; };

/** Names the plugin turned into worklets in that file (`function name_fileTs1(...)` inside the init data). */
function worklets(file: string): Set<string> {
  return new Set([...output(file).matchAll(/_worklet_\d+_init_data=\{code:"function ([A-Za-z0-9_$]+?)_[a-zA-Z0-9]+\(/g)].map(match => match[1]));
}
/** Top-level functions defined in a source file, by name. */
function definedFunctions(file: string): Set<string> {
  const source = readFileSync(join(root, file), 'utf8');
  return new Set([...source.matchAll(/^(?:export )?(?:function ([A-Za-z0-9_$]+)\s*\(|const ([A-Za-z0-9_$]+)\s*=\s*(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>)/gm)].map(match => match[1] ?? match[2]));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap(name => {
    const path = join(dir, name);
    if (statSync(join(root, path)).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** For each worklet factory call in a compiled file: the captured names and what each one is bound to. */
function captures(file: string): { worklet: string; bindings: Record<string, string> }[] {
  const code = output(file);
  const found: { worklet: string; bindings: Record<string, string> }[] = [];
  for (const match of code.matchAll(/function ([A-Za-z0-9_$]+)Factory\(_ref\d*\)\{[\s\S]*?\}\(\{([^}]*)\}\)/g)) {
    const bindings: Record<string, string> = {};
    for (const entry of match[2].split(',')) {
      const [name, expression] = entry.split(':').map(part => part.trim());
      if (name && !name.startsWith('_worklet_')) bindings[name] = expression ?? name;
    }
    found.push({ worklet: match[1], bindings });
  }
  return found;
}

function requiredModules(file: string): Record<string, string> {
  const code = output(file);
  const modules: Record<string, string> = {};
  for (const match of code.matchAll(/var (_[A-Za-z0-9_$]+)=(?:_interopRequire(?:Wildcard|Default)\()?require\("([^"]+)"\)\)?/g)) modules[match[1]] = match[2];
  return modules;
}

function resolveRelative(from: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = relative(root, resolve(join(root, dirname(from)), specifier));
  for (const candidate of [base + '.ts', base + '.tsx']) { try { statSync(join(root, candidate)); return candidate; } catch { /* next */ } }
  return null;
}

test('composerBottomPadding is compiled as a worklet and the composer\'s animated style captures that worklet', () => {
  assert.ok(worklets('src/ui/material-policy.ts').has('composerBottomPadding'), 'the padding helper carries the worklet directive');
  const composer = captures('src/ui/assistant-composer.tsx');
  const style = composer.find(item => 'composerBottomPadding' in item.bindings);
  assert.ok(style, 'the animated style captures the helper by name');
  assert.equal(style!.bindings.composerBottomPadding, '_materialPolicy.composerBottomPadding');
  assert.equal(requiredModules('src/ui/assistant-composer.tsx')._materialPolicy, './material-policy');
  const source = readFileSync(join(root, 'src/ui/material-policy.ts'), 'utf8');
  assert.match(source, /export function composerBottomPadding\([^)]*\): number \{\n  'worklet';/, 'the directive is the first statement of the body');
});

test('every function a UI-runtime callback captures is a worklet, in every animated file, as Metro compiles it for iOS', () => {
  const files = [...sourceFiles('src/ui'), ...sourceFiles('app')].filter(file => UI_HOOKS.test(readFileSync(join(root, file), 'utf8')));
  assert.ok(files.includes('src/ui/assistant-composer.tsx') && files.includes('src/ui/charts.tsx') && files.includes('src/ui/card-visual.tsx'));
  const problems: string[] = [];
  for (const file of files) {
    const modules = requiredModules(file);
    const local = worklets(file);
    const localFunctions = definedFunctions(file);
    for (const { worklet, bindings } of captures(file)) {
      for (const [name, expression] of Object.entries(bindings)) {
        const imported = expression.match(/^(_[A-Za-z0-9_$]+)\.([A-Za-z0-9_$]+)$/);
        if (imported) {
          const target = resolveRelative(file, modules[imported[1]] ?? '');
          if (!target) continue; // react-native-reanimated, react-native and other packages ship their own worklets.
          if (definedFunctions(target).has(imported[2]) && !worklets(target).has(imported[2])) problems.push(`${file}: ${worklet} captures ${imported[2]} from ${target}, which is not a worklet`);
        } else if (localFunctions.has(name) && !local.has(name)) {
          problems.push(`${file}: ${worklet} captures local function ${name}, which is not a worklet`);
        }
      }
    }
  }
  assert.deepEqual(problems, []);
});
