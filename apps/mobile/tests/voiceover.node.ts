import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Producto 23.1C2: what VoiceOver hears, checked in the source of app/ and
// src/ui/. Static, like the guard in i18n.node.ts; rendered labels are
// asserted per screen in the route tests. Three rules:
//
// (a) A VoiceOver string never carries a number in the region's visible
//     format. An accessibilityLabel/Hint/Value expression, an
//     announceForAccessibility argument and a spoken twin (spokenValue,
//     spokenDetail, spokenCaption, spokenLabel, spokenDescribe) are not built
//     with moneyText, formatAmount, formatMoneyAmount, codedAmount, formatPercent, formatCount,
//     formatNumericDate, formatDateTime, formatDayMonth or rowAmountText,
//     directly or through a helper or value written in the scanned source.
//     The expressions are parsed with the TypeScript compiler and followed
//     through what they name (the checker resolves each identifier to its
//     declaration; an import from another scanned module resolves to its
//     export). A helper is followed per call with its parameters bound to what
//     that call passes, so `balanceLabel(account, value, spokenNumber)` is
//     clean while `balanceLabel(account, value)` (formatAmount by default) is
//     not; `budget.spoken` and `const { fraction } = spendingShare(…)` read only
//     that member of the object literal the memo, the function or the helper
//     returns. A wrapper that shows such a value (DetailRow's value, a card's
//     detail, a shortcut's caption, a button's label, the account sheet's
//     option line) must also receive its spoken twin.
// (b) Every raw react-native element VoiceOver focuses (a Pressable, a
//     TextInput, a Switch, a View marked accessible, and a Text or an
//     ActivityIndicator outside an accessible container) passes
//     accessibilityLanguage, speechLanguage from useI18n(): React Native has
//     no inherited language, and UIKit reads an element without one in the
//     device's language.
// (c) The wrappers in components.tsx (AppText, PressFeedback, Money, Field,
//     AmountField, Choice, ErrorMessage, SelectionRow) do that themselves and
//     are the only raw focusable elements there; the ones that forward props
//     let a caller's explicit language (an autonym) win.
//
// The analysis is syntactic and local on purpose: a value that reaches a
// label through React state, context or a module outside app/ and src/ui/ is
// not followed, and a helper is followed through its return statements only.
// Text VoiceOver reads exactly as shown (a caption, an alert, the typed
// amount) is a documented limitation (docs/i18n.md), not a label, and is not
// checked here. Each rule is first run on a small synthetic module, so a
// scanner that silently stopped finding anything fails too.

const mobile = fileURLToPath(new URL('../', import.meta.url));
const OPTIONS: ts.CompilerOptions = { noLib: true, noResolve: true, noEmit: true, types: [], jsx: ts.JsxEmit.Preserve, allowImportingTsExtensions: true };
const sources = ['app', 'src/ui'].flatMap(folder => (readdirSync(join(mobile, folder), { recursive: true }) as string[])
  .filter(name => /\.tsx?$/.test(name) && !name.endsWith('.d.ts')).map(name => join(mobile, folder, name))).sort();
const repository = ts.createProgram(sources, OPTIONS);

/** A program over in-memory modules, for the synthetic checks. */
function memoryProgram(modules: Record<string, string>): ts.Program {
  const base = ts.createCompilerHost(OPTIONS);
  const parsed = new Map(Object.entries(modules).map(([name, text]) => [name, ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)]));
  return ts.createProgram(Object.keys(modules), OPTIONS, { ...base, getSourceFile: name => parsed.get(name), fileExists: name => parsed.has(name), readFile: name => modules[name] });
}

