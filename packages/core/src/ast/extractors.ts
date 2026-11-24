import ts from "typescript";
import type { ExtractedKey, ScanOptions } from "../types.js";
import { combineNsAndKeyPrefix, type ScopeTracker } from "./scope.js";

export interface ResolvedScannerOptions {
  namespaceSeparator: ":" | ".";
  keySeparator: string;
  defaultNamespace?: string;
}

const NEXT_INTL_MEMBER_METHODS = new Set(["rich", "markup", "raw", "has"]);
const KNOWN_TRANSLATION_RECEIVERS = new Set([
  "i18n",
  "i18next",
  "props",
  "ctx",
  "context",
]);

export function normalizeScannerOptions(options?: ScanOptions): ResolvedScannerOptions {
  return {
    namespaceSeparator: options?.namespaceSeparator ?? ":",
    keySeparator: options?.keySeparator ?? ".",
    defaultNamespace: options?.defaultNamespace,
  };
}

/**
 * Resolves a raw key or prefix together with an explicit or scope-bound namespace.
 */
export function resolveKeyWithNamespace(
  rawKey: string,
  hookNamespace: string | undefined,
  explicitNamespace: string | undefined,
  isDynamicPrefix: boolean,
  options: ResolvedScannerOptions
): string {
  const { namespaceSeparator, keySeparator, defaultNamespace } = options;

  // Check if rawKey contains an explicit namespace override like "common:save"
  if (namespaceSeparator === ":" && rawKey.includes(":")) {
    const colonIdx = rawKey.indexOf(":");
    const inlineNs = rawKey.slice(0, colonIdx).trim();
    const restKey = rawKey.slice(colonIdx + 1);
    if (inlineNs.length > 0) {
      return joinNamespaceAndKey(inlineNs, restKey, keySeparator, isDynamicPrefix);
    }
  }

  const effectiveNs = explicitNamespace ?? hookNamespace ?? defaultNamespace;
  if (effectiveNs && effectiveNs.length > 0) {
    return joinNamespaceAndKey(effectiveNs, rawKey, keySeparator, isDynamicPrefix);
  }

  return normalizeDynamicTail(rawKey, keySeparator, isDynamicPrefix);
}

function joinNamespaceAndKey(
  namespace: string,
  key: string,
  keySeparator: string,
  isDynamicPrefix: boolean
): string {
  const cleanNs = namespace.endsWith(keySeparator)
    ? namespace.slice(0, -keySeparator.length)
    : namespace;
  const cleanKey = key.startsWith(keySeparator) ? key.slice(keySeparator.length) : key;
  const combined = cleanKey.length > 0 ? `${cleanNs}${keySeparator}${cleanKey}` : cleanNs;
  return normalizeDynamicTail(combined, keySeparator, isDynamicPrefix);
}

function normalizeDynamicTail(
  key: string,
  keySeparator: string,
  isDynamicPrefix: boolean
): string {
  if (!isDynamicPrefix) return key;
  const replaced = key.replace(/[:.]$/, keySeparator);
  return replaced.endsWith(keySeparator) ? replaced : `${replaced}${keySeparator}`;
}

/**
 * Extracts zero, one, or multiple translation keys from a `CallExpression`.
 * Supports:
 * - `t('key')`, `i18n.t('key')`, `props.t('key')`
 * - `next-intl` `t.rich('key')`, `t.markup('key')`, `t.raw('key')`, `t.has('key')`
 * - `react-intl` `intl.formatMessage({ id: 'key' })`, `defineMessages({ a: { id: 'key' } })`, `defineMessage({ id: 'key' })`
 * - Constants (`const k = 'menu.home'; t(k)`), Ternaries (`t(c ? 'a' : 'b')`), Fallback arrays (`t(['a', 'b'])`)
 * - i18next `context` option (`t('friend', { context: 'male' })` -> `'friend'` and `'friend_male'`)
 * - Unresolved dynamic arguments (`t(unknownVar)`) -> emits `isUnresolved: true` (and namespace prefix protection if scoped)
 */
