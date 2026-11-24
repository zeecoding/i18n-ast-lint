"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Diagnostic, LintReport } from "@locale-lint/core";
import {
  PLAYGROUND_PRESETS,
  type PresetId,
} from "../presets/index";
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
  const [showFixPreview, setShowFixPreview] = useState<boolean>(false);

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
    setShowFixPreview(false);
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

  const handleSelectDiagnostic = (diag: Diagnostic) => {
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
  };

  const activeEditorValue =
    activeTab === "source"
      ? sourceCode
      : activeTab === "baseLocale"
        ? baseJson
        : targetJson;

  const activeLanguage = activeTab === "source" ? "tsx" : "json";

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      {/* Top Navbar & Preset Switcher */}
      <header className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg bg-indigo-600/20 px-2.5 py-1 font-mono text-xs font-bold text-indigo-300 ring-1 ring-indigo-500/40">
              i18n-ast-lint v0.1.0
            </span>
            <span className="text-xs text-slate-400">
              100% Client-Side TypeScript AST Playground
            </span>
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-white">
            Zero-Config AST i18n Linter & Dead-Key Pruner
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            {currentPreset.description}
          </p>
        </div>

        {/* Framework Presets */}
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(PLAYGROUND_PRESETS) as PresetId[]).map((id) => {
            const preset = PLAYGROUND_PRESETS[id];
            const isSelected = id === presetId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSelectPreset(id)}
                className={`flex flex-col items-start rounded-xl border px-3.5 py-2 text-left transition ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-950/50 text-white"
                    : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700"
                }`}
              >
                <span className="font-mono text-xs font-bold">
                  {preset.name}
                </span>
                <span className="text-[11px] text-slate-400">
                  {preset.badge}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Optional --fix Red/Green Diff Preview */}
      {showFixPreview && fixDiffs.length > 0 && (
        <DiffPreview
          diffs={fixDiffs}
          onApplyFix={handleApplyFix}
          onClose={() => setShowFixPreview(false)}
        />
      )}

      {/* Split Pane: CodeMirror Editor (Left) & Live Diagnostics (Right) */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Editor Pane */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("source");
                  setHighlightedLine(null);
                }}
                className={`rounded-lg px-3 py-1.5 font-mono text-xs font-medium transition ${
                  activeTab === "source"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                {currentPreset.sourceFilePath}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("baseLocale");
                  setHighlightedLine(null);
                }}
                className={`rounded-lg px-3 py-1.5 font-mono text-xs font-medium transition ${
                  activeTab === "baseLocale"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                locales/{currentPreset.baseLocale}.json (base)
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("targetLocale");
                  setHighlightedLine(null);
                }}
                className={`rounded-lg px-3 py-1.5 font-mono text-xs font-medium transition ${
                  activeTab === "targetLocale"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                locales/{currentPreset.targetLocale}.json (target)
              </button>
            </div>
            {highlightedLine !== null && (
              <span className="font-mono text-[11px] text-rose-400">
                Line {highlightedLine} highlighted
              </span>
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
        </div>

        {/* Right Diagnostics Pane */}
        <div className="lg:col-span-5">
          <DiagnosticsPanel
            report={analysisResult.report}
            parseError={analysisResult.parseError}
            isEngineReady={core !== null}
            onSelectDiagnostic={handleSelectDiagnostic}
            onOpenFixPreview={() => setShowFixPreview(true)}
          />
        </div>
      </section>

      {/* Bottom GitHub Actions CI Generator */}
      <CIExport />
    </main>
  );
}
