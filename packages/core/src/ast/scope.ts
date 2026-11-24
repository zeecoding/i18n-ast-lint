import ts from "typescript";

export type TranslationFnKind = "t" | "formatMessage" | "intlObject";

export interface ScopeBinding {
  kind: TranslationFnKind;
  namespace?: string;
}

/**
 * Tracks lexical scopes for translation hooks:
 * - react-i18next: `const { t } = useTranslation('auth')`, `const { t: tCommon } = useTranslation(['common'])`, `const [t] = useTranslation('auth')`
 * - next-intl: `const t = useTranslations('Dashboard.Header')`, `const t = await getTranslations('Dashboard.Header')`
 * - react-intl: `const intl = useIntl()`, `const { formatMessage } = useIntl()`
 */
export class ScopeTracker {
  private readonly stack: Array<Map<string, ScopeBinding>> = [new Map()];

  public pushScope(): void {
    this.stack.push(new Map());
  }

  public popScope(): void {
    if (this.stack.length > 1) {
      this.stack.pop();
    }
  }

  public bind(identifier: string, binding: ScopeBinding): void {
    const current = this.stack[this.stack.length - 1];
    if (current) {
      current.set(identifier, binding);
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

  /**
   * Returns the most recently bound default namespace in the current or enclosing scope (e.g., for `<Trans>` components inside a component that called `useTranslation('auth')`).
   */
  public getActiveNamespace(): string | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const scope = this.stack[i];
      if (!scope) continue;
      const tBinding = scope.get("t");
      if (tBinding?.namespace) {
        return tBinding.namespace;
      }
      for (const binding of scope.values()) {
        if (binding.namespace) {
          return binding.namespace;
        }
      }
    }
    return undefined;
  }

  public inspectVariableDeclaration(node: ts.VariableDeclaration): void {
    if (!node.initializer) return;

    const callExpr = unwrapCallExpression(node.initializer);
    if (!callExpr) return;

    const hookName = getCalleeHookName(callExpr.expression);
    if (!hookName) return;

    if (hookName === "useTranslation") {
      const ns = extractFirstNamespaceArg(callExpr.arguments[0]);
      if (ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          const propName = element.propertyName
            ? getPropertyNameText(element.propertyName)
            : ts.isIdentifier(element.name)
              ? element.name.text
              : undefined;
          if (propName === "t" && ts.isIdentifier(element.name)) {
            this.bind(element.name.text, { kind: "t", namespace: ns });
          }
        }
      } else if (ts.isArrayBindingPattern(node.name)) {
        const firstElem = node.name.elements[0];
        if (firstElem && ts.isBindingElement(firstElem) && ts.isIdentifier(firstElem.name)) {
          this.bind(firstElem.name.text, { kind: "t", namespace: ns });
        }
      } else if (ts.isIdentifier(node.name)) {
        this.bind(node.name.text, { kind: "t", namespace: ns });
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
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
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
    if (first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) {
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
