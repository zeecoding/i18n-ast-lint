import ts from "typescript";

export type TranslationFnKind = "t" | "formatMessage" | "intlObject";

export interface ScopeBinding {
  kind: TranslationFnKind;
  namespace?: string;
  keyPrefix?: string;
}

/**
 * Tracks lexical scopes for:
 * 1. Translation hooks:
 *    - react-i18next: `const { t } = useTranslation('auth', { keyPrefix: 'form' })`, `const { t: tCommon } = useTranslation(['common'])`, `const [t] = useTranslation('auth')`
 *    - next-intl: `const t = useTranslations('Dashboard.Header')`, `const t = await getTranslations({ locale, namespace: 'About' })`
 *    - react-intl: `const intl = useIntl()`, `const { formatMessage } = useIntl()`
 * 2. Static string constants & frozen key maps:
 *    - `const k = 'menu.home'; t(k)`
 *    - `const KEYS = { HOME: 'menu.home' } as const; t(KEYS.HOME)`
 */
export class ScopeTracker {
  private readonly stack: Array<Map<string, ScopeBinding>> = [new Map()];
  private readonly constantStack: Array<Map<string, string>> = [new Map()];

  public pushScope(): void {
    this.stack.push(new Map());
    this.constantStack.push(new Map());
  }

  public popScope(): void {
    if (this.stack.length > 1) {
      this.stack.pop();
    }
    if (this.constantStack.length > 1) {
      this.constantStack.pop();
    }
  }

  public bind(identifier: string, binding: ScopeBinding): void {
    const current = this.stack[this.stack.length - 1];
    if (current) {
      current.set(identifier, binding);
    }
  }

  public bindConstant(key: string, value: string): void {
    const current = this.constantStack[this.constantStack.length - 1];
    if (current) {
      current.set(key, value);
    }
  }

  public lookup(identifier: string): ScopeBinding | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const scope = this.stack[i];
      if (scope && scope.has(identifier)) {
        return scope.get(identifier);
      }
    }
    return undefined;
  }

  public lookupConstant(key: string): string | undefined {
    for (let i = this.constantStack.length - 1; i >= 0; i--) {
      const scope = this.constantStack[i];
      if (scope && scope.has(key)) {
        return scope.get(key);
      }
    }
    return undefined;
  }

  /**
   * Returns the most recently bound default namespace in the current or enclosing scope
   * (e.g., for `<Trans>` components inside a component that called `useTranslation('auth')`).
   */
  public getActiveNamespace(): string | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const scope = this.stack[i];
      if (!scope) continue;
      const tBinding = scope.get("t");
      if (tBinding?.namespace) {
        return combineNsAndKeyPrefix(tBinding.namespace, tBinding.keyPrefix);
      }
      for (const binding of scope.values()) {
        if (binding.namespace || binding.keyPrefix) {
          return combineNsAndKeyPrefix(binding.namespace, binding.keyPrefix);
        }
      }
    }
    return undefined;
  }

  public inspectVariableDeclaration(node: ts.VariableDeclaration): void {
    if (!node.initializer) return;

    // 1. Track static string constants and object literal string maps (for `const k = 'menu.home'; t(k)`)
    const unwrappedInit = unwrapValueExpression(node.initializer);
    if (
      ts.isIdentifier(node.name) &&
      (ts.isStringLiteral(unwrappedInit) ||
        ts.isNoSubstitutionTemplateLiteral(unwrappedInit))
    ) {
      if (unwrappedInit.text) {
        this.bindConstant(node.name.text, unwrappedInit.text);
      }
      return;
    }

    if (
      ts.isIdentifier(node.name) &&
      ts.isObjectLiteralExpression(unwrappedInit)
    ) {
      this.recordObjectConstants(node.name.text, unwrappedInit);
    }

    // 2. Track translation hook calls
    const callExpr = unwrapCallExpression(node.initializer);
    if (!callExpr) return;

    const hookName = getCalleeHookName(callExpr.expression);
    if (!hookName) return;

    if (hookName === "useTranslation") {
      const ns = extractFirstNamespaceArg(callExpr.arguments[0]);
      const keyPrefix =
        extractKeyPrefixFromArg(callExpr.arguments[1]) ??
        extractKeyPrefixFromArg(callExpr.arguments[0]);
      const combinedNs = combineNsAndKeyPrefix(ns, keyPrefix);

      if (ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          const propName = element.propertyName
            ? getPropertyNameText(element.propertyName)
            : ts.isIdentifier(element.name)
              ? element.name.text
              : undefined;
          if (propName === "t" && ts.isIdentifier(element.name)) {
            this.bind(element.name.text, {
              kind: "t",
              namespace: combinedNs,
              keyPrefix,
            });
          }
        }
      } else if (ts.isArrayBindingPattern(node.name)) {
        const firstElem = node.name.elements[0];
        if (
          firstElem &&
          ts.isBindingElement(firstElem) &&
          ts.isIdentifier(firstElem.name)
        ) {
          this.bind(firstElem.name.text, {
            kind: "t",
            namespace: combinedNs,
            keyPrefix,
          });
        }
      } else if (ts.isIdentifier(node.name)) {
        this.bind(node.name.text, {
          kind: "t",
          namespace: combinedNs,
          keyPrefix,
        });
      }
    } else if (hookName === "useTranslations" || hookName === "getTranslations") {
      const ns = extractFirstNamespaceArg(callExpr.arguments[0]);
      if (ts.isIdentifier(node.name)) {
        this.bind(node.name.text, { kind: "t", namespace: ns });
      }
    } else if (hookName === "useIntl" || hookName === "createIntl") {
      if (ts.isIdentifier(node.name)) {
        this.bind(node.name.text, { kind: "intlObject" });
      } else if (ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          const propName = element.propertyName
            ? getPropertyNameText(element.propertyName)
            : ts.isIdentifier(element.name)
              ? element.name.text
              : undefined;
          if (propName === "formatMessage" && ts.isIdentifier(element.name)) {
            this.bind(element.name.text, { kind: "formatMessage" });
          }
        }
      }
    }
  }

  private recordObjectConstants(
    prefix: string,
    obj: ts.ObjectLiteralExpression
  ): void {
    for (const prop of obj.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const propName = getPropertyNameText(prop.name);
      if (!propName) continue;
      const val = unwrapValueExpression(prop.initializer);
      const fullPath = `${prefix}.${propName}`;
      if (ts.isStringLiteral(val) || ts.isNoSubstitutionTemplateLiteral(val)) {
        if (val.text) {
          this.bindConstant(fullPath, val.text);
        }
      } else if (ts.isObjectLiteralExpression(val)) {
        this.recordObjectConstants(fullPath, val);
      }
    }
  }
}

