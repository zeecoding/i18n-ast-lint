"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Diagnostic, LintReport } from "@locale-lint/core";
import { PLAYGROUND_PRESETS, type PresetId } from "../presets/index";
import { CodeEditor } from "../components/CodeEditor";
import { DiagnosticsPanel } from "../components/DiagnosticsPanel";
import { DiffPreview, type LocaleDiffItem } from "../components/DiffPreview";
import { CIExport } from "../components/CIExport";

type CoreModule = typeof import("@locale-lint/core");
type ActiveTab = "source" | "baseLocale" | "targetLocale";

export default function PlaygroundPage() {
  const [core, setCore] = useState<CoreModule | null>(null);
  const [presetId, setPresetId] = useState<PresetId>("react-i18next");

  const currentPreset = PLAYGROUND_PRESETS[presetId];
  const [sourceCode, setSourceCode] = useState<string>(currentPreset.sourceCode);
  const [baseJson, setBaseJson] = useState<string>(
    currentPreset.locales[currentPreset.baseLocale] ?? "{}"
  );
  const [targetJson, setTargetJson] = useState<string>(
    currentPreset.locales[currentPreset.targetLocale] ?? "{}"
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>("source");
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const [selectedDiagnosticKey, setSelectedDiagnosticKey] = useState<
    string | null
  >(null);
  const [showFixPreview, setShowFixPreview] = useState<boolean>(false);
  const [copiedCli, setCopiedCli] = useState<boolean>(false);

  // Lazy-load @locale-lint/core on the client so TypeScript AST parser does not block initial page load
  useEffect(() => {
    let mounted = true;
    import("@locale-lint/core").then((mod) => {
      if (mounted) {
        setCore(mod);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSelectPreset = (nextId: PresetId) => {
    const preset = PLAYGROUND_PRESETS[nextId];
    setPresetId(nextId);
    setSourceCode(preset.sourceCode);
    setBaseJson(preset.locales[preset.baseLocale] ?? "{}");
    setTargetJson(preset.locales[preset.targetLocale] ?? "{}");
    setActiveTab("source");
    setHighlightedLine(null);
    setSelectedDiagnosticKey(null);
    setShowFixPreview(false);
  };

  const handleResetFixture = () => {
    handleSelectPreset(presetId);
  };

  const handleCopyCli = async () => {
    try {
      await navigator.clipboard.writeText("npx i18n-ast-lint check");
      setCopiedCli(true);
      setTimeout(() => setCopiedCli(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  // Run AST extraction + diff analysis 100% client-side
  const analysisResult = useMemo((): {
    report: LintReport | null;
    parseError: string | null;
  } => {
    if (!core) {
      return { report: null, parseError: null };
    }

    try {
      const start = performance.now();
      const extracted = core.scanSource(
        sourceCode,
        currentPreset.sourceFilePath
      );
      const localesMap: Record<string, string> = {
        [currentPreset.baseLocale]: baseJson,
        [currentPreset.targetLocale]: targetJson,
      };
      const localeFilePaths: Record<string, string> = {
        [currentPreset.baseLocale]: `locales/${currentPreset.baseLocale}.json`,
        [currentPreset.targetLocale]: `locales/${currentPreset.targetLocale}.json`,
      };

      const report = core.analyzeProject(
        extracted,
        localesMap,
        {
          baseLocale: currentPreset.baseLocale,
        },
        {
          totalFilesScanned: 1,
          durationMs: Math.max(1, Math.round(performance.now() - start)),
          localeFilePaths,
        }
      );

      return { report, parseError: null };
    } catch (err) {
      return {
        report: null,
        parseError: err instanceof Error ? err.message : String(err),
      };
    }
  }, [core, sourceCode, baseJson, targetJson, currentPreset]);

  // Compute format-preserving --fix preview across both locale JSON buffers
  const fixDiffs = useMemo((): LocaleDiffItem[] => {
    if (!core || !analysisResult.report) return [];

    const unusedByLocale: Record<string, string[]> = {
      [currentPreset.baseLocale]: [],
      [currentPreset.targetLocale]: [],
    };

    for (const diag of analysisResult.report.diagnostics) {
      if (diag.type === "UNUSED_KEY" && diag.locale) {
        unusedByLocale[diag.locale]?.push(diag.key);
      }
    }

    const baseUnused = unusedByLocale[currentPreset.baseLocale] ?? [];
    const targetUnused = unusedByLocale[currentPreset.targetLocale] ?? [];

    const items: LocaleDiffItem[] = [];

    if (baseUnused.length > 0) {
      items.push({
        locale: currentPreset.baseLocale,
        removedKeys: baseUnused,
        before: baseJson,
        after: core.pruneUnusedKeys(baseJson, baseUnused),
      });
    }

    if (targetUnused.length > 0) {
      items.push({
        locale: currentPreset.targetLocale,
        removedKeys: targetUnused,
        before: targetJson,
        after: core.pruneUnusedKeys(targetJson, targetUnused),
      });
    }

    return items;
  }, [core, analysisResult.report, baseJson, targetJson, currentPreset]);

  const handleSelectDiagnostic = (diag: Diagnostic, rowId: string) => {
    const line = diag.location?.line ?? null;
    const filePath = diag.location?.filePath ?? "";

    if (filePath.endsWith(`${currentPreset.baseLocale}.json`)) {
      setActiveTab("baseLocale");
    } else if (filePath.endsWith(`${currentPreset.targetLocale}.json`)) {
      setActiveTab("targetLocale");
    } else {
      setActiveTab("source");
    }

    setHighlightedLine(line);
    setSelectedDiagnosticKey(rowId);
  };

  const handleApplyFix = () => {
    for (const diff of fixDiffs) {
      if (diff.locale === currentPreset.baseLocale) {
        setBaseJson(diff.after);
      } else if (diff.locale === currentPreset.targetLocale) {
        setTargetJson(diff.after);
      }
    }
    setShowFixPreview(false);
    setHighlightedLine(null);
    setSelectedDiagnosticKey(null);
  };

  const activeEditorValue =
    activeTab === "source"
      ? sourceCode
      : activeTab === "baseLocale"
        ? baseJson
        : targetJson;

  const activeLanguage = activeTab === "source" ? "tsx" : "json";
  const lineCount = activeEditorValue.split(/\r?\n/).length;

  const isDirty =
    sourceCode !== currentPreset.sourceCode ||
    baseJson !== (currentPreset.locales[currentPreset.baseLocale] ?? "{}") ||
    targetJson !== (currentPreset.locales[currentPreset.targetLocale] ?? "{}");

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 py-5 sm:px-6">
      {/* Compact Operate Workbench Top Bar — No decorative eyebrow badge above H1 */}
      <header className="flex flex-col justify-between gap-4 border-b border-[#263042] pb-4 lg:flex-row lg:items-center">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[#F4F6F8]">
              i18n-ast-lint
            </h1>
            <span className="rounded-[4px] border border-[#263042] bg-[#11161F] px-2 py-0.5 font-mono text-xs text-[#A3B1C6]">
              v0.1.0 · TS Compiler AST Workbench
            </span>
            <button
              type="button"
              onClick={handleCopyCli}
              aria-label="Copy npx i18n-ast-lint check CLI command"
              className="flex items-center gap-2 rounded-[6px] border border-[#263042] bg-[#11161F] px-2.5 py-1 font-mono text-xs text-[#F4F6F8] transition-colors duration-150 hover:border-[#3B4A63] hover:bg-[#171E2B]"
            >
              <span className="text-[#8B9BB4]">$</span>
              <span>npx i18n-ast-lint check</span>
              <span className="rounded-[4px] bg-[#171E2B] px-1.5 py-0.5 text-[10px] text-[#A3B1C6]">
                {copiedCli ? "Copied" : "Copy"}
              </span>
            </button>
          </div>
          <p className="max-w-[72ch] text-xs text-[#A3B1C6]">
            {currentPreset.description}
          </p>
        </div>

        {/* Right Controls: Framework Fixture Switcher + Reset */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Select i18n framework fixture"
            className="flex flex-wrap items-center gap-1 rounded-[8px] border border-[#263042] bg-[#11161F] p-1"
          >
            {(Object.keys(PLAYGROUND_PRESETS) as PresetId[]).map((id) => {
              const preset = PLAYGROUND_PRESETS[id];
              const isSelected = id === presetId;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleSelectPreset(id)}
                  className={`flex flex-col items-start rounded-[6px] border px-3 py-1.5 text-left transition-colors duration-150 ${
                    isSelected
                      ? "border-[#3B4A63] bg-[#171E2B] text-[#F4F6F8]"
                      : "border-transparent bg-transparent text-[#A3B1C6] hover:bg-[#171E2B]/50 hover:text-[#F4F6F8]"
                  }`}
                >
                  <span className="font-mono text-xs font-semibold">
                    {preset.name}
                  </span>
                  <span className="text-[11px] text-[#8B9BB4]">
                    {preset.badge}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={!isDirty && highlightedLine === null}
            onClick={handleResetFixture}
            className="rounded-[6px] border border-[#3B4A63] bg-[#171E2B] px-3 py-2 text-xs font-medium text-[#F4F6F8] transition-colors duration-150 hover:bg-[#1E293B] disabled:border-[#263042] disabled:bg-[#11161F] disabled:text-[#8B9BB4]"
          >
            Reset Fixture
          </button>
        </div>
      </header>

      {/* Main Operate Workspace */}
      <main id="workbench-main" className="flex flex-col gap-5">
        {/* Inline Expandable --fix Diff Preview */}
        {showFixPreview && fixDiffs.length > 0 && (
          <DiffPreview
            diffs={fixDiffs}
            onApplyFix={handleApplyFix}
            onClose={() => setShowFixPreview(false)}
          />
        )}

        {/* Split-Pane Editor (Left 7 Cols) & Diagnostic Ledger (Right 5 Cols) */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left CodeMirror Buffer */}
          <section
            aria-label="Source and locale file editor"
            className="flex flex-col overflow-hidden rounded-[8px] border border-[#263042] bg-[#11161F] lg:col-span-7"
          >
            {/* File Buffer Tab Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#263042] bg-[#0E131B] px-3 py-1.5">
              <div
                role="tablist"
                aria-label="Active editor buffer"
                className="flex flex-wrap items-center gap-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "source"}
                  onClick={() => {
                    setActiveTab("source");
                    setHighlightedLine(null);
                    setSelectedDiagnosticKey(null);
                  }}
                  className={`relative rounded-[6px] px-3 py-1.5 font-mono text-xs font-medium transition-colors duration-150 ${
                    activeTab === "source"
                      ? "bg-[#171E2B] text-[#F4F6F8]"
                      : "text-[#A3B1C6] hover:bg-[#171E2B]/50 hover:text-[#F4F6F8]"
                  }`}
                >
                  {currentPreset.sourceFilePath}
                  {activeTab === "source" && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-2 bottom-0 h-[2px] bg-[#10B981]"
                    />
                  )}
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "baseLocale"}
                  onClick={() => {
                    setActiveTab("baseLocale");
                    setHighlightedLine(null);
                    setSelectedDiagnosticKey(null);
                  }}
                  className={`relative rounded-[6px] px-3 py-1.5 font-mono text-xs font-medium transition-colors duration-150 ${
                    activeTab === "baseLocale"
                      ? "bg-[#171E2B] text-[#F4F6F8]"
                      : "text-[#A3B1C6] hover:bg-[#171E2B]/50 hover:text-[#F4F6F8]"
                  }`}
                >
                  locales/{currentPreset.baseLocale}.json (base)
                  {activeTab === "baseLocale" && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-2 bottom-0 h-[2px] bg-[#10B981]"
                    />
                  )}
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "targetLocale"}
                  onClick={() => {
                    setActiveTab("targetLocale");
                    setHighlightedLine(null);
                    setSelectedDiagnosticKey(null);
                  }}
                  className={`relative rounded-[6px] px-3 py-1.5 font-mono text-xs font-medium transition-colors duration-150 ${
                    activeTab === "targetLocale"
                      ? "bg-[#171E2B] text-[#F4F6F8]"
                      : "text-[#A3B1C6] hover:bg-[#171E2B]/50 hover:text-[#F4F6F8]"
                  }`}
                >
                  locales/{currentPreset.targetLocale}.json (target)
                  {activeTab === "targetLocale" && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-2 bottom-0 h-[2px] bg-[#10B981]"
                    />
                  )}
                </button>
              </div>

              {highlightedLine !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setHighlightedLine(null);
                    setSelectedDiagnosticKey(null);
                  }}
                  className="rounded-[4px] border border-[#F43F5E]/40 bg-[#4C0519]/50 px-2 py-0.5 font-mono text-[11px] tabular-nums text-[#FDA4AF] hover:bg-[#4C0519]/80"
                >
                  Line {highlightedLine} selected · Clear
                </button>
              )}
            </div>

            <CodeEditor
              value={activeEditorValue}
              language={activeLanguage}
              highlightedLine={highlightedLine}
              onChange={(val) => {
                if (activeTab === "source") {
                  setSourceCode(val);
                } else if (activeTab === "baseLocale") {
                  setBaseJson(val);
                } else {
                  setTargetJson(val);
                }
              }}
            />

            {/* Editor Status Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#263042] bg-[#0E131B] px-3 py-1.5 font-mono text-[11px] tabular-nums text-[#8B9BB4]">
              <div className="flex items-center gap-3">
                <span>
                  Mode: {activeLanguage === "tsx" ? "TypeScript JSX (ts.ScriptKind.TSX)" : "JSONC AST (jsonc-parser)"}
                </span>
                <span>{lineCount} lines</span>
              </div>
              <div>
                {analysisResult.report
                  ? `${analysisResult.report.summary.totalKeysFound} AST key reference(s) extracted`
                  : "Waiting for valid buffer"}
              </div>
            </div>
          </section>

          {/* Right Diagnostics Ledger */}
          <div className="lg:col-span-5">
            <DiagnosticsPanel
              report={analysisResult.report}
              parseError={analysisResult.parseError}
              isEngineReady={core !== null}
              selectedDiagnosticKey={selectedDiagnosticKey}
              onSelectDiagnostic={handleSelectDiagnostic}
              onOpenFixPreview={() => setShowFixPreview(true)}
              onResetFixture={handleResetFixture}
            />
          </div>
        </div>

        {/* Bottom CI Exporter & Adversarial Matrix */}
        <CIExport />
      </main>
    </div>
  );
}