export function extractFromCallExpression(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
  filePath: string,
  scope: ScopeTracker,
  options: ResolvedScannerOptions
): ExtractedKey[] {
  const calleeMatch = matchTranslationCall(node.expression, scope);
  if (!calleeMatch) return [];

  if (calleeMatch.kind === "defineMessages") {
    return extractFromDefineMessagesCall(node, sourceFile, filePath, options);
  }

  if (calleeMatch.kind === "formatMessage") {
    return extractFromFormatMessageCall(node, sourceFile, filePath, scope, options);
  }

  const firstArg = node.arguments[0];
  if (!firstArg) return [];

  const secondArgInfo = inspectSecondArgOptions(node.arguments[1], scope);
  const explicitNs = secondArgInfo.ns
    ? combineNsAndKeyPrefix(
        secondArgInfo.ns,
        calleeMatch.keyPrefix,
        options.keySeparator
      )
    : undefined;

  const resolvedCandidates = resolveKeyArgumentCandidates(firstArg, scope);

  if (resolvedCandidates.length === 0) {
    // Unresolved dynamic argument like `t(unknownDynamicArg)`
    const pos = sourceFile.getLineAndCharacterOfPosition(firstArg.getStart(sourceFile));
    const line = pos.line + 1;
    const column = pos.character + 1;
    const rawExprText = firstArg.getText(sourceFile);
    const activeNs = explicitNs ?? calleeMatch.namespace ?? options.defaultNamespace;
    const results: ExtractedKey[] = [
      {
        key: activeNs ? `${activeNs}${options.keySeparator}` : rawExprText,
        rawKey: rawExprText,
        isDynamicPrefix: Boolean(activeNs),
        isUnresolved: true,
        filePath,
        line,
        column,
      },
    ];
    return results;
  }

  const results: ExtractedKey[] = [];

  for (const candidate of resolvedCandidates) {
    const pos = sourceFile.getLineAndCharacterOfPosition(
      candidate.node.getStart(sourceFile)
    );
    const line = pos.line + 1;
    const column = pos.character + 1;

    const resolvedKey = resolveKeyWithNamespace(
      candidate.rawKey,
      calleeMatch.namespace,
      explicitNs,
      candidate.isDynamicPrefix,
      options
    );

    if (!resolvedKey) continue;

    const contextValue =
      !candidate.isDynamicPrefix && secondArgInfo.context
        ? secondArgInfo.context.isDynamic
          ? "*"
          : secondArgInfo.context.value
        : undefined;

    results.push({
      key: resolvedKey,
      rawKey: candidate.rawKey,
      isDynamicPrefix: candidate.isDynamicPrefix,
      ...(contextValue ? { context: contextValue } : {}),
      filePath,
      line,
      column,
    });
  }

  return results;
}

interface CandidateKeyNode {
  rawKey: string;
  isDynamicPrefix: boolean;
  node: ts.Node;
}

