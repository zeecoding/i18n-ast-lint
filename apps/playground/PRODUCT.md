# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

1. **Frontend & Full-Stack TypeScript Engineers**: Developers maintaining React and Next.js applications with `react-i18next`, `next-intl`, or `react-intl` who need to detect and prune orphaned translation keys without accidentally deleting active UI strings.
2. **Tech Leads & Release/DevOps Engineers**: Maintainers who gate pull requests in CI (`npx i18n-ast-lint check --ci`) to prevent missing locale keys or broken `{variable}` / `{{variable}}` interpolation placeholders from shipping to production.
3. **Open-Source Evaluators & Engineering Hiring Managers**: Visitors inspecting `i18n-ast-lint` in the browser who want immediate, zero-install proof that the AST engine accurately resolves lexical hook scopes, JSX `<Trans>` nodes, dynamic template prefixes, and format-preserving JSON pruning.

## Product Purpose

`i18n-ast-lint` is an open-source npm CLI, TypeScript SDK, and client-side interactive browser workbench that replaces fragile regex-based i18n linters (such as `i18n-unused`) with a fast, zero-config static analysis engine powered by the TypeScript Compiler API (`ts.createSourceFile`) and `jsonc-parser`.

## Positioning

Unlike regex-based linters (`i18n-unused`) that guess translation keys via text patterns and rewrite entire locale files via `JSON.stringify`, `i18n-ast-lint` runs the real TypeScript AST compiler and `jsonc-parser` AST modifier inside an environment-isolated core (`@locale-lint/core` with zero `node:*` imports)—allowing the exact same engine to execute in Node.js CI pipelines and 100% client-side in the browser.

## Operating Context

- **Browser Workbench (`apps/playground`)**: Operate-mode static analysis studio where engineers switch between real framework fixtures (`react-i18next`, `next-intl`, `react-intl`), edit TSX and locale JSON live in CodeMirror 6, inspect line-accurate diagnostics, preview surgical JSON diffs, and export package-manager-specific CI configs.

## Capabilities and Constraints

- **Core Engine (`@locale-lint/core`)**: 100% pure TypeScript with zero `node:*` dependencies; lazy-loaded on the client so the TypeScript parser bundle never blocks initial page paint.
- **Diagnostic Categories**: `MISSING_KEY` (error), `INTERPOLATION_MISMATCH` (error), `UNUSED_KEY` (error/warning), and `DYNAMIC_KEY_DETECTED` (info protection notice).
- **Verified Benchmark**: 178.04 ms mean scan + diff analysis across 500 `.tsx` files and 1,500 translation keys (`vitest bench`).

## Brand Commitments

- **Name**: `i18n-ast-lint` (CLI package) / `@locale-lint/core` (AST engine).
- **Voice**: Direct, technical, evidence-first engineering prose. Never use marketing fluff, unverified metrics, decorative emoji, or AI-costume badges.

## Evidence on Hand

- Verified benchmark suite (`packages/core/tests/benchmarks/scan.bench.ts`): **178.04 ms mean** across 500 TSX files and 1,500 keys.
- Verified adversarial regression suite (`packages/core/tests/regression/adversarial.test.ts`): reproduces and passes `i18n-unused` issues #18, #34, #35, #42, and #43.

## Product Principles

1. **Compiler Truth Over Heuristics**: Every diagnostic and JSON edit is backed by an AST node, file path, and 1-indexed line/column coordinate.
2. **Operate-First Workbench**: The browser surface is a functional static-analysis instrument, not a marketing brochure. The working editor and live AST diagnostics lead from the first viewport.
3. **Surgical Restraint**: Never touch bytes the user didn't ask to change—in their JSON files or in the UI chrome.

## Accessibility & Inclusion

- WCAG 2.2 AA compliance across all surfaces: ≥ 4.5:1 contrast for normal text, ≥ 3:1 for large text and non-text UI boundaries.
- Full keyboard operability with high-contrast `:focus-visible` outlines, logical tab order, native `<button>` and ARIA tab/region semantics, and `prefers-reduced-motion` support.
