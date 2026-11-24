export {
  DEFAULT_LINT_CONFIG,
  type Diagnostic,
  type DiagnosticSeverity,
  type DiagnosticType,
  type ExtractedKey,
  type FlattenedLocale,
  type FlattenedLocaleEntry,
  type LintConfig,
  type LintReport,
  type LocaleMap,
  type ScanOptions,
} from "./types.js";

export { inferScriptKind, scanSource } from "./ast/scanner.js";
export { ScopeTracker, type ScopeBinding, type TranslationFnKind } from "./ast/scope.js";
export {
  extractFromCallExpression,
  extractFromJsxElement,
  normalizeScannerOptions,
  resolveKeyWithNamespace,
  type ResolvedScannerOptions,
} from "./ast/extractors.js";

export {
  LocaleParseError,
  flattenLocale,
  hasPluralVariantsInLocale,
  isPluralVariantOfUsedKey,
  stripPluralSuffix,
  type FlattenOptions,
} from "./locales/flattener.js";
export { extractInterpolationVars } from "./locales/interpolation.js";

export {
  analyzeProject,
  matchesIgnorePatterns,
  type AnalyzeMeta,
} from "./engine/diff.js";
export { detectJsonFormatting, pruneUnusedKeys } from "./engine/fixer.js";