/** The visible formatters: the region's separators and grouping, for the screen only. */
const VISIBLE = new Set(['moneyText', 'formatAmount', 'formatMoneyAmount', 'codedAmount', 'formatPercent', 'formatCount', 'formatNumericDate', 'formatDateTime', 'formatDayMonth', 'rowAmountText']);
/** Attributes VoiceOver reads, and the spoken twins the wrappers turn into labels. */
const SPOKEN = new Set(['accessibilityLabel', 'accessibilityHint', 'accessibilityValue', 'spokenValue', 'spokenDetail', 'spokenCaption', 'spokenLabel', 'spokenDescribe']);
/** A wrapper's visible prop that becomes (part of) its VoiceOver label, and the twin read instead. */
const TWINS: Record<string, [visible: string, spoken: string][]> = {
  DetailRow: [['value', 'spokenValue']],
  SelectorCard: [['detail', 'spokenDetail']],
  AccountField: [['detail', 'spokenDetail'], ['describe', 'spokenDescribe']],
  CategoryField: [['detail', 'spokenDetail']],
  SelectionRow: [['detail', 'spokenDetail']],
  AmountShortcut: [['caption', 'spokenCaption']],
  ActionButton: [['label', 'spokenLabel']],
};
/** Wrapper props with no spoken twin that the wrapper itself writes into its accessibilityLabel (components.tsx,
 * form-controls.tsx): a visible format passed there reaches VoiceOver as surely as one written in the label.
 * Not followed: an array element inside a `.map` callback (the Región sample in CheckRow subtitles is read as
 * shown on purpose, docs/i18n.md §10). */
const LABEL_PROPS: Record<string, string[]> = {
  SectionTitle: ['action'], IconButton: ['label'], Field: ['label'], AmountField: ['label'], AmountShortcut: ['label'],
  InfoButton: ['title', 'label'], DetailRow: ['label'], NavigationRow: ['title', 'subtitle'], CheckRow: ['title', 'subtitle'],
  SelectorCard: ['label', 'value', 'placeholder'], SelectionRow: ['label', 'value'], AccountField: ['label'], CategoryField: ['label'],
};
/** The wrappers in components.tsx that own a raw focusable element and give it speechLanguage. */
const WRAPPERS = ['AppText', 'PressFeedback', 'Field', 'AmountField', 'Choice', 'ErrorMessage', 'Money', 'SelectionRow'];
/** Of those, the ones that spread the caller's props and let an explicit accessibilityLanguage win. */
const FORWARDING = ['AppText', 'PressFeedback', 'Field', 'AmountField'];

type Env = ReadonlyMap<ts.Symbol, boolean>;
type Fn = ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration;
const NONE: Env = new Map();
const BOOLEAN_OPERATORS = new Set([ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken, ts.SyntaxKind.InstanceOfKeyword, ts.SyntaxKind.InKeyword]);
const skip = (node: ts.Expression): ts.Expression => ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)
  || ts.isSatisfiesExpression(node) || ts.isTypeAssertionExpression(node) ? skip(node.expression) : node;
const isFunction = (node: ts.Node): node is Fn => ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node);

/** React Native host components VoiceOver can focus, by the name a file imports them under (Reanimated's Animated.X included). */
type Host = 'Pressable' | 'TextInput' | 'Switch' | 'View' | 'Text' | 'ActivityIndicator';
const HOSTS: Record<string, Host> = { Pressable: 'Pressable', TouchableOpacity: 'Pressable', TouchableHighlight: 'Pressable', TouchableWithoutFeedback: 'Pressable',
  TextInput: 'TextInput', Switch: 'Switch', View: 'View', Text: 'Text', ActivityIndicator: 'ActivityIndicator' };
/** Components whose children are one VoiceOver element: a nested Text or glyph is read as part of it. */
const CONTAINERS = new Set(['PressFeedback', 'AppText']);

