"use client";

import React, { useMemo } from "react";

export interface LocaleDiffItem {
  locale: string;
  removedKeys: string[];
  before: string;
  after: string;
}

export interface DiffPreviewProps {
  diffs: LocaleDiffItem[];
  onApplyFix: () => void;
  onClose: () => void;
}

interface DiffLine {
  type: "same" | "removed" | "added";
  text: string;
}

export function DiffPreview({ diffs, onApplyFix, onClose }: DiffPreviewProps) {
  return (
    <div className="rounded-xl border border-indigo-500/40 bg-slate-900/95 p-4 shadow-xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Format-Preserving Pruning Preview (`i18n-ast-lint fix --dry-run`)
          </h3>
          <p className="text-xs text-slate-400">
            Powered by <code className="text-indigo-300">jsonc-parser</code> — preserves exact indentation, sibling key order, and removes empty parent objects.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onApplyFix}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
          >
            Apply Fix to Editor
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {diffs.map((item) => (
          <LocaleFileDiffCard key={item.locale} item={item} />
        ))}
      </div>
    </div>
  );
}

function LocaleFileDiffCard({ item }: { item: LocaleDiffItem }) {
  const diffLines = useMemo(
    () => computeLineDiff(item.before, item.after),
    [item.before, item.after]
  );

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-2 text-xs">
        <span className="font-mono font-semibold text-slate-200">
          locales/{item.locale}.json
        </span>
        <span className="rounded bg-rose-500/15 px-2 py-0.5 font-mono text-[11px] text-rose-300">
          -{item.removedKeys.length} unused key(s)
        </span>
      </div>
      <pre className="max-h-72 overflow-auto p-3 font-mono text-xs leading-5">
        {diffLines.map((line, i) => {
          if (line.type === "removed") {
            return (
              <div
                key={i}
                className="-mx-3 bg-rose-950/60 px-3 text-rose-300"
              >
                - {line.text}
              </div>
            );
          }
          if (line.type === "added") {
            return (
              <div
                key={i}
                className="-mx-3 bg-emerald-950/50 px-3 text-emerald-300"
              >
                + {line.text}
              </div>
            );
          }
          return (
            <div key={i} className="text-slate-400">
              {"  "}
              {line.text}
            </div>
          );
        })}
      </pre>
    </div>
  );
}

function computeLineDiff(before: string, after: string): DiffLine[] {
  const a = before.split(/\r?\n/);
  const b = after.split(/\r?\n/);
  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array<number>(n + 1).fill(0)
  );

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i]![j] = 1 + (dp[i + 1]?.[j + 1] ?? 0);
      } else {
        dp[i]![j] = Math.max(dp[i + 1]?.[j] ?? 0, dp[i]?.[j + 1] ?? 0);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < m && j < n) {
    if (a[i] === b[j]) {
      result.push({ type: "same", text: a[i]! });
      i++;
      j++;
    } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
      result.push({ type: "removed", text: a[i]! });
      i++;
    } else {
      result.push({ type: "added", text: b[j]! });
      j++;
    }
  }
  while (i < m) {
    result.push({ type: "removed", text: a[i]! });
    i++;
  }
  while (j < n) {
    result.push({ type: "added", text: b[j]! });
    j++;
  }

  return result;
}