function resolveKeyArgumentCandidates(
  expr: ts.Expression,
  scope: ScopeTracker
): CandidateKeyNode[] {
  const unwrapped = unwrapExpression(expr);

  if (
    ts.isStringLiteral(unwrapped) ||
    ts.isNoSubstitutionTemplateLiteral(unwrapped)
  ) {
    if (!unwrapped.text) return [];
    return [{ rawKey: unwrapped.text, isDynamicPrefix: false, node: unwrapped }];
  }

  if (ts.isTemplateExpression(unwrapped)) {
    return [
      {
        rawKey: unwrapped.head.text,
        isDynamicPrefix: true,
        node: unwrapped,
      },
    ];
  }

  // Identifier lookup in lexical constants (`const k = 'menu.home'; t(k)`)
  if (ts.isIdentifier(unwrapped)) {
    const constVal = scope.lookupConstant(unwrapped.text);
    if (constVal !== undefined) {
      return [{ rawKey: constVal, isDynamicPrefix: false, node: unwrapped }];
    }
    return [];
  }

  // Property access lookup in lexical object constants (`const KEYS = { HOME: 'menu.home' }; t(KEYS.HOME)`)
  if (ts.isPropertyAccessExpression(unwrapped)) {
    const flatPath = flattenPropertyAccessPath(unwrapped);
    if (flatPath) {
      const constVal = scope.lookupConstant(flatPath);
      if (constVal !== undefined) {
        return [{ rawKey: constVal, isDynamicPrefix: false, node: unwrapped }];
      }
    }
    return [];
  }

  // Ternary expression (`t(isAdmin ? 'role.admin' : 'role.user')`)
  if (ts.isConditionalExpression(unwrapped)) {
    const left = resolveKeyArgumentCandidates(unwrapped.whenTrue, scope);
    const right = resolveKeyArgumentCandidates(unwrapped.whenFalse, scope);
    return [...left, ...right];
  }

  // Logical fallback expression (`t(customKey || 'default.key')` or `t(customKey ?? 'default.key')`)
  if (
    ts.isBinaryExpression(unwrapped) &&
    (unwrapped.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      unwrapped.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
  ) {
    const left = resolveKeyArgumentCandidates(unwrapped.left, scope);
    const right = resolveKeyArgumentCandidates(unwrapped.right, scope);
    return [...left, ...right];
  }

  // Fallback array (`t(['err.specific', 'err.generic'])`)
  if (ts.isArrayLiteralExpression(unwrapped)) {
    const items: CandidateKeyNode[] = [];
    for (const el of unwrapped.elements) {
      if (ts.isSpreadElement(el)) continue;
      items.push(...resolveKeyArgumentCandidates(el, scope));
    }
    return items;
  }

  return [];
}

function unwrapExpression(expr: ts.Expression): ts.Expression {
  let current = expr;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function flattenPropertyAccessPath(expr: ts.Expression): string | undefined {
  if (ts.isIdentifier(expr)) {
    return expr.text;
  }
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name)) {
    const prefix = flattenPropertyAccessPath(expr.expression);
    return prefix ? `${prefix}.${expr.name.text}` : undefined;
  }
  return undefined;
}

interface CalleeMatch {
  kind: "t" | "formatMessage" | "defineMessages";
  namespace?: string;
  keyPrefix?: string;
}

function matchTranslationCall(
  expr: ts.Expression,
  scope: ScopeTracker
): CalleeMatch | undefined {
  if (ts.isIdentifier(expr)) {
    if (expr.text === "defineMessages" || expr.text === "defineMessage") {
      return { kind: "defineMessages" };
    }
    const bound = scope.lookup(expr.text);
    if (bound) {
      if (bound.kind === "t") {
        return {
          kind: "t",
          namespace: bound.namespace,
          keyPrefix: bound.keyPrefix,
        };
      }
      if (bound.kind === "formatMessage") {
        return { kind: "formatMessage" };
      }
    }
    if (expr.text === "t") {
      return { kind: "t" };
    }
    if (expr.text === "formatMessage") {
      return { kind: "formatMessage" };
    }
    return undefined;
  }

  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name)) {
    const methodName = expr.name.text;

    if (methodName === "defineMessages" || methodName === "defineMessage") {
      return { kind: "defineMessages" };
    }

    // 1. next-intl member helpers: `t.rich('key')`, `t.markup('key')`, `t.raw('key')`, `t.has('key')`
    if (
      NEXT_INTL_MEMBER_METHODS.has(methodName) &&
      ts.isIdentifier(expr.expression)
    ) {
      const objName = expr.expression.text;
      const bound = scope.lookup(objName);
      if (bound?.kind === "t") {
        return {
          kind: "t",
          namespace: bound.namespace,
          keyPrefix: bound.keyPrefix,
        };
      }
      if (objName === "t") {
        return { kind: "t" };
      }
      return undefined;
    }

    // 2. `.t(...)` calls: ONLY match scope-tracked objects or known i18n receivers (`i18n`, `i18next`, `props`, `this.props`, `ctx`, `context`)
    // Never match unrelated library objects like `gsap.t(...)`
    if (methodName === "t") {
      if (ts.isIdentifier(expr.expression)) {
        const objName = expr.expression.text;
        const bound = scope.lookup(objName);
        if (bound?.kind === "t") {
          return {
            kind: "t",
            namespace: bound.namespace,
            keyPrefix: bound.keyPrefix,
          };
        }
        if (KNOWN_TRANSLATION_RECEIVERS.has(objName)) {
          return { kind: "t" };
        }
        return undefined;
      }

      if (
        ts.isPropertyAccessExpression(expr.expression) &&
        expr.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
        ts.isIdentifier(expr.expression.name) &&
        KNOWN_TRANSLATION_RECEIVERS.has(expr.expression.name.text)
      ) {
        return { kind: "t" };
      }

      return undefined;
    }

    if (methodName === "formatMessage") {
      return { kind: "formatMessage" };
    }
  }

  return undefined;
}