function voiceover(program: ts.Program, root: string) {
  const checker = program.getTypeChecker();
  const files = program.getRootFileNames().map(name => program.getSourceFile(name)!);
  const where = (node: ts.Node) => {
    const file = node.getSourceFile();
    return relative(root, file.fileName) + ':' + (file.getLineAndCharacterOfPosition(node.getStart()).line + 1);
  };
  const visitAll = (visit: (node: ts.Node) => void, only = files) => {
    const walk = (node: ts.Node): void => { visit(node); ts.forEachChild(node, walk); };
    for (const file of only) walk(file);
  };

  const symbolOf = (id: ts.Identifier) => ts.isShorthandPropertyAssignment(id.parent) && id.parent.name === id
    ? checker.getShorthandAssignmentValueSymbol(id.parent) : checker.getSymbolAtLocation(id);

  /** An import from another scanned module resolves to that module's export; anything else (React Native, the i18n core, the domain) is opaque. */
  function imported(specifier: ts.ImportSpecifier): ts.Declaration | undefined {
    const from = (specifier.parent.parent.parent.moduleSpecifier as ts.StringLiteral).text;
    if (!from.startsWith('.')) return undefined;
    const base = resolve(dirname(specifier.getSourceFile().fileName), from);
    const file = [base, base + '.tsx', base + '.ts'].map(candidate => program.getSourceFile(candidate)).find(Boolean);
    const name = (specifier.propertyName ?? specifier.name).text;
    for (const statement of file?.statements ?? []) {
      if (!ts.canHaveModifiers(statement) || !ts.getModifiers(statement)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
      if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) return statement;
      if (ts.isVariableStatement(statement)) {
        const found = statement.declarationList.declarations.find(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === name);
        if (found) return found;
      }
    }
    return undefined;
  }
  function declarationOf(id: ts.Identifier): ts.Declaration | undefined {
    const symbol = symbolOf(id);
    const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
    return declaration && ts.isImportSpecifier(declaration) ? imported(declaration) : declaration;
  }

  /** The function a callee names when its body is in the scanned source: a function declaration, a const arrow or function expression, a useCallback's function, an export of another scanned module. */
  function functionOf(callee: ts.Expression): Fn | undefined {
    const node = skip(callee);
    if (isFunction(node)) return node;
    const declaration = ts.isIdentifier(node) ? declarationOf(node) : undefined;
    if (declaration && ts.isFunctionDeclaration(declaration)) return declaration;
    if (!declaration || !ts.isVariableDeclaration(declaration) || !declaration.initializer) return undefined;
    const value = skip(declaration.initializer);
    if (isFunction(value)) return value;
    return ts.isCallExpression(value) && ts.isIdentifier(value.expression) && value.expression.text === 'useCallback' && value.arguments[0]
      ? functionOf(value.arguments[0]) : undefined;
  }

  /** A value that refers back to itself (through helpers) adds nothing new. */
  const active = new Set<ts.Node>();
  function guarded(node: ts.Node, evaluate: () => boolean): boolean {
    if (active.has(node)) return false;
    active.add(node);
    try { return evaluate(); } finally { active.delete(node); }
  }

  /** A helper's parameters bound to what one call passes; a missing argument takes its default. */
  function bind(fn: ts.SignatureDeclaration, args: readonly ts.Expression[], env: Env): Env {
    const next = new Map(env);
    fn.parameters.forEach((parameter, index) => {
      const value = parameter.dotDotDotToken ? args.slice(index).some(arg => taint(arg, env))
        : args[index] ? taint(args[index], env) : parameter.initializer ? taint(parameter.initializer, env) : false;
      const names = (name: ts.BindingName): void => {
        if (ts.isIdentifier(name)) { const symbol = checker.getSymbolAtLocation(name); if (symbol) next.set(symbol, value); }
        else for (const element of name.elements) if (!ts.isOmittedExpression(element)) names(element.name);
      };
      names(parameter.name);
    });
    return next;
  }

  /** The expressions a function returns: its expression body, or the return statements of its own block (not of a nested function). */
  function returned(fn: ts.SignatureDeclaration): (ts.Expression | undefined)[] {
    const body = (fn as ts.FunctionLikeDeclaration).body;
    if (!body) return [];
    if (!ts.isBlock(body)) return [body];
    const found: (ts.Expression | undefined)[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isFunctionLike(node)) return;
      if (ts.isReturnStatement(node)) found.push(node.expression);
      else ts.forEachChild(node, visit);
    };
    ts.forEachChild(body, visit);
    return found;
  }
  const returnTaint = (fn: ts.SignatureDeclaration, env: Env) => returned(fn).some(expression => !!expression && taint(expression, env));

  /** The object literals a value can only be, each with the bindings its members are read under: a literal, a conditional of literals,
   * `useMemo(() => ({ … }))`, an immediately invoked function, or a call of a scanned helper. Undefined when it can be anything else. */
  function literals(expression: ts.Expression, env: Env, depth = 0): { literal: ts.ObjectLiteralExpression; env: Env }[] | undefined {
    const node = skip(expression);
    if (depth > 8) return undefined;
    if (ts.isObjectLiteralExpression(node)) return [{ literal: node, env }];
    if (node.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(node) && node.text === 'undefined')) return [];
    if (ts.isConditionalExpression(node)) {
      const whenTrue = literals(node.whenTrue, env, depth + 1), whenFalse = literals(node.whenFalse, env, depth + 1);
      return whenTrue && whenFalse ? [...whenTrue, ...whenFalse] : undefined;
    }
    if (ts.isIdentifier(node)) {
      const declaration = declarationOf(node);
      return declaration && ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name) && declaration.initializer
        ? literals(declaration.initializer, env, depth + 1) : undefined;
    }
    if (!ts.isCallExpression(node)) return undefined;
    const memo = ts.isIdentifier(node.expression) && node.expression.text === 'useMemo' && node.arguments[0] ? skip(node.arguments[0]) : undefined;
    const fn = memo && isFunction(memo) ? memo : functionOf(node.expression);
    if (!fn) return undefined;
    const inner = memo ? env : bind(fn, node.arguments, env);
    const found: { literal: ts.ObjectLiteralExpression; env: Env }[] = [];
    for (const value of returned(fn)) {
      const some = value ? literals(value, inner, depth + 1) : [];
      if (!some) return undefined;
      found.push(...some);
    }
    return found;
  }

  function propertyTaint(property: ts.ObjectLiteralElementLike, env: Env): boolean {
    if (ts.isPropertyAssignment(property)) return taint(property.initializer, env);
    if (ts.isShorthandPropertyAssignment(property)) return identifierTaint(property.name, env);
    if (ts.isSpreadAssignment(property)) return taint(property.expression, env);
    return ts.isMethodDeclaration(property) && returnTaint(property, env);
  }

  /** `object.name`: that member alone when the object is a known literal, the whole object otherwise. */
  function memberTaint(object: ts.Expression, name: string, env: Env): boolean {
    if (VISIBLE.has(name)) return true;
    const known = literals(object, env);
    if (!known) return taint(object, env);
    return known.some(({ literal, env: inner }) => {
      const own = literal.properties.find(property => property.name && ts.isIdentifier(property.name) && property.name.text === name);
      return own ? propertyTaint(own, inner) : literal.properties.some(property => ts.isSpreadAssignment(property) && taint(property.expression, inner));
    });
  }

  function declarationTaint(declaration: ts.Declaration, env: Env): boolean {
    if (ts.isBindingElement(declaration)) {
      const key = declaration.propertyName ?? declaration.name;
      const pattern = declaration.parent;
      // `const { moneyText: money } = useI18n()`, `const { fraction, label } = spendingShare(…)`: that member of the value.
      if (ts.isIdentifier(key) && !declaration.dotDotDotToken && ts.isObjectBindingPattern(pattern) && ts.isVariableDeclaration(pattern.parent) && pattern.parent.initializer) {
        const initializer = pattern.parent.initializer;
        return guarded(declaration, () => memberTaint(initializer, key.text, env) || (!!declaration.initializer && taint(declaration.initializer, env)));
      }
      let owner: ts.Node = declaration;
      while (ts.isBindingElement(owner) || ts.isObjectBindingPattern(owner) || ts.isArrayBindingPattern(owner)) owner = owner.parent;
      if (ts.isVariableDeclaration(owner) && owner.initializer) { const initializer = owner.initializer; return guarded(owner, () => taint(initializer, env)); }
      return !!declaration.initializer && taint(declaration.initializer, env);
    }
    if (ts.isParameter(declaration)) return !!declaration.initializer && taint(declaration.initializer, env);
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) { const initializer = declaration.initializer; return guarded(declaration, () => taint(initializer, env)); }
    if (ts.isFunctionDeclaration(declaration)) return guarded(declaration, () => returnTaint(declaration, bind(declaration, [], env)));
    return false;
  }

  function identifierTaint(id: ts.Identifier, env: Env): boolean {
    if (VISIBLE.has(id.text)) return true;
    const symbol = symbolOf(id);
    if (symbol && env.has(symbol)) return env.get(symbol)!;
    const declaration = declarationOf(id);
    return !!declaration && declarationTaint(declaration, env);
  }

  function callTaint(call: ts.CallExpression, env: Env): boolean {
    const fn = functionOf(call.expression);
    if (fn) return guarded(fn, () => returnTaint(fn, bind(fn, call.arguments, env)));
    // A method (`.join`, `.toLowerCase`) or a function from outside the scanned source (`t`, `spokenMoney`, `Math.round`):
    // its result carries whatever its receiver and its arguments carry.
    return taint(call.expression, env) || call.arguments.some(arg => taint(arg, env));
  }

  /** Whether a value can carry text written by a visible formatter. */
  function taint(node: ts.Node, env: Env): boolean {
    if (ts.isIdentifier(node)) return identifierTaint(node, env);
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)
      || ts.isTypeAssertionExpression(node) || ts.isAwaitExpression(node) || ts.isSpreadElement(node)) return taint(node.expression, env);
    if (ts.isPropertyAccessExpression(node)) return memberTaint(node.expression, node.name.text, env);
    if (ts.isCallExpression(node)) return callTaint(node, env);
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return returnTaint(node, bind(node, [], env));
    if (ts.isConditionalExpression(node)) return taint(node.whenTrue, env) || taint(node.whenFalse, env);
    if (ts.isBinaryExpression(node)) return !BOOLEAN_OPERATORS.has(node.operatorToken.kind) && (taint(node.left, env) || taint(node.right, env));
    if (ts.isPrefixUnaryExpression(node)) return node.operator !== ts.SyntaxKind.ExclamationToken && taint(node.operand, env);
    if (ts.isObjectLiteralExpression(node)) return node.properties.some(property => propertyTaint(property, env));
    if (ts.isTypeOfExpression(node) || ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node) || ts.isTypeNode(node)) return false;
    let found = false;
    ts.forEachChild(node, child => { if (!found) found = taint(child, env); });
    return found;
  }

  const attributesOf = (element: ts.JsxOpeningLikeElement) =>
    new Map(element.attributes.properties.filter(ts.isJsxAttribute).map(attribute => [attribute.name.getText(), attribute]));
  const expressionOf = (attribute: ts.JsxAttribute | undefined) =>
    attribute?.initializer && ts.isJsxExpression(attribute.initializer) ? attribute.initializer.expression : undefined;
  /** `accessible`, `accessible={true}` or any expression: possibly on. Only `accessible={false}` is off. */
  const on = (attribute: ts.JsxAttribute | undefined) => !!attribute && expressionOf(attribute)?.kind !== ts.SyntaxKind.FalseKeyword;

  /** (a) Every VoiceOver string built with a visible formatter, and every wrapper shown such a value without its spoken twin. */
  function leaks(): string[] {
    const found: string[] = [];
    const report = (node: ts.Node, what: string) => found.push(where(node) + ' ' + what);
    visitAll(node => {
      if (ts.isJsxAttribute(node) && SPOKEN.has(node.name.getText())) {
        const expression = expressionOf(node);
        if (expression && taint(expression, NONE)) report(node, node.name.getText());
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text.startsWith('announceForAccessibility')
        && node.arguments[0] && taint(node.arguments[0], NONE)) report(node, node.expression.name.text);
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName) && Object.hasOwn(TWINS, node.tagName.text)) {
        const attributes = attributesOf(node);
        for (const [visible, spoken] of TWINS[node.tagName.text]) {
          const expression = expressionOf(attributes.get(visible));
          if (expression && taint(expression, NONE) && !attributes.has(spoken)) report(node, `<${node.tagName.text} ${visible}> without ${spoken}`);
        }
      }
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName) && Object.hasOwn(LABEL_PROPS, node.tagName.text)) {
        const attributes = attributesOf(node);
        for (const prop of LABEL_PROPS[node.tagName.text]) {
          const expression = expressionOf(attributes.get(prop));
          if (expression && taint(expression, NONE)) report(node, `<${node.tagName.text} ${prop}> reaches VoiceOver`);
        }
      }
    });
    return found;
  }

  /** (b) Raw focusable elements, with the function that renders them. */
  function focusable(only = files) {
    const found: { node: ts.JsxOpeningLikeElement; host: Host; tag: string; owner: string; language: ts.JsxAttribute | undefined }[] = [];
    for (const file of only) {
      const hosts = new Map<string, Host>();
      for (const statement of file.statements) {
        if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
        const from = (statement.moduleSpecifier as ts.StringLiteral).text;
        const clause = statement.importClause;
        if (from === 'react-native-reanimated' && clause.name) for (const name of ['View', 'Text']) hosts.set(clause.name.text + '.' + name, HOSTS[name]);
        if (from !== 'react-native' || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) continue;
        for (const specifier of clause.namedBindings.elements) {
          const name = (specifier.propertyName ?? specifier.name).text;
          if (Object.hasOwn(HOSTS, name) && !specifier.isTypeOnly) hosts.set(specifier.name.text, HOSTS[name]);
          if (name === 'Animated') for (const inner of ['View', 'Text']) hosts.set(specifier.name.text + '.' + inner, HOSTS[inner]);
        }
      }
      /** Whether VoiceOver treats the element as one element of its own: a View only when marked accessible, the rest unless `accessible={false}`. */
      const accessible = (element: ts.JsxOpeningLikeElement, host: Host | undefined) => {
        const attribute = attributesOf(element).get('accessible');
        return host === 'View' || !host ? on(attribute) : !attribute || on(attribute);
      };
      /** An element inside an accessible ancestor is read as part of it (a Text in a PressFeedback, a glyph in a Text); one under accessibilityElementsHidden is not read at all. */
      const enclosed = (node: ts.JsxOpeningLikeElement) => {
        for (let parent = node.parent; parent; parent = parent.parent) {
          // A JSX value passed as a prop (a PressFeedback's `backdrop`) is rendered inside that element too.
          const element = ts.isJsxElement(parent) ? parent.openingElement : ts.isJsxOpeningElement(parent) || ts.isJsxSelfClosingElement(parent) ? parent : undefined;
          if (!element || element === node) continue;
          const tag = element.tagName.getText();
          if (on(attributesOf(element).get('accessibilityElementsHidden')) || CONTAINERS.has(tag) || accessible(element, hosts.get(tag))) return true;
        }
        return false;
      };
      /** The innermost named function (a component or a const helper) that renders the element. */
      const ownerOf = (node: ts.Node) => {
        for (let parent = node.parent; parent; parent = parent.parent) {
          if (ts.isFunctionDeclaration(parent) && parent.name) return parent.name.text;
          if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name) && parent.initializer && isFunction(skip(parent.initializer))) return parent.name.text;
        }
        return '(module)';
      };
      visitAll(node => {
        if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return;
        const tag = node.tagName.getText(), host = hosts.get(tag);
        const attributes = attributesOf(node);
        if (!host || !accessible(node, host) || on(attributes.get('accessibilityElementsHidden')) || enclosed(node)) return;
        found.push({ node, host, tag, owner: ownerOf(node), language: attributes.get('accessibilityLanguage') });
      }, [file]);
    }
    return found;
  }
  const unvoiced = (only = files) => focusable(only).filter(item => !item.language).map(item => where(item.node) + ' <' + item.tag + '> in ' + item.owner);

  /** (c) Whether an expression reads `speechLanguage` destructured from useI18n(). */
  function readsSpeechLanguage(expression: ts.Expression): boolean {
    let found = false;
    const visit = (node: ts.Node): void => {
      if (found) return;
      if (ts.isIdentifier(node) && node.text === 'speechLanguage') {
        const declaration = declarationOf(node);
        const owner = declaration && ts.isBindingElement(declaration) ? declaration.parent.parent : undefined;
        const value = owner && ts.isVariableDeclaration(owner) && owner.initializer ? skip(owner.initializer) : undefined;
        found = !!value && ts.isCallExpression(value) && ts.isIdentifier(value.expression) && value.expression.text === 'useI18n';
      }
      ts.forEachChild(node, visit);
    };
    visit(expression);
    return found;
  }

  return { files, where, focusable, unvoiced, leaks, readsSpeechLanguage, expressionOf, attributesOf };
}

