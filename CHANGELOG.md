# Changelog

## 0.1.0 (2026-11-24)

### Features
- **TypeScript Compiler AST Engine (`@locale-lint/core`):** Environment-isolated AST scanner (`ts.createSourceFile`) with zero `node:*` imports.
- **Multi-Framework Hook & Component Resolution:**
  - `react-i18next` / `i18next`: `useTranslation('ns', { keyPrefix })`, aliased `{ t: tAuth }`, array destructuring `[t]`, `<Trans i18nKey="..." ns="...">`, colon namespace overrides (`common:save`), plural suffixes (`_zero`, `_one`, `_two`, `_few`, `_many`, `_other`), and `context` variants (`t('friend', { context: 'male' })`).
  - `next-intl`: `useTranslations('Namespace')`, `getTranslations({ locale, namespace })`, and member helpers `t.rich()`, `t.markup()`, `t.raw()`, and `t.has()`.
  - `react-intl` (`FormatJS`): `<FormattedMessage id="...">`, `intl.formatMessage({ id })`, and `defineMessages({...})` / `defineMessage({...})`.
- **Advanced Static Expression Resolution:** Resolves lexical string constants (`const k = 'menu.home'; t(k)`), frozen constant objects (`KEYS.HOME`), ternary expressions (`t(cond ? 'a' : 'b')`), logical fallbacks (`t(a || 'b')`), fallback key arrays (`t(['a', 'b'])`), and dynamic template literal prefixes (``t(`errors.${code}`)``).
- **Unresolved Dynamic Call Safety Guard (`UNRESOLVED_KEY`):** Protects bound hook namespaces automatically when an opaque variable is passed to `t(dynamicVar)`, and blocks unscoped `i18n-ast-lint fix` from pruning unless `--force` is specified.
- **Cross-Locale Interpolation Validator:** Detects placeholder mismatches across `{{var}}` (i18next) and `{var}` / `{count, plural, ...}` (ICU) syntax.
- **Format-Preserving JSON Pruner (`jsonc-parser`):** Surgically removes unused keys and empty parent objects while preserving exact indentation, sibling key order, and keys containing literal dots.
- **CLI & Self-Contained SDK (`i18n-ast-lint`):** Zero-config directory discovery (flat and namespaced `public/locales/<locale>/<ns>.json`), `--ci`, `--json`, `--dry-run`, `--force`, and inlined dual ESM/CJS TypeScript declarations verified by `publint` and `@arethetypeswrong/cli`.