interface SecondArgOptions {
  ns?: string;
  context?: {
    value?: string;
    isDynamic: boolean;
  };
}

function inspectSecondArgOptions(
  arg: ts.Expression | undefined,
  scope: ScopeTracker
): SecondArgOptions {
  if (!arg || !ts.isObjectLiteralExpression(arg)) return {};
  const result: SecondArgOptions = {};

  for (const prop of arg.properties) {
    if (
      !ts.isPropertyAssignment(prop) ||
      (!ts.isIdentifier(prop.name) && !ts.isStringLiteral(prop.name))
    ) {
      continue;
    }

    const name = prop.name.text;
    const init = unwrapExpression(prop.initializer);

    if (name === "ns") {
      if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
        result.ns = init.text.trim() || undefined;
      } else if (ts.isIdentifier(init)) {
        result.ns = scope.lookupConstant(init.text);
      }
    } else if (name === "context") {
      if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
        result.context = { value: init.text.trim(), isDynamic: false };
      } else if (ts.isIdentifier(init)) {
        const constVal = scope.lookupConstant(init.text);
        if (constVal !== undefined) {
          result.context = { value: constVal, isDynamic: false };
        } else {
          result.context = { isDynamic: true };
        }
      } else {
        result.context = { isDynamic: true };
      }
    }
  }

  return result;
}

function extractFromFormatMessageCall(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
  filePath: string,
  scope: ScopeTracker,
  options: ResolvedScannerOptions
): ExtractedKey[] {
  const firstArg = node.arguments[0];
  if (!firstArg) return [];

  if (ts.isObjectLiteralExpression(firstArg)) {
    const descriptorKey = extractDescriptorObjectId(
      firstArg,
      sourceFile,
      filePath,
      scope,
      options
    );
    return descriptorKey ? [descriptorKey] : [];
  }

  return [];
}

function extractFromDefineMessagesCall(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
  filePath: string,
  options: ResolvedScannerOptions
): ExtractedKey[] {
  const firstArg = node.arguments[0];
  if (!firstArg) return [];
  const unwrapped = unwrapExpression(firstArg);
  if (!ts.isObjectLiteralExpression(unwrapped)) return [];

  // Supports both `defineMessage({ id: 'page.title' })` and `defineMessages({ title: { id: 'page.title' } })`
  const direct = extractDescriptorObjectId(
    unwrapped,
    sourceFile,
    filePath,
    undefined,
    options
  );
  if (direct) {
    return [direct];
  }

  const results: ExtractedKey[] = [];
  for (const prop of unwrapped.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const inner = unwrapExpression(prop.initializer);
    if (ts.isObjectLiteralExpression(inner)) {
      const hit = extractDescriptorObjectId(
        inner,
        sourceFile,
        filePath,
        undefined,
        options
      );
      if (hit) {
        results.push(hit);
      }
    }
  }
  return results;
}

function extractDescriptorObjectId(
  obj: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile,
  filePath: string,
  scope: ScopeTracker | undefined,
  options: ResolvedScannerOptions
): ExtractedKey | undefined {
  for (const prop of obj.properties) {
    if (
      ts.isPropertyAssignment(prop) &&
      (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) &&
      prop.name.text === "id"
    ) {
      const init = unwrapExpression(prop.initializer);
      const pos = sourceFile.getLineAndCharacterOfPosition(init.getStart(sourceFile));
      const line = pos.line + 1;
      const column = pos.character + 1;

      if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
        const rawKey = init.text;
        if (!rawKey) return undefined;
        return {
          key: resolveKeyWithNamespace(rawKey, undefined, undefined, false, options),
          rawKey,
          isDynamicPrefix: false,
          filePath,
          line,
          column,
        };
      }

      if (ts.isIdentifier(init) && scope) {
        const constVal = scope.lookupConstant(init.text);
        if (constVal) {
          return {
            key: resolveKeyWithNamespace(constVal, undefined, undefined, false, options),
            rawKey: constVal,
            isDynamicPrefix: false,
            filePath,
            line,
            column,
          };
        }
      }

      if (ts.isTemplateExpression(init) && init.head.text) {
        const rawKey = init.head.text;
        return {
          key: resolveKeyWithNamespace(rawKey, undefined, undefined, true, options),
          rawKey,
          isDynamicPrefix: true,
          filePath,
          line,
          column,
        };
      }
    }
  }
  return undefined;
}