/** The findings a synthetic module declares on its own lines (a `// leak: …` comment, or a `silent: …` JSX comment), as the scanner reports them. */
function marked(modules: Record<string, string>, root: string, marker: 'leak' | 'silent'): string[] {
  return Object.entries(modules).flatMap(([name, text]) => text.split('\n').flatMap((line, index) => {
    const match = line.match(marker === 'leak' ? /\/\/ leak: (.+)$/ : /\{\/\* silent: (.+?) \*\/\}/);
    return match ? [relative(root, name) + ':' + (index + 1) + ' ' + match[1]] : [];
  }));
}

test('(a) the scanner follows helpers per call, memo and helper results per member, renamed formatters and imports (synthetic module)', () => {
  const modules = {
    '/probe/share.ts': `
      export function share(amount: number, total: number, locale: string) {
        if (total <= 0) return { fraction: 0, label: '—' };
        const fraction = amount / total;
        return { fraction, label: formatPercent(fraction, locale) };
      }
      export const spokenShare = (fraction: number, percent: (value: number) => string) => percent(fraction);`,
    '/probe/screen.tsx': `
      import { AccessibilityInfo } from 'react-native';
      import { useI18n } from '../i18n/provider';
      import { share, spokenShare } from './share';
      export function Probe({ minor, total }: { minor: number; total: number }) {
        const i18n = useI18n();
        const { moneyText: money, spokenMoney, spokenPercent, formatAmount, locale } = i18n;
        const withDefault = (amount: (minor: number) => string = formatAmount) => 'saldo ' + amount(minor);
        const twoFormatters = (amount: (minor: number) => string, fallback = formatAmount) => amount(minor) + fallback(0);
        const memo = useMemo(() => minor ? { text: money(minor, 'ARS'), spoken: spokenMoney(minor, 'ARS') } : null, [minor]);
        const iife = (() => ({ text: withDefault(), spoken: withDefault(value => spokenMoney(value, 'ARS')) }))();
        const { fraction, label } = share(minor, total, locale);
        AccessibilityInfo.announceForAccessibility?.(withDefault(value => spokenMoney(value, 'ARS')));
        AccessibilityInfo.announceForAccessibility?.(i18n.formatCount(total)); // leak: announceForAccessibility
        return [
          <A accessibilityLabel={memo?.spoken} />,
          <A accessibilityLabel={memo?.text} />, // leak: accessibilityLabel
          <A accessibilityLabel={iife.spoken} />,
          <A accessibilityLabel={iife.text} />, // leak: accessibilityLabel
          <A accessibilityLabel={withDefault(value => spokenMoney(value, 'USD'))} />,
          <A accessibilityLabel={withDefault()} />, // leak: accessibilityLabel
          <A accessibilityLabel={twoFormatters(value => spokenMoney(value, 'USD'))} />, // leak: accessibilityLabel
          <A accessibilityHint={[minor, money(minor, 'ARS')].join(', ')} />, // leak: accessibilityHint
          <A accessibilityLabel={spokenPercent(fraction) + (money(minor, 'ARS') === '' ? ' vacío' : '')} />,
          <A accessibilityValue={{ text: label }} />, // leak: accessibilityValue
          <A accessibilityLabel={spokenShare(fraction, spokenPercent)} />,
          <DetailRow label="Saldo" value={money(minor, 'ARS')} />, // leak: <DetailRow value> without spokenValue
          <DetailRow label="Saldo" value={money(minor, 'ARS')} spokenValue={spokenMoney(minor, 'ARS')} />,
          <ActionButton label={'Guardar' + withDefault()} />, // leak: <ActionButton label> without spokenLabel
          <NavigationRow title="Copia" subtitle={money(minor, 'ARS')} />, // leak: <NavigationRow subtitle> reaches VoiceOver
          <NavigationRow title="Copia" subtitle={spokenMoney(minor, 'ARS')} />,
        ];
      }`,
  };
  const expected = marked(modules, '/probe', 'leak');
  assert.equal(expected.length, 10);
  assert.deepEqual(voiceover(memoryProgram(modules), '/probe').leaks(), expected);
});

