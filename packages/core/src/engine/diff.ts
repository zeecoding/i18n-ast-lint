import {
  DEFAULT_LINT_CONFIG,
  type Diagnostic,
  type DiagnosticSeverity,
  type ExtractedKey,
  type FlattenedLocale,
  type LintConfig,
  type LintReport,
  type LocaleMap,
} from "../types.js";
import {
  flattenLocale,
  hasPluralVariantsInLocale,
  isPluralVariantOfUsedKey,
  stripPluralSuffix,
} from "../locales/flattener.js";
import { extractInterpolationVars } from "../locales/interpolation.js";

export interface AnalyzeMeta {
  totalFilesScanned?: number;
  durationMs?: number;
  localeFilePaths?: Record<string, string>;
}

/**
 * Compares extracted source translation keys against all discovered locale JSON files
 * and emits structured diagnostics (`UNUSED_KEY`, `MISSING_KEY`, `INTERPOLATION_MISMATCH`, `DYNAMIC_KEY_DETECTED`, `UNRESOLVED_KEY`).
 */
export function analyzeProject(
  extractedKeys: ExtractedKey[],
  locales: LocaleMap,
  config?: Partial<LintConfig>,
  meta?: AnalyzeMeta
): LintReport {
  const startTime = Date.now();
  const mergedConfig = mergeConfig(config);
  const localeCodes = Object.keys(locales).sort();
  const baseLocale = resolveBaseLocale(mergedConfig.baseLocale, localeCodes);

  // 1. Separate static keys, dynamic prefixes, and unresolved dynamic calls
  const usedKeys = new Set<string>();
  const protectedContextKeys = new Set<string>();
  const firstKeyLocation = new Map<
    string,
    { filePath: string; line: number; column: number }
  >();
  const dynamicPrefixes: string[] = [];
  const seenDynamicPrefixes = new Set<string>();
  const diagnostics: Diagnostic[] = [];

  for (const item of extractedKeys) {
    if (item.isUnresolved) {
      if (item.isDynamicPrefix && item.key) {
        if (!seenDynamicPrefixes.has(item.key)) {
          seenDynamicPrefixes.add(item.key);
          dynamicPrefixes.push(item.key);
        }
      }
      diagnostics.push({
        type: "UNRESOLVED_KEY",
        severity: "warning",
        key: item.rawKey,
        message: item.isDynamicPrefix
          ? `Unresolved dynamic translation argument "${item.rawKey}"; protected namespace prefix "${item.key}*".`
          : `Unresolved dynamic translation argument "${item.rawKey}" cannot be analyzed statically. Use --force with fix to prune anyway.`,
        location: {
          filePath: item.filePath,
          line: item.line,
          column: item.column,
        },
      });
    } else if (item.isDynamicPrefix) {
      if (!seenDynamicPrefixes.has(item.key)) {
        seenDynamicPrefixes.add(item.key);
        dynamicPrefixes.push(item.key);
      }
      diagnostics.push({
        type: "DYNAMIC_KEY_DETECTED",
        severity: "info",
        key: item.key,
        message: `Dynamic key prefix "${item.key}*" detected; matching keys in locale files are protected from pruning.`,
        location: {
          filePath: item.filePath,
          line: item.line,
          column: item.column,
        },
      });
    } else {
      usedKeys.add(item.key);
      if (item.context === "*") {
        const ctxPrefix = `${item.key}_`;
        if (!seenDynamicPrefixes.has(ctxPrefix)) {
          seenDynamicPrefixes.add(ctxPrefix);
          dynamicPrefixes.push(ctxPrefix);
        }
      } else if (item.context) {
        protectedContextKeys.add(`${item.key}_${item.context}`);
      }
      if (!firstKeyLocation.has(item.key)) {
        firstKeyLocation.set(item.key, {
          filePath: item.filePath,
          line: item.line,
          column: item.column,
        });
      }
    }
  }

  // 2. Flatten all locale JSON strings
  const flattened: Record<string, FlattenedLocale> = {};
  for (const code of localeCodes) {
    const raw = locales[code];
    if (raw === undefined) continue;
    flattened[code] = flattenLocale(raw, {
      keySeparator: mergedConfig.keySeparator,
      filePath: meta?.localeFilePaths?.[code] ?? `${code}.json`,
    });
  }

  const baseFlattened = baseLocale ? flattened[baseLocale] : undefined;
  const baseValues = baseFlattened?.values ?? {};

  const unusedSeverity: DiagnosticSeverity = mergedConfig.failOn.unused
    ? "error"
    : "warning";
  const missingSeverity: DiagnosticSeverity = mergedConfig.failOn.missing
    ? "error"
    : "warning";
  const mismatchSeverity: DiagnosticSeverity = mergedConfig.failOn.interpolationMismatch
    ? "error"
    : "warning";

  // 3. Unused Check across baseLocale and target locales
  const orderedLocales = baseLocale
    ? [baseLocale, ...localeCodes.filter((c) => c !== baseLocale)]
    : localeCodes;

  for (const localeCode of orderedLocales) {
    const loc = flattened[localeCode];
    if (!loc) continue;
    const localeFilePath =
      meta?.localeFilePaths?.[localeCode] ??
      `${mergedConfig.localesDir}/${localeCode}.json`;

    for (const [key, entry] of Object.entries(loc.entries)) {
      if (
        isKeyUsedOrProtected(
          key,
          usedKeys,
          protectedContextKeys,
          dynamicPrefixes,
          mergedConfig.ignoreKeys
        )
      ) {
        continue;
      }

      diagnostics.push({
        type: "UNUSED_KEY",
        severity: unusedSeverity,
        key,
        locale: localeCode,
        message: `Key "${key}" in locale "${localeCode}" is never referenced in source code.`,
        location: {
          filePath: localeFilePath,
          line: entry.line,
          column: entry.column,
        },
      });
    }
  }

  // 4. Missing Check
  if (baseLocale && baseFlattened) {
    // 4a. Check static keys referenced in source code but missing from baseLocale
    for (const usedKey of usedKeys) {
      if (matchesIgnorePatterns(usedKey, mergedConfig.ignoreKeys)) {
        continue;
      }
      const existsDirectly = Object.prototype.hasOwnProperty.call(baseValues, usedKey);
      const existsAsPlural = hasPluralVariantsInLocale(usedKey, baseValues);
      if (!existsDirectly && !existsAsPlural) {
        const loc = firstKeyLocation.get(usedKey);
        diagnostics.push({
          type: "MISSING_KEY",
          severity: missingSeverity,
          key: usedKey,
          locale: baseLocale,
          message: `Key "${usedKey}" is referenced in source code but missing from base locale "${baseLocale}".`,
          location: loc,
        });
      }
    }

    // 4b. Check keys present in baseLocale that are missing from target locales
    const targetLocales = localeCodes.filter((code) => code !== baseLocale);
    for (const targetCode of targetLocales) {
      const targetFlattened = flattened[targetCode];
      if (!targetFlattened) continue;
      const targetValues = targetFlattened.values;

      for (const [baseKey, baseEntry] of Object.entries(baseFlattened.entries)) {
        if (matchesIgnorePatterns(baseKey, mergedConfig.ignoreKeys)) {
          continue;
        }
        const existsInTarget = Object.prototype.hasOwnProperty.call(
          targetValues,
          baseKey
        );
        if (existsInTarget) continue;

        const pluralBase = stripPluralSuffix(baseKey);
        if (
          pluralBase &&
          !Object.prototype.hasOwnProperty.call(baseValues, pluralBase) &&
          hasPluralVariantsInLocale(pluralBase, targetValues) &&
          Object.prototype.hasOwnProperty.call(targetValues, baseKey)
        ) {
          continue;
        }

        const baseFilePath =
          meta?.localeFilePaths?.[baseLocale] ??
          `${mergedConfig.localesDir}/${baseLocale}.json`;

        diagnostics.push({
          type: "MISSING_KEY",
          severity: missingSeverity,
          key: baseKey,
          locale: targetCode,
          message: `Key "${baseKey}" is present in base locale "${baseLocale}" but missing in "${targetCode}".`,
          location: {
            filePath: baseFilePath,
            line: baseEntry.line,
            column: baseEntry.column,
          },
        });
      }
    }

    // 5. Interpolation Check between baseLocale and target locales
    for (const targetCode of targetLocales) {
      const targetFlattened = flattened[targetCode];
      if (!targetFlattened) continue;
      const targetFilePath =
        meta?.localeFilePaths?.[targetCode] ??
        `${mergedConfig.localesDir}/${targetCode}.json`;

      for (const [key, baseValue] of Object.entries(baseValues)) {
        if (matchesIgnorePatterns(key, mergedConfig.ignoreKeys)) {
          continue;
        }
        const targetEntry = targetFlattened.entries[key];
        if (!targetEntry) continue;

        const expectedVars = extractInterpolationVars(baseValue);
        const actualVars = extractInterpolationVars(targetEntry.value);

        if (!arraysEqual(expectedVars, actualVars)) {
          diagnostics.push({
            type: "INTERPOLATION_MISMATCH",
            severity: mismatchSeverity,
            key,
            locale: targetCode,
            message: `Interpolation mismatch for "${key}" in locale "${targetCode}": expected [${expectedVars.join(", ")}] (from "${baseLocale}") but found [${actualVars.join(", ")}].`,
            expectedVars,
            actualVars,
            location: {
              filePath: targetFilePath,
              line: targetEntry.line,
              column: targetEntry.column,
            },
          });
        }
      }
    }
  }

  let unusedCount = 0;
  let missingCount = 0;
  let mismatchCount = 0;
  let dynamicCount = 0;
  let unresolvedCount = 0;

  for (const d of diagnostics) {
    switch (d.type) {
      case "UNUSED_KEY":
        unusedCount++;
        break;
      case "MISSING_KEY":
        missingCount++;
        break;
      case "INTERPOLATION_MISMATCH":
        mismatchCount++;
        break;
      case "DYNAMIC_KEY_DETECTED":
        dynamicCount++;
        break;
      case "UNRESOLVED_KEY":
        unresolvedCount++;
        break;
    }
  }

  const durationMs = meta?.durationMs ?? Math.max(0, Date.now() - startTime);

  return {
    summary: {
      totalFilesScanned: meta?.totalFilesScanned ?? countUniqueFiles(extractedKeys),
      totalKeysFound: extractedKeys.length,
      unusedCount,
      missingCount,
      mismatchCount,
      dynamicCount,
      unresolvedCount,
      durationMs,
    },
    diagnostics,
  };
}

