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
  const totalRemoved = diffs.reduce(
    (acc, item) => acc + item.removedKeys.length,
    0
  );

  return (
    <section
      aria-label="Format-preserving JSON pruning diff preview"
      className="rounded-[8px] border border-[#3B4A63] bg-[#11161F] p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#263042] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[#F4F6F8]">
              Surgical JSON Pruning Preview
            </h2>
            <code className="rounded-[4px] border border-[#263042] bg-[#0B0E14] px-2 py-0.5 font-mono text-xs text-[#A3B1C6]">
              npx i18n-ast-lint fix --dry-run
            </code>
          </div>
          <p className="mt-1 text-xs text-[#A3B1C6]">
            Computed via <code className="font-mono text-[#F4F6F8]">jsonc-parser</code> AST edits — removes {totalRemoved} unused key(s) and empty parent objects while preserving exact indentation and key ordering.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onApplyFix}
            className="rounded-[6px] border border-[#10B981] bg-[#10B981] px-3 py-1.5 text-xs font-semibold text-[#0B0E14] transition-colors duration-150 hover:bg-[#34D399]"
          >
            Apply Fix to Buffer ({totalRemoved})
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-[#3B4A63] bg-[#171E2B] px-3 py-1.5 text-xs font-medium text-[#F4F6F8] transition-colors duration-150 hover:bg-[#1E293B]"
          >
            Dismiss
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {diffs.map((item) => (
          <LocaleFileDiffCard key={item.locale} item={item} />
        ))}
      </div>
    </section>
  );
}

function LocaleFileDiffCard({ item }: { item: LocaleDiffItem }) {
  const diffLines = useMemo(
    () => computeLineDiff(item.before, item.after),
    [item.before, item.after]
  );

  return (
    <div className="overflow-hidden rounded-[6px] border border-[#263042] bg-[#0B0E14]">
      <div className="flex items-center justify-between border-b border-[#263042] bg-[#0E131B] px-3 py-2 text-xs">
        <span className="font-mono font-semibold text-[#F4F6F8]">
          locales/{item.locale}.json
        </span>
        <span className="rounded-[4px] border border-[#F43F5E]/40 bg-[#4C0519]/50 px-2 py-0.5 font-mono text-[11px] tabular-nums text-[#FDA4AF]">
          -{item.removedKeys.length} unused key(s)
        </span>
      </div>
      <pre className="max-h-72 overflow-auto p-3 font-mono text-xs leading-5">
        {diffLines.map((line, i) => {
          if (line.type === "removed") {
            return (
              <div
                key={i}
                className="-mx-3 bg-[#4C0519]/55 px-3 text-[#FDA4AF]"
              >
                - {line.text}
              </div>
            );
          }
          if (line.type === "added") {
            return (
              <div
                key={i}
                className="-mx-3 bg-[#064E3B]/55 px-3 text-[#A7F3D0]"
              >
                + {line.text}
              </div>
            );
          }
          return (
            <div key={i} className="text-[#A3B1C6]">
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