test('(a) no VoiceOver string in app/ or src/ui/ is built with a visible formatter, and every wrapper showing one gets its spoken twin', () => {
  const scan = voiceover(repository, mobile);
  assert.ok(scan.files.length > 70, 'app/ and src/ui/ are scanned');
  for (const name of ['app/(tabs)/reports.tsx', 'app/entry/[id].tsx', 'src/ui/components.tsx', 'src/ui/transfer-form.tsx']) {
    assert.ok(scan.files.some(file => relative(mobile, file.fileName) === name), name);
  }
  assert.deepEqual(scan.leaks(), []);
});

test('(b) the scanner finds raw focusable elements and skips what VoiceOver reads as part of another element (synthetic module)', () => {
  const modules = {
    '/probe/rows.tsx': `
      import { ActivityIndicator, Pressable, Switch, Text, TextInput as Input, View } from 'react-native';
      import Animated from 'react-native-reanimated';
      export function Rows() {
        const { speechLanguage } = useI18n();
        const row = <View accessible accessibilityLabel="fila"><Text>dentro</Text></View>; {/* silent: <View> in Rows */}
        return <View>
          {row}
          <Pressable onPress={() => {}}><Text>botón</Text></Pressable> {/* silent: <Pressable> in Rows */}
          <Pressable onPress={() => {}} accessibilityLanguage={speechLanguage} />
          <Input value="" /> {/* silent: <Input> in Rows */}
          <Switch value accessibilityLanguage={speechLanguage} />
          <View accessible={false}><Text accessibilityLanguage={speechLanguage}>suelto</Text></View>
          <Text>sin idioma</Text> {/* silent: <Text> in Rows */}
          <Animated.View accessible accessibilityLabel="animada" /> {/* silent: <Animated.View> in Rows */}
          <View accessibilityElementsHidden><Text>oculto</Text><Pressable /></View>
          <PressFeedback backdrop={<View><Text>fondo</Text></View>}><Text>dentro</Text><ActivityIndicator /></PressFeedback>
          <ActivityIndicator /> {/* silent: <ActivityIndicator> in Rows */}
          <Text accessible={false}>decorado</Text>
        </View>;
      }`,
  };
  const probe = voiceover(memoryProgram(modules), '/probe');
  const expected = marked(modules, '/probe', 'silent');
  assert.equal(expected.length, 6);
  assert.deepEqual(probe.unvoiced(), expected);
  assert.equal(probe.focusable().filter(item => item.language).length, 3, 'the Pressable, the Switch and the loose Text carry a language');
});