function isKeyUsedOrProtected(
  key: string,
  usedKeys: ReadonlySet<string>,
  protectedContextKeys: ReadonlySet<string>,
  dynamicPrefixes: readonly string[],
  ignoreKeys: readonly string[]
): boolean {
  if (usedKeys.has(key)) return true;
  if (protectedContextKeys.has(key)) return true;
  if (isPluralVariantOfUsedKey(key, usedKeys)) return true;
  if (isPluralVariantOfUsedKey(key, protectedContextKeys)) return true;

  for (const prefix of dynamicPrefixes) {
    if (key.startsWith(prefix)) {
      return true;
    }
    const strippedKey = stripPluralSuffix(key);
    if (strippedKey && strippedKey.startsWith(prefix)) {
      return true;
    }
  }

  if (matchesIgnorePatterns(key, ignoreKeys)) {
    return true;
  }

  return false;
}

export function matchesIgnorePatterns(
  key: string,
  patterns: readonly string[]
): boolean {
  for (const pattern of patterns) {
    if (!pattern) continue;
    if (pattern === key) return true;
    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      if (key.startsWith(prefix)) return true;
    } else if (key.startsWith(`${pattern}.`)) {
      return true;
    }
  }
  return false;
}

function mergeConfig(partial?: Partial<LintConfig>): LintConfig {
  return {
    baseLocale: partial?.baseLocale ?? DEFAULT_LINT_CONFIG.baseLocale,
    localesDir: partial?.localesDir ?? DEFAULT_LINT_CONFIG.localesDir,
    srcDir: partial?.srcDir ?? DEFAULT_LINT_CONFIG.srcDir,
    namespaceSeparator:
      partial?.namespaceSeparator ?? DEFAULT_LINT_CONFIG.namespaceSeparator,
    keySeparator: partial?.keySeparator ?? DEFAULT_LINT_CONFIG.keySeparator,
    ignoreKeys: partial?.ignoreKeys ?? DEFAULT_LINT_CONFIG.ignoreKeys,
    failOn: {
      unused: partial?.failOn?.unused ?? DEFAULT_LINT_CONFIG.failOn.unused,
      missing: partial?.failOn?.missing ?? DEFAULT_LINT_CONFIG.failOn.missing,
      interpolationMismatch:
        partial?.failOn?.interpolationMismatch ??
        DEFAULT_LINT_CONFIG.failOn.interpolationMismatch,
    },
  };
}

function resolveBaseLocale(
  configuredBase: string,
  availableLocales: readonly string[]
): string | undefined {
  if (availableLocales.length === 0) return undefined;
  if (availableLocales.includes(configuredBase)) return configuredBase;
  if (availableLocales.includes("en")) return "en";
  return availableLocales[0];
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function countUniqueFiles(keys: readonly ExtractedKey[]): number {
  const files = new Set<string>();
  for (const k of keys) {
    files.add(k.filePath);
  }
  return files.size;
}
