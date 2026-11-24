import { readFile } from "node:fs/promises";
import { posix, relative, resolve } from "node:path";
import { glob } from "tinyglobby";
import {
  LocaleParseError,
  flattenLocale,
  type LintConfig,
  type LocaleMap,
} from "@locale-lint/core";

export interface DiscoveredSourceFile {
  filePath: string;           // Relative POSIX path from cwd
  absolutePath: string;
  content: string;
}

export interface DiscoveredLocaleFile {
  locale: string;             // e.g. "en"
  namespace?: string;         // e.g. "auth" when located at public/locales/en/auth.json
  filePath: string;           // Relative POSIX path from cwd
  absolutePath: string;
  rawContent: string;
}

export interface DiscoveredWorkspace {
  sourceFiles: DiscoveredSourceFile[];
  localeFiles: DiscoveredLocaleFile[];
  localeMap: LocaleMap;
  localeFilePaths: Record<string, string>;
  inferredDefaultNamespace?: string;
}

const SOURCE_IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.next/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/*.d.ts",
  "**/*.test.{ts,tsx,js,jsx}",
  "**/*.spec.{ts,tsx,js,jsx}",
];

/**
 * Discovers all source files and locale JSON files in the project.
 * Tracks `{ locale, namespace?, filePath, rawContent }` for every locale file
 * so namespaced directories (e.g. `public/locales/en/auth.json`) work seamlessly
 * for both `check` and `fix`.
 */
export async function discoverWorkspaceFiles(
  cwd: string,
  config: LintConfig
): Promise<DiscoveredWorkspace> {
  // 1. Discover source files across all configured srcDirs
  const sourcePatterns = config.srcDir.map((dir) => {
    const clean = toPosixPath(dir).replace(/\/+$/, "");
    return `${clean}/**/*.{ts,tsx,js,jsx}`;
  });

  const matchedSources = await glob(sourcePatterns, {
    cwd,
    ignore: SOURCE_IGNORE_PATTERNS,
    onlyFiles: true,
  });
  matchedSources.sort();

  const sourceFiles: DiscoveredSourceFile[] = [];
  for (const rel of matchedSources) {
    const posixRel = toPosixPath(rel);
    const abs = resolve(cwd, posixRel);
    const content = await readFile(abs, "utf8");
    sourceFiles.push({
      filePath: posixRel,
      absolutePath: abs,
      content,
    });
  }

  // 2. Discover locale JSON files inside config.localesDir
  const localesRootAbs = resolve(cwd, config.localesDir);
  const matchedLocales = await glob(["**/*.json"], {
    cwd: localesRootAbs,
    onlyFiles: true,
  });
  matchedLocales.sort();

  const localeFiles: DiscoveredLocaleFile[] = [];

  for (const relInsideLocales of matchedLocales) {
    const posixInside = toPosixPath(relInsideLocales);
    const segments = posixInside.split("/").filter(Boolean);
    if (segments.length === 0) continue;

    const abs = resolve(localesRootAbs, posixInside);
    const relFromCwd = toPosixPath(relative(cwd, abs));
    const rawContent = await readFile(abs, "utf8");

    // Validate JSON upfront using flattenLocale so malformed JSON throws LocaleParseError with exact filePath
    flattenLocale(rawContent, {
      keySeparator: config.keySeparator,
      filePath: relFromCwd,
    });

    if (segments.length === 1) {
      // Flat locale file: e.g. locales/en.json
      const fileName = segments[0]!;
      const locale = fileName.slice(0, -".json".length);
      localeFiles.push({
        locale,
        filePath: relFromCwd,
        absolutePath: abs,
        rawContent,
      });
    } else {
      // Namespaced locale file: e.g. public/locales/en/auth.json or public/locales/en/dashboard/header.json
      const locale = segments[0]!;
      const nsParts = segments.slice(1);
      const lastIdx = nsParts.length - 1;
      nsParts[lastIdx] = nsParts[lastIdx]!.slice(0, -".json".length);
      const namespace = nsParts.join(config.keySeparator);

      localeFiles.push({
        locale,
        namespace,
        filePath: relFromCwd,
        absolutePath: abs,
        rawContent,
      });
    }
  }

  // 3. Build unified LocaleMap per locale code
  const byLocale = new Map<string, DiscoveredLocaleFile[]>();
  for (const lf of localeFiles) {
    const list = byLocale.get(lf.locale) ?? [];
    list.push(lf);
    byLocale.set(lf.locale, list);
  }

  const localeMap: LocaleMap = {};
  const localeFilePaths: Record<string, string> = {};

  for (const [locale, files] of byLocale.entries()) {
    if (files.length === 1 && !files[0]!.namespace) {
      localeMap[locale] = files[0]!.rawContent;
      localeFilePaths[locale] = files[0]!.filePath;
    } else {
      // Combine namespaced JSON objects under their namespace keys
      const mergedRoot: Record<string, unknown> = {};
      for (const f of files) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(f.rawContent);
        } catch (err) {
          throw new LocaleParseError(
            err instanceof Error ? err.message : "Invalid JSON",
            0,
            f.filePath
          );
        }
        if (f.namespace) {
          setNestedNamespaceObject(
            mergedRoot,
            f.namespace.split(config.keySeparator),
            parsed
          );
        } else if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          Object.assign(mergedRoot, parsed);
        }
      }
      localeMap[locale] = JSON.stringify(mergedRoot, null, 2);
      localeFilePaths[locale] =
        files.length === 1
          ? files[0]!.filePath
          : `${toPosixPath(config.localesDir)}/${locale}`;
    }
  }

  const inferredDefaultNamespace = inferDefaultNamespace(localeFiles);

  return {
    sourceFiles,
    localeFiles,
    localeMap,
    localeFilePaths,
    inferredDefaultNamespace,
  };
}

