"use client";

import React, { useState } from "react";
import type { Diagnostic, DiagnosticType, LintReport } from "@locale-lint/core";

export interface DiagnosticsPanelProps {
  report: LintReport | null;
  parseError: string | null;
  isEngineReady: boolean;
  selectedDiagnosticKey: string | null;
  onSelectDiagnostic: (diag: Diagnostic, id: string) => void;
  onOpenFixPreview: () => void;
  onResetFixture: () => void;
}

type FilterCategory = "ALL" | DiagnosticType;

export function DiagnosticsPanel({
  report,
  parseError,
  isEngineReady,
  selectedDiagnosticKey,
  onSelectDiagnostic,
  onOpenFixPreview,
  onResetFixture,
}: DiagnosticsPanelProps) {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("ALL");

  // Operate-mode skeleton state instead of spinner (per Impeccable operate.md & antislop-human R-27)
  if (!isEngineReady) {
    return (
      <section
        aria-label="AST Diagnostic Ledger loading"
        aria-busy="true"
        className="flex h-full flex-col rounded-[8px] border border-[#263042] bg-[#11161F]"
      >
        <div className="flex items-center justify-between border-b border-[#263042] px-4 py-3">
          <span className="font-mono text-xs text-[#A3B1C6]">
            Initializing TypeScript Compiler AST...
          </span>
          <span className="h-6 w-28 rounded-[6px] bg-[#171E2B]" />
        </div>
        <div className="divide-y divide-[#1E2636] p-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="h-4 w-44 rounded-[4px] bg-[#171E2B]" />
                <span className="h-3 w-24 rounded-[4px] bg-[#171E2B]" />
              </div>
              <div className="h-3 w-3/4 rounded-[4px] bg-[#171E2B]" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (parseError) {
    return (
      <section
        aria-label="JSON Syntax Error"
        role="alert"
        className="flex h-full flex-col justify-between rounded-[8px] border border-[#F43F5E] bg-[#11161F] p-5"
      >
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="rounded-[4px] border border-[#F43F5E]/50 bg-[#4C0519]/60 px-2 py-0.5 font-mono text-xs font-semibold text-[#FDA4AF]">
              EXIT CODE 2 · MALFORMED_LOCALE_JSON
            </span>
            <span className="font-mono text-xs text-[#A3B1C6]">
              jsonc-parser syntax check
            </span>
          </div>
          <h2 className="mt-3 text-base font-semibold text-[#F4F6F8]">
            Locale JSON buffer could not be parsed
          </h2>
          <p className="mt-2 rounded-[6px] border border-[#263042] bg-[#0B0E14] p-3 font-mono text-xs leading-relaxed text-[#FDA4AF]">
            {parseError}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-[#A3B1C6]">
            Fix the trailing comma, unclosed quote, or missing brace in the active JSON editor tab, or restore the default fixture below.
          </p>
        </div>

        <div className="mt-4 flex justify-end border-t border-[#263042] pt-3">
          <button
            type="button"
            onClick={onResetFixture}
            className="rounded-[6px] border border-[#3B4A63] bg-[#171E2B] px-3 py-1.5 text-xs font-medium text-[#F4F6F8] transition-colors duration-150 hover:bg-[#1E293B]"
          >
            Reset Fixture Buffer
          </button>
        </div>
      </section>
    );
  }

  if (!report) {
    return null;
  }

  const { summary, diagnostics } = report;
  const errorCount = diagnostics.filter((d) => d.severity === "error").length;

  const filteredDiagnostics =
    activeFilter === "ALL"
      ? diagnostics
      : diagnostics.filter((d) => d.type === activeFilter);

  const filterButtons: Array<{
    id: FilterCategory;
    label: string;
    count: number;
  }> = [
    { id: "ALL", label: "All", count: diagnostics.length },
    { id: "MISSING_KEY", label: "Missing", count: summary.missingCount },
    {
      id: "INTERPOLATION_MISMATCH",
      label: "Mismatch",
      count: summary.mismatchCount,
    },
    { id: "UNUSED_KEY", label: "Unused", count: summary.unusedCount },
    {
      id: "DYNAMIC_KEY_DETECTED",
      label: "Protected",
      count: summary.dynamicCount,
    },
  ];

  return (
    <section
      aria-label="AST Diagnostic Ledger"
      className="flex h-full flex-col rounded-[8px] border border-[#263042] bg-[#11161F]"
    >
      {/* Ledger Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#263042] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-semibold text-[#F4F6F8]">
            Diagnostic Ledger
          </h2>
          <span
            className={`rounded-[4px] border px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${
              errorCount > 0
                ? "border-[#F43F5E]/40 bg-[#4C0519]/50 text-[#FDA4AF]"
                : "border-[#10B981]/40 bg-[#064E3B]/60 text-[#A7F3D0]"
            }`}
          >
            {errorCount > 0 ? `EXIT 1 · ${errorCount} ERR` : "EXIT 0 · CLEAN"}
          </span>
          <span className="font-mono text-xs tabular-nums text-[#8B9BB4]">
            {summary.durationMs}ms
          </span>
        </div>

        <button
          type="button"
          disabled={summary.unusedCount === 0}
          onClick={onOpenFixPreview}
          className="rounded-[6px] border border-[#10B981] bg-[#10B981] px-3 py-1.5 text-xs font-semibold text-[#0B0E14] transition-colors duration-150 hover:bg-[#34D399] disabled:border-[#263042] disabled:bg-[#171E2B] disabled:text-[#8B9BB4]"
        >
          Preview --fix ({summary.unusedCount})
        </button>
      </div>

      {/* Category Filter Strip */}
      <div
        role="toolbar"
        aria-label="Filter diagnostics by type"
        className="flex flex-wrap items-center gap-1.5 border-b border-[#263042] bg-[#0E131B] px-3 py-2"
      >
        {filterButtons.map((btn) => {
          const isSelected = activeFilter === btn.id;
          return (
            <button
              key={btn.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setActiveFilter(btn.id)}
              className={`flex items-center gap-1.5 rounded-[6px] border px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
                isSelected
                  ? "border-[#3B4A63] bg-[#171E2B] text-[#F4F6F8]"
                  : "border-transparent bg-transparent text-[#A3B1C6] hover:bg-[#171E2B]/60 hover:text-[#F4F6F8]"
              }`}
            >
              <span>{btn.label}</span>
              <span className="font-mono text-[11px] tabular-nums text-[#8B9BB4]">
                {btn.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Diagnostic Rows */}
      <div className="max-h-[468px] flex-1 divide-y divide-[#1E2636] overflow-y-auto">
        {filteredDiagnostics.length === 0 ? (
          <div className="flex flex-col items-start justify-between gap-3 p-6">
            <div>
              <span className="rounded-[4px] border border-[#10B981]/40 bg-[#064E3B]/50 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#A7F3D0]">
                {activeFilter === "ALL"
                  ? "0 DIAGNOSTICS · ALL KEYS VERIFIED"
                  : `0 ${activeFilter} DIAGNOSTICS`}
              </span>
              <h3 className="mt-2.5 text-sm font-semibold text-[#F4F6F8]">
                {activeFilter === "ALL"
                  ? "Base and target locale files match all AST references"
                  : "No diagnostics in this filter category"}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[#A3B1C6]">
                {activeFilter === "ALL"
                  ? "Introduce a key typo in the TSX source buffer or edit a {{variable}} placeholder in the JSON tabs to trigger live AST checks."
                  : "Switch back to the All filter tab to inspect other diagnostic categories."}
              </p>
            </div>
            {activeFilter !== "ALL" && (
              <button
                type="button"
                onClick={() => setActiveFilter("ALL")}
                className="rounded-[6px] border border-[#3B4A63] bg-[#171E2B] px-3 py-1.5 text-xs font-medium text-[#F4F6F8] hover:bg-[#1E293B]"
              >
                Show All Diagnostics ({diagnostics.length})
              </button>
            )}
          </div>
        ) : (
          filteredDiagnostics.map((diag, idx) => {
            const rowId = `${diag.type}-${diag.locale ?? "src"}-${diag.key}-${idx}`;
            const isSelected = selectedDiagnosticKey === rowId;

            return (
              <button
                key={rowId}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectDiagnostic(diag, rowId)}
                className={`flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors duration-150 ${
                  isSelected
                    ? "bg-[#171E2B]"
                    : "bg-transparent hover:bg-[#171E2B]/60"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <DiagnosticBadge type={diag.type} />
                    {diag.locale && (
                      <span className="rounded-[4px] border border-[#263042] bg-[#0B0E14] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#A3B1C6]">
                        {diag.locale}.json
                      </span>
                    )}
                    <span className="font-mono text-xs font-semibold text-[#F4F6F8]">
                      {diag.key}
                    </span>
                  </div>
                  {diag.location && (
                    <span className="font-mono text-[11px] tabular-nums text-[#8B9BB4]">
                      {diag.location.filePath}:{diag.location.line}:
                      {diag.location.column}
                    </span>
                  )}
                </div>

                <p className="text-xs leading-relaxed text-[#A3B1C6]">
                  {diag.message}
                </p>

                {diag.type === "INTERPOLATION_MISMATCH" && (
                  <div className="mt-1 flex flex-wrap gap-2 font-mono text-[11px]">
                    <span className="rounded-[4px] border border-[#10B981]/40 bg-[#064E3B]/40 px-2 py-0.5 text-[#A7F3D0]">
                      expected: {`{${(diag.expectedVars ?? []).join(", ")}}`}
                    </span>
                    <span className="rounded-[4px] border border-[#F43F5E]/40 bg-[#4C0519]/40 px-2 py-0.5 text-[#FDA4AF]">
                      actual: {`{${(diag.actualVars ?? []).join(", ")}}`}
                    </span>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function DiagnosticBadge({ type }: { type: Diagnostic["type"] }) {
  switch (type) {
    case "MISSING_KEY":
      return (
        <span className="rounded-[4px] border border-[#F43F5E]/45 bg-[#4C0519]/50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#FDA4AF]">
          MISSING_KEY
        </span>
      );
    case "INTERPOLATION_MISMATCH":
      return (
        <span className="rounded-[4px] border border-[#F43F5E]/45 bg-[#4C0519]/50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#FDA4AF]">
          INTERPOLATION_MISMATCH
        </span>
      );
    case "UNUSED_KEY":
      return (
        <span className="rounded-[4px] border border-[#F59E0B]/45 bg-[#451A03]/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#FCD34D]">
          UNUSED_KEY
        </span>
      );
    case "DYNAMIC_KEY_DETECTED":
      return (
        <span className="rounded-[4px] border border-[#38BDF8]/45 bg-[#082F49]/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#7DD3FC]">
          DYNAMIC_PROTECTED
        </span>
      );
    case "UNRESOLVED_KEY":
      return (
        <span className="rounded-[4px] border border-[#F59E0B]/45 bg-[#451A03]/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#FCD34D]">
          UNRESOLVED_KEY
        </span>
      );
  }
}