export function extractFromJsxElement(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  filePath: string,
  scope: ScopeTracker,
  options: ResolvedScannerOptions
): ExtractedKey | undefined {
  const tagName = getJsxTagName(node.tagName);
  if (tagName !== "Trans" && tagName !== "FormattedMessage") {
    return undefined;
  }

  const keyAttrName = tagName === "Trans" ? "i18nKey" : "id";
  let keyInitializer: ts.JsxAttributeValue | undefined;
  let explicitNs: string | undefined;
  let tPropNamespace: string | undefined;

  for (const prop of node.attributes.properties) {
    if (!ts.isJsxAttribute(prop) || !ts.isIdentifier(prop.name)) continue;
    const attrName = prop.name.text;
    if (attrName === keyAttrName) {
      keyInitializer = prop.initializer;
    } else if (attrName === "ns" && prop.initializer) {
      const nsLiteral = unwrapJsxAttributeString(prop.initializer, scope);
      if (nsLiteral && !nsLiteral.isDynamic) {
        explicitNs = nsLiteral.text;
      }
    } else if (
      attrName === "t" &&
      prop.initializer &&
      ts.isJsxExpression(prop.initializer) &&
      prop.initializer.expression &&
      ts.isIdentifier(prop.initializer.expression)
    ) {
      const boundT = scope.lookup(prop.initializer.expression.text);
      if (boundT?.namespace) {
        tPropNamespace = boundT.namespace;
      }
    }
  }

  if (!keyInitializer) return undefined;

  const extracted = unwrapJsxAttributeString(keyInitializer, scope);
  if (!extracted || !extracted.text) return undefined;

  const pos = sourceFile.getLineAndCharacterOfPosition(extracted.node.getStart(sourceFile));
  const line = pos.line + 1;
  const column = pos.character + 1;

  // Notice: If `<Trans i18nKey="welcome" />` is a single segment without dots or colons and no explicit `ns`,
  // only prepend scope namespace if `t={t}` was explicitly passed AND `t` had a namespace, or if `ns` was explicitly passed.
  const activeScopeNs = tPropNamespace;
  const shouldUseScopeNs =
    !explicitNs &&
    activeScopeNs !== undefined &&
    !extracted.text.includes(options.namespaceSeparator) &&
    !extracted.text.startsWith(`${activeScopeNs}${options.keySeparator}`);

  const resolvedKey = resolveKeyWithNamespace(
    extracted.text,
    shouldUseScopeNs ? activeScopeNs : undefined,
    explicitNs,
    extracted.isDynamic,
    options
  );

  return {
    key: resolvedKey,
    rawKey: extracted.text,
    isDynamicPrefix: extracted.isDynamic,
    filePath,
    line,
    column,
  };
}

function getJsxTagName(tagName: ts.JsxTagNameExpression): string | undefined {
  if (ts.isIdentifier(tagName)) {
    return tagName.text;
  }
  if (ts.isPropertyAccessExpression(tagName) && ts.isIdentifier(tagName.name)) {
    return tagName.name.text;
  }
  return undefined;
}

function unwrapJsxAttributeString(
  initializer: ts.JsxAttributeValue,
  scope: ScopeTracker
): { text: string; isDynamic: boolean; node: ts.Node } | undefined {
  if (ts.isStringLiteral(initializer)) {
    return { text: initializer.text, isDynamic: false, node: initializer };
  }
  if (ts.isJsxExpression(initializer) && initializer.expression) {
    const expr = unwrapExpression(initializer.expression);
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
      return { text: expr.text, isDynamic: false, node: expr };
    }
    if (ts.isIdentifier(expr)) {
      const constVal = scope.lookupConstant(expr.text);
      if (constVal) {
        return { text: constVal, isDynamic: false, node: expr };
      }
    }
    if (ts.isTemplateExpression(expr)) {
      return { text: expr.head.text, isDynamic: true, node: expr };
    }
  }
  return undefined;
}
