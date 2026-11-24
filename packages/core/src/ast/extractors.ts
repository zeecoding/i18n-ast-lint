import ts from "typescript";
import type { ExtractedKey, ScanOptions } from "../types.js";
import type { ScopeTracker } from "./scope.js";

export interface ResolvedScannerOptions {
  namespaceSeparator: ":" | ".";
  keySeparator: string;
  defaultNamespace?: string;
}

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
  return key.replace(/[:.]$/, keySeparator);
}

export function extractFromCallExpression(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
  filePath: string,
  scope: ScopeTracker,
  options: ResolvedScannerOptions
): ExtractedKey | undefined {
  const calleeMatch = matchTranslationCall(node.expression, scope);
  if (!calleeMatch) return undefined;

  if (calleeMatch.kind === "formatMessage") {
    return extractFromFormatMessageCall(node, sourceFile, filePath, options);
  }

  const firstArg = node.arguments[0];
  if (!firstArg) return undefined;

  const explicitNs = extractNsFromSecondArg(node.arguments[1]);
  const pos = sourceFile.getLineAndCharacterOfPosition(firstArg.getStart(sourceFile));
  const line = pos.line + 1;
  const column = pos.character + 1;

  if (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg)) {
    const rawKey = firstArg.text;
    if (!rawKey) return undefined;
    const key = resolveKeyWithNamespace(
      rawKey,
      calleeMatch.namespace,
      explicitNs,
      false,
      options
    );
    return {
      key,
      rawKey,
      isDynamicPrefix: false,
      filePath,
      line,
      column,
    };
  }

  if (ts.isTemplateExpression(firstArg)) {
    const headText = firstArg.head.text;
    if (!headText && !calleeMatch.namespace && !explicitNs) {
      return undefined;
    }
    const resolvedPrefix = resolveKeyWithNamespace(
      headText,
      calleeMatch.namespace,
      explicitNs,
      true,
      options
    );
    if (!resolvedPrefix) return undefined;
    return {
      key: resolvedPrefix,
      rawKey: headText,
      isDynamicPrefix: true,
      filePath,
      line,
      column,
    };
  }

  return undefined;
}

interface CalleeMatch {
  kind: "t" | "formatMessage";
  namespace?: string;
}

function matchTranslationCall(
  expr: ts.Expression,
  scope: ScopeTracker
): CalleeMatch | undefined {
  if (ts.isIdentifier(expr)) {
    const bound = scope.lookup(expr.text);
    if (bound) {
      if (bound.kind === "t") {
        return { kind: "t", namespace: bound.namespace };
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
    if (methodName === "t") {
      if (ts.isIdentifier(expr.expression)) {
        const objName = expr.expression.text;
        const bound = scope.lookup(objName);
        if (bound?.kind === "t") {
          return { kind: "t", namespace: bound.namespace };
        }
        if (objName === "i18n" || objName === "i18next") {
          return { kind: "t" };
        }
      }
      return { kind: "t" };
    }

    if (methodName === "formatMessage") {
      return { kind: "formatMessage" };
    }
  }

  return undefined;
}

function extractNsFromSecondArg(arg: ts.Expression | undefined): string | undefined {
  if (!arg || !ts.isObjectLiteralExpression(arg)) return undefined;
  for (const prop of arg.properties) {
    if (
      ts.isPropertyAssignment(prop) &&
      (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) &&
      prop.name.text === "ns" &&
      (ts.isStringLiteral(prop.initializer) ||
        ts.isNoSubstitutionTemplateLiteral(prop.initializer))
    ) {
      return prop.initializer.text.trim() || undefined;
    }
  }
  return undefined;
}

function extractFromFormatMessageCall(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
  filePath: string,
  options: ResolvedScannerOptions
): ExtractedKey | undefined {
  const firstArg = node.arguments[0];
  if (!firstArg || !ts.isObjectLiteralExpression(firstArg)) return undefined;

  for (const prop of firstArg.properties) {
    if (
      ts.isPropertyAssignment(prop) &&
      (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) &&
      prop.name.text === "id"
    ) {
      const init = prop.initializer;
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

  for (const prop of node.attributes.properties) {
    if (!ts.isJsxAttribute(prop) || !ts.isIdentifier(prop.name)) continue;
    const attrName = prop.name.text;
    if (attrName === keyAttrName) {
      keyInitializer = prop.initializer;
    } else if (attrName === "ns" && prop.initializer) {
      const nsLiteral = unwrapJsxAttributeString(prop.initializer);
      if (nsLiteral && !nsLiteral.isDynamic) {
        explicitNs = nsLiteral.text;
      }
    }
  }

  if (!keyInitializer) return undefined;

  const extracted = unwrapJsxAttributeString(keyInitializer);
  if (!extracted || !extracted.text) return undefined;

  const pos = sourceFile.getLineAndCharacterOfPosition(extracted.node.getStart(sourceFile));
  const line = pos.line + 1;
  const column = pos.character + 1;

  // Notice: For <Trans>, explicit `ns="legal"` or inline `ns:key` takes precedence.
  // Do NOT implicitly prepend scope namespace onto <Trans i18nKey="auth.terms"> unless `ns` is omitted AND `i18nKey` doesn't already start with the active namespace.
  const activeScopeNs = tagName === "Trans" ? scope.getActiveNamespace() : undefined;
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
  initializer: ts.JsxAttributeValue
): { text: string; isDynamic: boolean; node: ts.Node } | undefined {
  if (ts.isStringLiteral(initializer)) {
    return { text: initializer.text, isDynamic: false, node: initializer };
  }
  if (ts.isJsxExpression(initializer) && initializer.expression) {
    const expr = initializer.expression;
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
      return { text: expr.text, isDynamic: false, node: expr };
    }
    if (ts.isTemplateExpression(expr)) {
      return { text: expr.head.text, isDynamic: true, node: expr };
    }
  }
  return undefined;
}
