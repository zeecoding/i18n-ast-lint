"use client";

import React, { useState } from "react";

type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

const WORKFLOW_TEMPLATES: Record<PackageManager, string> = {
  pnpm: `name: i18n Integrity Check

on:
  pull_request:
  push:
    branches: [main]

jobs:
  i18n-ast-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm dlx i18n-ast-lint check --ci`,

  npm: `name: i18n Integrity Check

on:
  pull_request:
  push:
    branches: [main]

jobs:
  i18n-ast-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx i18n-ast-lint check --ci`,

  yarn: `name: i18n Integrity Check

on:
  pull_request:
  push:
    branches: [main]

jobs:
  i18n-ast-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: yarn
      - run: yarn install --immutable
      - run: yarn dlx i18n-ast-lint check --ci`,

  bun: `name: i18n Integrity Check

on:
  pull_request:
  push:
    branches: [main]

jobs:
  i18n-ast-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bunx i18n-ast-lint check --ci`,
};

const ADVERSARIAL_MATRIX = [
  {
    capability: "Lexical Hook Scope (useTranslation / useTranslations)",
    astResult: "Tracks nested function bindings, keyPrefix & aliased { t: tAuth }",
    regexFailure: "Cannot track lexical variable bindings across functions",
  },
  {
    capability: "Multi-line JSX (<Trans i18nKey> & <FormattedMessage>)",
    astResult: "Extracts JsxOpeningElement & JsxExpression attributes",
    regexFailure: "Line-based regex misses multi-line JSX attributes",
  },
  {
    capability: "Comments & URLs (https://example.com)",
    astResult: "Compiler tokenizer ignores comments & preserves URLs",
    regexFailure: "Naive // comment stripping corrupts string literals with URLs",
  },
  {
    capability: "Dynamic Template Prefix (t(`errors.${code}`))",
    astResult: "Emits DYNAMIC_KEY_DETECTED & protects errors.*",
    regexFailure: "Flags dynamic keys as unused and deletes them during fix",
  },
  {
    capability: "Surgical JSON Pruning (jsonc-parser)",
    astResult: "Preserves indentation, sibling order & literal-dot keys",
    regexFailure: "JSON.stringify rewrites entire file formatting",
  },
  {
    capability: "500-File Synthetic TSX Benchmark (1,500 keys)",
    astResult: "178.04 ms mean scan + diff (5.62 ops/sec, Vitest Bench)",
    regexFailure: "No cross-locale interpolation check or CI exit code gate",
  },
] as const;

export function CIExport() {
  const [pm, setPm] = useState<PackageManager>("pnpm");
  const [copied, setCopied] = useState(false);

  const yaml = WORKFLOW_TEMPLATES[pm];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(yaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <section
      aria-label="CI configuration and compiler architecture comparison"
      className="grid grid-cols-1 gap-6 lg:grid-cols-12"
    >
      {/* Left 6 Columns: GitHub Actions YAML Generator */}
      <div className="flex flex-col justify-between rounded-[8px] border border-[#263042] bg-[#11161F] p-4 lg:col-span-6">
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#263042] pb-3">
            <div>
              <h2 className="text-sm font-semibold text-[#F4F6F8]">
                GitHub Actions CI Gate
              </h2>
              <p className="mt-0.5 font-mono text-[11px] text-[#8B9BB4]">
                .github/workflows/i18n-ast-lint.yml
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div
                role="tablist"
                aria-label="Select package manager"
                className="flex rounded-[6px] border border-[#263042] bg-[#0B0E14] p-0.5 text-xs"
              >
                {(["pnpm", "npm", "yarn", "bun"] as const).map((item) => {
                  const selected = pm === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setPm(item)}
                      className={`rounded-[4px] px-2.5 py-1 font-mono text-xs font-medium transition-colors duration-150 ${
                        selected
                          ? "bg-[#171E2B] text-[#F4F6F8]"
                          : "text-[#A3B1C6] hover:text-[#F4F6F8]"
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className="rounded-[6px] border border-[#3B4A63] bg-[#171E2B] px-3 py-1.5 text-xs font-medium text-[#F4F6F8] transition-colors duration-150 hover:bg-[#1E293B]"
              >
                {copied ? "Copied YAML" : "Copy YAML"}
              </button>
            </div>
          </div>

          <pre className="overflow-x-auto rounded-[6px] border border-[#263042] bg-[#0B0E14] p-3 font-mono text-xs leading-relaxed text-[#F4F6F8]">
            {yaml}
          </pre>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#263042] pt-2.5 font-mono text-[11px] text-[#8B9BB4]">
          <span>Exit 0: Clean</span>
          <span>Exit 1: Unused / Missing / Mismatch</span>
          <span>Exit 2: Malformed JSON / Config</span>
        </div>
      </div>

      {/* Right 6 Columns: Adversarial Regression & Benchmark Ledger */}
      <div className="flex flex-col justify-between rounded-[8px] border border-[#263042] bg-[#11161F] p-4 lg:col-span-6">
        <div>
          <div className="mb-3 flex items-center justify-between border-b border-[#263042] pb-3">
            <div>
              <h2 className="text-sm font-semibold text-[#F4F6F8]">
                Compiler AST vs. Regex Verification Matrix
              </h2>
              <p className="mt-0.5 text-xs text-[#A3B1C6]">
                Static analysis capabilities verified across real-world React & Next.js patterns
              </p>
            </div>
            <span className="rounded-[4px] border border-[#263042] bg-[#0B0E14] px-2 py-0.5 font-mono text-[11px] tabular-nums text-[#A3B1C6]">
              25/25 tests passing
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#263042] text-[11px] font-semibold text-[#A3B1C6]">
                  <th className="py-2 pr-3">Static Analysis Case</th>
                  <th className="px-3 py-2">i18n-ast-lint (TS AST)</th>
                  <th className="py-2 pl-3">Legacy Regex Linters</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2636]">
                {ADVERSARIAL_MATRIX.map((row) => (
                  <tr key={row.capability}>
                    <td className="py-2.5 pr-3 font-medium text-[#F4F6F8]">
                      {row.capability}
                    </td>
                    <td className="px-3 py-2.5 text-[#A7F3D0]">
                      {row.astResult}
                    </td>
                    <td className="py-2.5 pl-3 text-[#8B9BB4]">
                      {row.regexFailure}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#263042] pt-2.5 font-mono text-[11px] text-[#8B9BB4]">
          <span>Engine: TypeScript 5.9 AST + jsonc-parser</span>
          <span>Zero node:* imports in @locale-lint/core</span>
        </div>
      </div>
    </section>
  );
}
