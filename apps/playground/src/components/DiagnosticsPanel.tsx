"use client";

import React from "react";
import type { Diagnostic, LintReport } from "@locale-lint/core";

export interface DiagnosticsPanelProps {
  report: LintReport | null;
  parseError: string | null;
  isEngineReady: boolean;
  onSelectDiagnostic: (diag: Diagnostic) => void;
  onOpenFixPreview: () => void;
}

export function DiagnosticsPanel({
  report,
  parseError,
  isEngineReady,
  onSelectDiagnostic,
  onOpenFixPreview,
}: DiagnosticsPanelProps) {
  if (!isEngineReady) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/70 p-8 text-slate-400">
        <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
        <p className="text-sm font-medium">
          Lazy-loading @locale-lint/core AST engine...
        </p>
      </div>
    );
  }

  if (parseError) {
    return (
      <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-5 text-rose-200">
        <div className="mb-1 flex items-center gap-2 font-semibold text-rose-400">
          <span>JSON Syntax Error (Exit Code 2)</span>
        </div>
        <p className="font-mono text-xs leading-relaxed">{parseError}</p>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  const { summary, diagnostics } = report;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/70">
      {/* Header Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md bg-rose-500/15 px-2.5 py-1 font-medium text-rose-300 ring-1 ring-rose-500/30">
            {summary.missingCount} Missing
          </span>
          <span className="rounded-md bg-orange-500/15 px-2.5 py-1 font-medium text-orange-300 ring-1 ring-orange-500/30">
            {summary.mismatchCount} Mismatch
          </span>
          <span className="rounded-md bg-amber-500/15 px-2.5 py-1 font-medium text-amber-300 ring-1 ring-amber-500/30">
            {summary.unusedCount} Unused
          </span>
          <span className="rounded-md bg-cyan-500/15 px-2.5 py-1 font-medium text-cyan-300 ring-1 ring-cyan-500/30">
            {summary.dynamicCount} Dynamic Protected
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-slate-400">
            AST scan: {summary.durationMs}ms
          </span>
          <button
            type="button"
            disabled={summary.unusedCount === 0}
            onClick={onOpenFixPreview}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Preview --fix ({summary.unusedCount})
          </button>
        </div>
      </div>

      {/* Diagnostic List */}
      <div className="flex-1 divide-y divide-slate-800/70 overflow-y-auto">
        {diagnostics.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 text-center">
            <div className="mb-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
              Exit Code 0 — Clean
            </div>
            <p className="text-sm text-slate-300">
              All translation keys and interpolation placeholders are in sync!
            </p>
          </div>
        ) : (
          diagnostics.map((diag, idx) => (
            <button
              key={`${diag.type}-${diag.locale ?? "src"}-${diag.key}-${idx}`}
              type="button"
              onClick={() => onSelectDiagnostic(diag)}
              className="flex w-full flex-col gap-1.5 px-4 py-3 text-left transition hover:bg-slate-800/60"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <DiagnosticBadge type={diag.type} />
                  {diag.locale && (
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-300">
                      {diag.locale}.json
                    </span>
                  )}
                  <span className="font-mono text-xs font-semibold text-white">
                    {diag.key}
                  </span>
                </div>
                {diag.location && (
                  <span className="font-mono text-[11px] text-slate-400">
                    {diag.location.filePath}:{diag.location.line}:
                    {diag.location.column}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-300">{diag.message}</p>

              {diag.type === "INTERPOLATION_MISMATCH" && (
                <div className="mt-1 flex flex-wrap gap-3 font-mono text-[11px]">
                  <span className="rounded bg-emerald-950/60 px-2 py-0.5 text-emerald-300 ring-1 ring-emerald-500/30">
                    expected: {`{${(diag.expectedVars ?? []).join(", ")}}`}
                  </span>
                  <span className="rounded bg-rose-950/60 px-2 py-0.5 text-rose-300 ring-1 ring-rose-500/30">
                    actual: {`{${(diag.actualVars ?? []).join(", ")}}`}
                  </span>
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function DiagnosticBadge({ type }: { type: Diagnostic["type"] }) {
  switch (type) {
    case "MISSING_KEY":
      return (
        <span className="rounded bg-rose-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-300">
          MISSING_KEY
        </span>
      );
    case "INTERPOLATION_MISMATCH":
      return (
        <span className="rounded bg-orange-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-orange-300">
          INTERPOLATION_MISMATCH
        </span>
      );
    case "UNUSED_KEY":
      return (
        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
          UNUSED_KEY
        </span>
      );
    case "DYNAMIC_KEY_DETECTED":
      return (
        <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cyan-300">
          DYNAMIC_KEY_DETECTED
        </span>
      );
  }
}
