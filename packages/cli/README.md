# `i18n-ast-lint`

[![npm version](https://img.shields.io/npm/v/i18n-ast-lint.svg)](https://www.npmjs.com/package/i18n-ast-lint)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Interactive Playground](https://img.shields.io/badge/Playground-Try%20in%20Browser-6366f1)](https://i18n-ast-lint.vercel.app)

**Fast, AST-powered, zero-config i18n linter and format-preserving dead-key pruner for TypeScript, React, and Next.js.**

`i18n-ast-lint` replaces legacy regex-based i18n linters (such as `i18n-unused`) with a true TypeScript Compiler AST engine (`ts.createSourceFile`) and surgical JSON editing (`jsonc-parser`). It eliminates false positives on scoped hooks and JSX components, catches missing translations and `{placeholder}` typos in CI, and prunes dead translation keys without reformatting your JSON files.

---

## Quickstart (30 Seconds)

Run directly in any React, Next.js, or TypeScript repository—zero config file required:

```bash
# 1. Scan source files & locales for unused keys, missing translations, and variable typos
npx i18n-ast-lint check

# 2. Run in CI mode (no ANSI colors, exits 1 on any error or warning)
npx i18n-ast-lint check --ci

# 3. Preview dead keys that would be removed without touching disk
npx i18n-ast-lint fix --dry-run

# 4. Surgically remove unused keys across all locale JSON files
npx i18n-ast-lint fix
```

---

## Why `i18n-ast-lint` vs. `i18n-unused`?

| Capability | `i18n-ast-lint` | `i18n-unused` (Regex) |
| :--- | :--- | :--- |
| **Parsing Engine** | **TypeScript Compiler AST** (`ts.createSourceFile`) | Regular Expressions |
| **Scoped Hooks (`useTranslation('auth')`)** | Resolves lexical scope & aliased `{ t: tAuth }` | False positives / missed namespaces |
| **`next-intl` (`useTranslations('Dashboard.Header')`)** | Native nested namespace resolution | Requires manual regex workarounds |
| **JSX Components (`<Trans>`, `<FormattedMessage>`)** | Multi-line JSX & expression attribute extraction | Fails on multi-line JSX (Issue #34) |
| **Dynamic Template Literals (``t(`errors.${code}`)``)** | Auto-protects `errors.*` prefix from deletion | Deletes live dynamic keys |
| **Plural Suffix Linking (`_one`, `_other`, `_zero`)** | Links `t('cart.items', { count })` to plural keys | Flags plural variants as unused |
| **Comments & URLs (`https://...`)** | AST ignores `//` and `/* */`; URLs never corrupt scan | Corrupts strings after `https://` (Issue #42) |
| **Interpolation Validation (`{var}` & `{{var}}`)** | Detects placeholder mismatches across locales | Not supported |
| **Format-Preserving `--fix`** | Surgical AST edits via `jsonc-parser` (preserves indentation, key order & literal-dot keys) | `JSON.stringify` rewrites entire file |
| **Native ESM (`"type": "module"`) & CI Exit Codes** | Dual ESM/CJS (`publint` & `attw` verified), exit codes `0`/`1`/`2` | Crashes on ESM configs (Issue #35) / exits `0` on failure (Issue #43) |

---

## Supported Frameworks & Syntax Examples

### 1. `react-i18next` / `i18next`
```tsx
import { useTranslation, Trans } from "react-i18next";

export function LoginCard({ errCode, count }: { errCode: string; count: number }) {
  const { t } = useTranslation("auth");
  const { t: tCommon } = useTranslation(["common", "fallback"]);

  return (
    <div>
      {/* Resolves to "auth.login" */}
      <h1>{t("login")}</h1>

      {/* Resolves to "common.save" */}
      <button>{tCommon("save")}</button>

      {/* Explicit namespace override -> resolves to "common.cancel" */}
      <button>{t("common:cancel")}</button>

      {/* Protects "cart.items_zero", "cart.items_one", "cart.items_other" */}
      <span>{t("cart:items", { count })}</span>

      {/* Multi-line JSX -> resolves to "auth.terms" */}
      <Trans i18nKey="auth.terms">
        Read our <a href="https://example.com/terms">Terms</a>
      </Trans>

      {/* Dynamic prefix protection -> protects all "auth.errors.*" keys */}
      <p>{t(`errors.${errCode}`)}</p>
    </div>
  );
}
```

### 2. `next-intl`
```tsx
import { useTranslations } from "next-intl";

export function DashboardHeader({ accountName }: { accountName: string }) {
  const t = useTranslations("Dashboard.Header");

  // Resolves to "Dashboard.Header.greeting" and validates {accountName} across locales
  return <h1>{t("greeting", { accountName })}</h1>;
}
```

### 3. `react-intl` (FormatJS)
```tsx
import { FormattedMessage, useIntl } from "react-intl";

export function ProfileBadge({ fullName }: { fullName: string }) {
  const intl = useIntl();
  const label = intl.formatMessage({ id: "profile.aria_label" }, { fullName });

  return (
    <div aria-label={label}>
      <FormattedMessage id="profile.headline" values={{ fullName }} />
    </div>
  );
}
```

---

## CLI Reference

### Commands

| Command | Description |
| :--- | :--- |
| `i18n-ast-lint check` | Scans source files and locale JSON files, outputting grouped diagnostics. |
| `i18n-ast-lint fix` | Surgically prunes `UNUSED_KEY` entries and empty parent objects from all locale files. |

### Flags

| Flag | Description |
| :--- | :--- |
| `--ci` | Disables ANSI colors and fails (exit code `1`) on both `error` and `warning` diagnostics. |
| `--json` | Outputs a machine-readable JSON report to `stdout` without banners or ANSI codes. |
| `--dry-run` | Used with `fix` to preview which keys and files would be pruned without writing to disk. |
| `--config <path>` | Path to config file (`i18n-ast-lint.config.json`, `.mjs`, or `.js`). |
| `--locales <dir>` | Override auto-detected locales directory (e.g., `public/locales`, `messages`, `locales`). |
| `--src <dirs>` | Comma-separated source directories to scan (e.g., `src,app`). |
| `--base <locale>` | Override base locale code (default: `"en"`). |

### Exit Codes

| Exit Code | Meaning |
| :--- | :--- |
| `0` | Success — zero error-level diagnostics found. |
| `1` | Diagnostics failure — unused keys, missing translations, or interpolation mismatches detected. |
| `2` | Fatal error — invalid config file, missing directory, or malformed JSON syntax in a locale file. |

---

## Configuration (Optional)

`i18n-ast-lint` auto-detects `locales/`, `public/locales/`, `messages/`, or `src/locales/` (including namespaced folders like `public/locales/en/auth.json`) and scans `src/`, `app/`, `pages/`, or `components/`.

To customize behavior, add an `i18n-ast-lint.config.json` (or `i18n-ast-lint.config.mjs`):

```json
{
  "baseLocale": "en",
  "localesDir": "public/locales",
  "srcDir": ["src", "app"],
  "namespaceSeparator": ":",
  "keySeparator": ".",
  "ignoreKeys": [
    "legacy.keep_*",
    "meta.version"
  ],
  "failOn": {
    "unused": true,
    "missing": true,
    "interpolationMismatch": true
  }
}
```

---

## GitHub Actions CI Gate

Add `.github/workflows/i18n-ast-lint.yml` to block broken translations in pull requests:

```yaml
name: i18n Integrity Check

on:
  pull_request:
  push:
    branches: [main]

jobs:
  i18n-ast-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx i18n-ast-lint check --ci
```

---

## Performance Benchmark

Evaluated on a synthetic 500-file TypeScript/React codebase containing 1,500 translation keys across `en.json` and `fr.json` (`pnpm bench --run` via Vitest Bench):

| Benchmark Suite | Files Scanned | Keys Analyzed | Mean Duration | p99 Duration | Throughput |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Full AST Scan + Diff Engine** | 500 `.tsx` files | 1,500 keys (2 locales) | **178.04 ms** | **197.43 ms** | **5.62 ops/sec** |

---

## Programmatic TypeScript SDK

`i18n-ast-lint` and `@locale-lint/core` export full TypeScript declarations for custom tooling or browser integrations:

```ts
import { scanSource, analyzeProject, pruneUnusedKeys } from "i18n-ast-lint";

const extracted = scanSource(tsxCode, "src/App.tsx");
const report = analyzeProject(extracted, {
  en: enRawJson,
  fr: frRawJson,
});

if (report.summary.unusedCount > 0) {
  const unusedEn = report.diagnostics
    .filter((d) => d.type === "UNUSED_KEY" && d.locale === "en")
    .map((d) => d.key);
  const cleanEnJson = pruneUnusedKeys(enRawJson, unusedEn);
}
```

---

## License

[MIT](./LICENSE)