export function combineNsAndKeyPrefix(
  ns: string | undefined,
  keyPrefix: string | undefined,
  separator = "."
): string | undefined {
  if (ns && keyPrefix) {
    return `${ns}${separator}${keyPrefix}`;
  }
  return ns ?? keyPrefix;
}

function unwrapValueExpression(expr: ts.Expression): ts.Expression {
  let current: ts.Expression = expr;
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

function unwrapCallExpression(expr: ts.Expression): ts.CallExpression | undefined {
  let current: ts.Expression = expr;
  while (
    ts.isAwaitExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return ts.isCallExpression(current) ? current : undefined;
}

function getCalleeHookName(expr: ts.Expression): string | undefined {
  if (ts.isIdentifier(expr)) {
    return expr.text;
  }
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name)) {
    return expr.name.text;
  }
  return undefined;
}

function getPropertyNameText(name: ts.PropertyName): string | undefined {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }
  return undefined;
}

function extractFirstNamespaceArg(arg: ts.Expression | undefined): string | undefined {
  if (!arg) return undefined;
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
    return arg.text.trim() || undefined;
  }
  if (ts.isArrayLiteralExpression(arg) && arg.elements.length > 0) {
    const first = arg.elements[0];
    if (
      first &&
      (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))
    ) {
      return first.text.trim() || undefined;
    }
  }
  if (ts.isObjectLiteralExpression(arg)) {
    for (const prop of arg.properties) {
      if (
        ts.isPropertyAssignment(prop) &&
        getPropertyNameText(prop.name) === "namespace" &&
        (ts.isStringLiteral(prop.initializer) ||
          ts.isNoSubstitutionTemplateLiteral(prop.initializer))
      ) {
        return prop.initializer.text.trim() || undefined;
      }
    }
  }
  return undefined;
}

function extractKeyPrefixFromArg(arg: ts.Expression | undefined): string | undefined {
  if (!arg || !ts.isObjectLiteralExpression(arg)) return undefined;
  for (const prop of arg.properties) {
    if (
      ts.isPropertyAssignment(prop) &&
      getPropertyNameText(prop.name) === "keyPrefix" &&
      (ts.isStringLiteral(prop.initializer) ||
        ts.isNoSubstitutionTemplateLiteral(prop.initializer))
    ) {
      return prop.initializer.text.trim() || undefined;
    }
  }
  return undefined;
}
