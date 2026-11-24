export interface LintConfig {
  baseLocale: string;                 // e.g., "en"
  localesDir: string;                 // Auto-detected or user-defined
  srcDir: string[];                   // e.g., ["src", "app"]
  namespaceSeparator: ":" | ".";      // Default: ":"
  keySeparator: string;               // Default: "."
  ignoreKeys: string[];               // Prefix/glob patterns to ignore
  failOn: {
    unused: boolean;                  // Default: true
    missing: boolean;                 // Default: true
    interpolationMismatch: boolean;   // Default: true
  };
}

export const DEFAULT_LINT_CONFIG: LintConfig = {
  baseLocale: "en",
  localesDir: "locales",
  srcDir: ["src"],
  namespaceSeparator: ":",
  keySeparator: ".",
  ignoreKeys: [],
  failOn: {
    unused: true,
    missing: true,
    interpolationMismatch: true,
  },
};

export interface ScanOptions {
  namespaceSeparator?: ":" | ".";
  keySeparator?: string;
  defaultNamespace?: string;
}

export interface ExtractedKey {
  key: string;                        // Fully resolved key (namespace + key)
  rawKey: string;                     // Raw literal written in source
  isDynamicPrefix: boolean;           // True for template literals like `errors.${code}`
  filePath: string;
  line: number;                       // 1-indexed
  column: number;                     // 1-indexed
}

export type DiagnosticType =
  | "UNUSED_KEY"
  | "MISSING_KEY"
  | "INTERPOLATION_MISMATCH"
  | "DYNAMIC_KEY_DETECTED";

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  type: DiagnosticType;
  severity: DiagnosticSeverity;
  key: string;
  locale?: string;
  message: string;
  expectedVars?: string[];
  actualVars?: string[];
  location?: {
    filePath: string;
    line: number;
    column: number;
  };
}

export interface LintReport {
  summary: {
    totalFilesScanned: number;
    totalKeysFound: number;
    unusedCount: number;
    missingCount: number;
    mismatchCount: number;
    dynamicCount: number;
    durationMs: number;
  };
  diagnostics: Diagnostic[];
}

export interface LocaleMap {
  [localeCode: string]: string;       // Raw JSON string content per locale
}

export interface FlattenedLocaleEntry {
  value: string;
  jsonPath: string[];
  line: number;
  column: number;
}

export interface FlattenedLocale {
  values: Record<string, string>;
  entries: Record<string, FlattenedLocaleEntry>;
}
