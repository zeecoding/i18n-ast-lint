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
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
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
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
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
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
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
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bunx i18n-ast-lint check --ci`,
};

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
      // Fallback ignored
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">
            GitHub Actions CI Gate (`.github/workflows/i18n-ast-lint.yml`)
          </h3>
          <p className="text-xs text-slate-400">
            Blocks PRs automatically with exit code <code className="text-slate-200">1</code> on missing translations, unused keys, or interpolation typos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-xs">
            {(["pnpm", "npm", "yarn", "bun"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPm(item)}
                className={`rounded-md px-2.5 py-1 font-mono font-medium transition ${
                  pm === item
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
          >
            {copied ? "Copied!" : "Copy YAML"}
          </button>
        </div>
      </div>

      <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-300">
        {yaml}
      </pre>
    </div>
  );
}