test('(b) every raw focusable element outside components.tsx passes accessibilityLanguage', () => {
  const scan = voiceover(repository, mobile);
  const outside = scan.files.filter(file => relative(mobile, file.fileName) !== 'src/ui/components.tsx');
  const elements = scan.focusable(outside);
  // The rule has something to hold: today's raw focusable elements (assistant bubbles, the composer, charts, the card face, the Switch, the boot indicator…).
  assert.ok(elements.length >= 12, 'raw focusable elements found: ' + elements.length);
  assert.deepEqual(scan.unvoiced(outside), []);
});

test('(c) the wrappers in components.tsx are its only raw focusable elements, read speechLanguage, and let an explicit language win', () => {
  const scan = voiceover(repository, mobile);
  const components = scan.files.filter(file => relative(mobile, file.fileName) === 'src/ui/components.tsx');
  const elements = scan.focusable(components);
  // A new raw focusable element in components.tsx is a new wrapper: it joins WRAPPERS knowingly.
  assert.equal([...new Set(elements.map(item => item.owner))].sort().join(','), [...WRAPPERS].sort().join(','));
  for (const item of elements) {
    const name = scan.where(item.node) + ' <' + item.tag + '> in ' + item.owner;
    const expression = scan.expressionOf(item.language);
    assert.ok(expression && scan.readsSpeechLanguage(expression), name + ' reads speechLanguage from useI18n()');
    // AppText, PressFeedback and the two fields spread the caller's props: an explicit language (an autonym) wins over the interface one.
    if (FORWARDING.includes(item.owner)) assert.equal(expression.getText(), 'props.accessibilityLanguage ?? speechLanguage', name);
    else assert.equal(expression.getText(), 'speechLanguage', name);
  }
  // CheckRow gives a language option its own language ("English" in an English voice); PressFeedback falls back to speechLanguage without one.
  const checkRow = components[0].statements.find((statement): statement is ts.FunctionDeclaration => ts.isFunctionDeclaration(statement) && statement.name?.text === 'CheckRow')!;
  let forwarded: string | undefined;
  const visit = (node: ts.Node): void => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText() === 'PressFeedback') forwarded = scan.expressionOf(scan.attributesOf(node).get('accessibilityLanguage'))?.getText();
    ts.forEachChild(node, visit);
  };
  visit(checkRow);
  assert.equal(forwarded, 'accessibilityLanguage');
});
