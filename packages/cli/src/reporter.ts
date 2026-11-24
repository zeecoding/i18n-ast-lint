import type { Diagnostic, LintReport } from "@locale-lint/core";

export interface ReporterOptions {
  ci?: boolean;
}

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
} as const;

/**
 * Formats a `LintReport` as a grouped, human-readable terminal report.
 * When `options.ci` is true (or `NO_COLOR` is set), all ANSI color escape sequences are omitted.
 */
export function formatTerminalReport(
  report: LintReport,
  options?: ReporterOptions
): string {
  const useColor = !options?.ci && !process.env.NO_COLOR;
  const c = (code: string, text: string): string =>
    useColor ? `${code}${text}${ANSI.reset}` : text;

  const lines: string[] = [];
  lines.push(
    c(
      ANSI.bold,
      `i18n-ast-lint v0.1.0 — Scanned ${report.summary.totalFilesScanned} source file(s) in ${report.summary.durationMs}ms`
    )
  );
  lines.push("");

  if (report.diagnostics.length === 0) {
    lines.push(c(ANSI.green, "✓ All translation keys and interpolations are in sync."));
    return lines.join("\n");
  }

  const groups: Array<{
    title: string;
    items: Diagnostic[];
    color: string;
  }> = [
    {
      title: `MISSING KEYS (${report.summary.missingCount})`,
      items: report.diagnostics.filter((d) => d.type === "MISSING_KEY"),
      color: ANSI.red,
    },
    {
      title: `INTERPOLATION MISMATCHES (${report.summary.mismatchCount})`,
      items: report.diagnostics.filter((d) => d.type === "INTERPOLATION_MISMATCH"),
      color: ANSI.red,
    },
    {
      title: `UNUSED KEYS (${report.summary.unusedCount})`,
      items: report.diagnostics.filter((d) => d.type === "UNUSED_KEY"),
      color: ANSI.yellow,
    },
    {
      title: `DYNAMIC PREFIXES PROTECTED (${report.summary.dynamicCount})`,
      items: report.diagnostics.filter((d) => d.type === "DYNAMIC_KEY_DETECTED"),
      color: ANSI.cyan,
    },
  ];

  for (const group of groups) {
    if (group.items.length === 0) continue;
    lines.push(c(ANSI.bold, c(group.color, `■ ${group.title}`)));

    for (const diag of group.items) {
      const badge =
        diag.severity === "error"
          ? c(ANSI.red, "ERROR")
          : diag.severity === "warning"
            ? c(ANSI.yellow, "WARN ")
            : c(ANSI.cyan, "INFO ");

      const loc = diag.location
        ? c(
            ANSI.dim,
            `${diag.location.filePath}:${diag.location.line}:${diag.location.column}`
          )
        : "";

      const localeTag = diag.locale ? `[${diag.locale}] ` : "";
      lines.push(`  ${badge} ${localeTag}${c(ANSI.bold, diag.key)} ${loc}`);
      lines.push(`        ${diag.message}`);
    }
    lines.push("");
  }

  const errorCount = report.diagnostics.filter((d) => d.severity === "error").length;
  const warnCount = report.diagnostics.filter((d) => d.severity === "warning").length;

  lines.push(
    c(
      ANSI.bold,
      `Summary: ${errorCount} error(s), ${warnCount} warning(s), ${report.summary.dynamicCount} dynamic prefix(es) (${report.summary.durationMs}ms)`
    )
  );

  return lines.join("\n");
}

/**
 * Serializes a `LintReport` as raw JSON without ANSI colors or banners.
 */
export function formatJsonReport(report: LintReport): string {
  return JSON.stringify(report, null, 2);
}
