# `i18n-ast-lint`

[![npm version](https://img.shields.io/npm/v/i18n-ast-lint.svg)](https://www.npmjs.com/package/i18n-ast-lint)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**Zero-config TypeScript AST i18n linter and format-preserving JSON dead-key pruner for `react-i18next`, `next-intl`, and `react-intl`.**

`i18n-ast-lint` parses your `.ts`, `.tsx`, `.js`, and `.jsx` files with the official TypeScript Compiler AST (`ts.createSourceFile`) and edits locale JSON files surgically with `jsonc-parser`. It catches unused translation keys, missing locale entries, and `{variable}` / `{{variable}}` interpolation mismatches across locales—and refuses to delete keys when a dynamic `t(expr)` call cannot be statically proven safe.

---

## Quickstart

Run in any React, Next.js, or TypeScript project with zero configuration:

```bash
# 1. Scan source files and locale JSON files for unused, missing, or mismatched keys
npx i18n-ast-lint check

# 2. Run in CI mode (strips ANSI colors, exits 1 on any error or warning)
npx i18n-ast-lint check --ci

# 3. Preview dead keys that would be removed without writing to disk
npx i18n-ast-lint fix --dry-run

# 4. Surgically prune unused keys while preserving JSON indentation and key order
npx i18n-ast-lint fix
```

---

## Why `i18n-ast-lint`?

Most teams either rely on regex scanners (`i18n-unused`) that break on modern React/Next.js syntax, or stitch together separate tools for key extraction, cross-locale interpolation checking, and JSON cleanup.

| Capability | `i18n-ast-lint` | `i18n-unused` (Regex) |
| :--- | :--- | :--- |
| **Multi-Framework AST Engine** | `react-i18next`, `next-intl`, and `react-intl` (`FormatJS`) in one tool | Regex pattern matching |
| **Scoped Hooks & `keyPrefix`** | `useTranslation('auth', { keyPrefix: 'form' })`, aliased `{ t: tAuth }` | Misses lexical scope (Issue #18) |
| **`next-intl` Client & Server** | `useTranslations('Ns')`, `getTranslations({ namespace })`, `t.rich()`, `t.markup()`, `t.raw()` | Requires manual regex rules |
| **`react-intl` Descriptors** | `<FormattedMessage id>`, `intl.formatMessage({ id })`, `defineMessages({...})` | Partial regex support |
| **JSX `<Trans>` Components** | Multi-line `<Trans i18nKey="..." ns="...">` and JSX expressions | Fails on multi-line JSX (Issue #34) |
| **Constants, Ternaries & Arrays** | Resolves `const k = 'a'; t(k)`, `t(cond ? 'a' : 'b')`, and `t(['a', 'b'])` | Flags active keys as unused |
| **Dynamic Prefix Protection** | ``t(`errors.${code}`)`` auto-protects `errors.*` from pruning | Deletes live dynamic keys |
| **Plurals & Context Suffixes** | Links `_zero`, `_one`, `_other` and `t('friend', { context: 'male' })` (`friend_male`) | Flags variants as unused |
| **Comments & URLs (`https://...`)** | AST ignores `//` and `/* */`; URLs in strings never corrupt scanning | Corrupts strings after `https://` (Issue #42) |
| **Unresolved Call Safety Guard** | Emits `UNRESOLVED_KEY` on opaque `t(fn())` calls and blocks `fix` unless `--force` is passed | Silently deletes keys |
| **Format-Preserving `fix`** | `jsonc-parser` edits preserve 2/4/tab indentation, sibling order, and literal-dot keys | `JSON.stringify` rewrites whole file |
| **Cross-Locale Interpolation Check** | Validates both `{{var}}` (i18next) and `{var}` / `{count, plural, ...}` (ICU) | Not supported |

---

## What the AST Scanner Resolves

### 1. `react-i18next` / `i18next`
```tsx
import { useTranslation, Trans } from "react-i18next";

const NAV_KEYS = {
  SETTINGS: "nav.settings",
} as const;

export function AccountForm({ isAdmin, errCode, count }: { isAdmin: boolean; errCode: string; count: number }) {
  // Resolves namespace + keyPrefix -> "auth.form.*"
  const { t } = useTranslation("auth", { keyPrefix: "form" });
  const { t: tCommon } = useTranslation(["common", "fallback"]);

  return (
    <div>
      {/* Resolves to "auth.form.email" */}
      <label>{t("email")}</label>

      {/* Resolves to "common.save" */}
      <button>{tCommon("save")}</button>

      {/* Explicit colon override -> "common.cancel" */}
      <button>{t("common:cancel")}</button>

      {/* Lexical constant & object property resolution -> "nav.settings" */}
      <a href="/settings">{i18n.t(NAV_KEYS.SETTINGS)}</a>

      {/* Ternary branches -> extracts both "role.admin" and "role.user" */}
      <span>{i18n.t(isAdmin ? "role.admin" : "role.user")}</span>

      {/* Fallback key array -> extracts both "err.specific" and "err.generic" */}
      <span>{i18n.t(["err.specific", "err.generic"])}</span>

      {/* Plural and context linking -> protects "cart.items_one", "cart.items_other", and "friend_male" */}
      <span>{i18n.t("cart.items", { count })}</span>
      <span>{i18n.t("friend", { context: "male" })}</span>

      {/* Multi-line JSX -> resolves to "legal.terms" */}
      <Trans i18nKey={"terms"} ns="legal">
        Read our <a href="https://example.com/terms">Terms</a>
      </Trans>

      {/* Dynamic template prefix -> protects all "auth.form.errors.*" keys */}
      <p>{t(`errors.${errCode}`)}</p>
    </div>
  );
}
```

### 2. `next-intl` (Client & Server Components)
```tsx
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

export async function HeroSection() {
  const t = await getTranslations({ locale: "en", namespace: "Marketing.Hero" });
  const tClient = useTranslations("Marketing.CTA");

  return (
    <section>
      {/* Resolves to "Marketing.Hero.headline" */}
      <h1>{t("headline")}</h1>

      {/* Member methods t.rich, t.markup, t.raw, t.has are all tracked */}
      <div>{t.rich("subheadline", { b: (chunks) => <b>{chunks}</b> })}</div>
      <button>{tClient.raw("primary_button")}</button>
    </section>
  );
}
```

### 3. `react-intl` (`FormatJS`)
```tsx
import { FormattedMessage, defineMessages, useIntl } from "react-intl";

const messages = defineMessages({
  pageTitle: {
    id: "profile.page_title",
    defaultMessage: "Developer Profile",
  },
});

export function ProfileCard({ fullName }: { fullName: string }) {
  const intl = useIntl();
  const label = intl.formatMessage({ id: "profile.aria_label" }, { fullName });

  return (
    <article aria-label={label}>
      <FormattedMessage id="profile.greeting" values={{ fullName }} />
    </article>
  );
}
```

---

## Safe Pruning (`fix`) & Unresolved Dynamic Calls

If your codebase passes an opaque runtime expression to `t(getDynamicKey())` where no namespace is bound, static analysis cannot know which root key might be used at runtime:

1. **When scoped to a hook namespace** (e.g., `const { t } = useTranslation('auth'); t(dynamicVar)`): `i18n-ast-lint` automatically protects the entire `auth.*` namespace from being pruned and logs an `UNRESOLVED_KEY` warning.
2. **When unscoped at root** (e.g., `i18n.t(dynamicVar)`): `i18n-ast-lint fix` aborts with exit code `1` and lists the exact `file:line:col` of the unresolved call so it never deletes live translations behind your back. You can either narrow the call to a template prefix (``t(`section.${dynamicVar}`)``) or pass `--force` to prune anyway.

---

## CLI Reference

### Commands

| Command | Description |
| :--- | :--- |
| `i18n-ast-lint check` | Scans source files and locale JSON files, printing grouped diagnostics. |
| `i18n-ast-lint fix` | Surgically removes `UNUSED_KEY` entries and empty parent objects from locale JSON files. |

### Options

| Flag | Description |
| :--- | :--- |
| `--ci` | Disables ANSI colors and exits `1` on any `error` or `warning` diagnostic (including `UNRESOLVED_KEY`). |
| `--json` | Outputs raw JSON report to `stdout` with no banners or ANSI color codes. |
| `--dry-run` | Used with `fix` to preview which keys and files would be pruned without modifying disk. |
| `--force` | Used with `fix` to proceed with pruning even if unscoped `UNRESOLVED_KEY` warnings exist. |
| `--config <path>` | Explicit path to `i18n-ast-lint.config.json`, `.mjs`, or `.js`. |
| `--locales <dir>` | Override auto-detected locales directory (`locales`, `public/locales`, `messages`, `src/locales`). |
| `--src <dirs>` | Comma-separated source directories to scan (`src`, `app`, `pages`, `components`). |
| `--base <locale>` | Base locale code to compare target locales against (default: `"en"`). |

### Exit Codes

| Code | Meaning |
| :--- | :--- |
| `0` | Clean — zero error diagnostics (or `fix` completed cleanly). |
| `1` | Lint failure — unused keys, missing keys, interpolation mismatches, or `fix` blocked by unresolved dynamic calls. |
| `2` | Fatal error — malformed JSON syntax in a locale file, missing directory, or invalid config file. |

---

## Configuration (Optional)

`i18n-ast-lint` works out of the box for both flat (`locales/en.json`) and namespaced (`public/locales/en/auth.json`) directory structures. To customize rules, create `i18n-ast-lint.config.json` (or `i18n-ast-lint.config.mjs`):

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

## Performance & Footprint Notes

- **500-File Benchmark (`pnpm bench --run`):** Scans 500 synthetic `.tsx` files and diffs 1,500 keys across 2 locales in **178.04 ms mean** (`5.62 ops/sec` on Node 22).
- **Dependency Footprint:** `i18n-ast-lint` depends on `typescript` (`ts.createSourceFile`), `jsonc-parser`, `cac`, and `tinyglobby`. In standard TypeScript repositories, `typescript` is already present in `node_modules` and deduplicated by `npm`/`pnpm`/`yarn`; in a cold `npx` cache, `typescript` adds ~21 MB.

---

## Programmatic TypeScript SDK

`i18n-ast-lint` ships dual ESM (`.mjs`) and CommonJS (`.cjs`) builds with self-contained TypeScript declarations (verified via `publint` and `@arethetypeswrong/cli`):

```ts
import { scanSource, analyzeProject, pruneUnusedKeys } from "i18n-ast-lint";

const extracted = scanSource(tsxCode, "src/App.tsx");
const report = analyzeProject(extracted, {
  en: enRawJson,
  fr: frRawJson,
});

if (report.summary.unusedCount > 0 && !report.summary.unresolvedCount) {
  const unusedEn = report.diagnostics
    .filter((d) => d.type === "UNUSED_KEY" && d.locale === "en")
    .map((d) => d.key);
  const prunedEnJson = pruneUnusedKeys(enRawJson, unusedEn);
}
```

---

## License

[MIT](./LICENSE)