function inferDefaultNamespace(
  localeFiles: readonly DiscoveredLocaleFile[]
): string | undefined {
  const hasUnnamespaced = localeFiles.some((f) => !f.namespace);
  if (hasUnnamespaced) {
    return undefined;
  }

  const namespaces = new Set<string>();
  for (const f of localeFiles) {
    if (f.namespace) {
      namespaces.add(f.namespace);
    }
  }

  if (namespaces.has("translation")) {
    return "translation";
  }
  if (namespaces.size === 1) {
    return Array.from(namespaces)[0];
  }
  if (namespaces.has("common")) {
    return "common";
  }
  return undefined;
}

/**
 * Given all unused key strings reported for a locale (e.g. `["auth.login", "common.save"]`)
 * and a specific `DiscoveredLocaleFile`, returns the local keys belonging to that file
 * with the file's `namespace` prefix stripped.
 */
export function resolveUnusedKeysForLocaleFile(
  unusedKeysForLocale: readonly string[],
  localeFile: DiscoveredLocaleFile,
  keySeparator = "."
): string[] {
  if (!localeFile.namespace) {
    return [...unusedKeysForLocale];
  }

  const prefix = `${localeFile.namespace}${keySeparator}`;
  const localKeys: string[] = [];

  for (const fullKey of unusedKeysForLocale) {
    if (fullKey.startsWith(prefix) && fullKey.length > prefix.length) {
      localKeys.push(fullKey.slice(prefix.length));
    }
  }

  return localKeys;
}

function setNestedNamespaceObject(
  target: Record<string, unknown>,
  pathSegments: readonly string[],
  value: unknown
): void {
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < pathSegments.length - 1; i++) {
    const seg = pathSegments[i]!;
    const existing = cursor[seg];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      cursor[seg] = {};
    }
    cursor = cursor[seg] as Record<string, unknown>;
  }
  const leaf = pathSegments[pathSegments.length - 1];
  if (leaf) {
    cursor[leaf] = value;
  }
}

function toPosixPath(p: string): string {
  return p.split("\\").join(posix.sep);
}
