import { writeFile } from "node:fs/promises";
import {
  analyzeProject,
  pruneUnusedKeys,
  scanSource,
  type ExtractedKey,
  type LintConfig,
  type LintReport,
} from "@locale-lint/core";
import {
  ConfigError,
  defineConfig,
  resolveConfig,
  type CliFlagOverrides,
} from "./config.js";
import {
  discoverWorkspaceFiles,
  resolveUnusedKeysForLocaleFile,
  type DiscoveredLocaleFile,
} from "./fs-walker.js";
import {
  formatJsonReport,
  formatTerminalReport,
  type ReporterOptions,
} from "./reporter.js";

export * from "@locale-lint/core";
export {
  ConfigError,
  defineConfig,
  resolveConfig,
  discoverWorkspaceFiles,
  resolveUnusedKeysForLocaleFile,
  formatJsonReport,
  formatTerminalReport,
  type CliFlagOverrides,
  type DiscoveredLocaleFile,
  type ReporterOptions,
};

export interface RunCheckResult {
  config: LintConfig;
  report: LintReport;
  exitCode: 0 | 1;
}

export interface RunFixFileChange {
  filePath: string;
  locale: string;
  namespace?: string;
  removedKeys: string[];
  before: string;
  after: string;
}

export interface RunFixResult {
  config: LintConfig;
  report: LintReport;
  modifiedFiles: RunFixFileChange[];
  totalRemovedKeys: number;
}

/**
 * Runs a full project translation check in `cwd`.
 * - Always returns `exitCode: 1` if any `error`-severity diagnostic is found.
 * - When `options.ci` is true, `warning`-severity diagnostics also trigger `exitCode: 1`.
 */
export async function runCheck(
  cwd: string,
  overrides?: CliFlagOverrides & { ci?: boolean }
): Promise<RunCheckResult> {
  const startTime = Date.now();
  const config = await resolveConfig(cwd, overrides);
  const workspace = await discoverWorkspaceFiles(cwd, config);

  const extractedKeys: ExtractedKey[] = [];
  for (const sf of workspace.sourceFiles) {
    const fileKeys = scanSource(sf.content, sf.filePath, {
      namespaceSeparator: config.namespaceSeparator,
      keySeparator: config.keySeparator,
    });
    extractedKeys.push(...fileKeys);
  }

  const durationMs = Math.max(1, Date.now() - startTime);
  const report = analyzeProject(extractedKeys, workspace.localeMap, config, {
    totalFilesScanned: workspace.sourceFiles.length,
    durationMs,
    localeFilePaths: workspace.localeFilePaths,
  });

  const hasErrors = report.diagnostics.some((d) => d.severity === "error");
  const hasWarningsInCi =
    Boolean(overrides?.ci) &&
    report.diagnostics.some((d) => d.severity === "warning");

  return {
    config,
    report,
    exitCode: hasErrors || hasWarningsInCi ? 1 : 0,
  };
}

/**
 * Runs dead-key pruning across all locale files in `cwd`.
 * Strips each file's namespace prefix before calling `pruneUnusedKeys()` on namespaced locale files.
 */
export async function runFix(
  cwd: string,
  overrides?: CliFlagOverrides & { dryRun?: boolean }
): Promise<RunFixResult> {
  const startTime = Date.now();
  const config = await resolveConfig(cwd, overrides);
  const workspace = await discoverWorkspaceFiles(cwd, config);

  const extractedKeys: ExtractedKey[] = [];
  for (const sf of workspace.sourceFiles) {
    const fileKeys = scanSource(sf.content, sf.filePath, {
      namespaceSeparator: config.namespaceSeparator,
      keySeparator: config.keySeparator,
    });
    extractedKeys.push(...fileKeys);
  }

  const durationMs = Math.max(1, Date.now() - startTime);
  const report = analyzeProject(extractedKeys, workspace.localeMap, config, {
    totalFilesScanned: workspace.sourceFiles.length,
    durationMs,
    localeFilePaths: workspace.localeFilePaths,
  });

  // Group UNUSED_KEY diagnostics by locale
  const unusedByLocale = new Map<string, string[]>();
  for (const diag of report.diagnostics) {
    if (diag.type === "UNUSED_KEY" && diag.locale) {
      const list = unusedByLocale.get(diag.locale) ?? [];
      list.push(diag.key);
      unusedByLocale.set(diag.locale, list);
    }
  }

  const modifiedFiles: RunFixFileChange[] = [];
  let totalRemovedKeys = 0;

  for (const localeFile of workspace.localeFiles) {
    const localeUnused = unusedByLocale.get(localeFile.locale);
    if (!localeUnused || localeUnused.length === 0) continue;

    const localUnusedKeys = resolveUnusedKeysForLocaleFile(
      localeUnused,
      localeFile,
      config.keySeparator
    );
    if (localUnusedKeys.length === 0) continue;

    const after = pruneUnusedKeys(
      localeFile.rawContent,
      localUnusedKeys,
      config.keySeparator
    );

    if (after !== localeFile.rawContent) {
      if (!overrides?.dryRun) {
        await writeFile(localeFile.absolutePath, after, "utf8");
      }
      modifiedFiles.push({
        filePath: localeFile.filePath,
        locale: localeFile.locale,
        namespace: localeFile.namespace,
        removedKeys: localUnusedKeys,
        before: localeFile.rawContent,
        after,
      });
      totalRemovedKeys += localUnusedKeys.length;
    }
  }

  return {
    config,
    report,
    modifiedFiles,
    totalRemovedKeys,
  };
}
