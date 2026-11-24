import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DEFAULT_LINT_CONFIG, type LintConfig } from "@locale-lint/core";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface CliFlagOverrides {
  configPath?: string;
  localesDir?: string;
  srcDir?: string | string[];
  baseLocale?: string;
}

const STANDARD_LOCALE_DIRS = [
  "locales",
  "public/locales",
  "messages",
  "src/locales",
  "src/messages",
  "app/locales",
];

const STANDARD_SRC_DIRS = ["src", "app", "pages", "components"];

const DEFAULT_CONFIG_FILES = [
  "i18n-ast-lint.config.json",
  "i18n-ast-lint.config.mjs",
  "i18n-ast-lint.config.js",
  "locale-lint.config.json",
  "locale-lint.config.mjs",
  "locale-lint.config.js",
];

/**
 * Helper for user config files (`i18n-ast-lint.config.mjs` / `.js`).
 */
export function defineConfig(config: Partial<LintConfig>): Partial<LintConfig> {
  return config;
}

/**
 * Resolves the effective `LintConfig` by combining:
 * 1. Zero-config directory and baseLocale auto-detection
 * 2. Optional config file (`i18n-ast-lint.config.json` / `.mjs` / `.js` or `--config <path>`)
 * 3. Explicit CLI flag overrides (`--locales`, `--src`, `--base`)
 */
export async function resolveConfig(
  cwd: string,
  overrides?: CliFlagOverrides
): Promise<LintConfig> {
  const fileConfig = await loadConfigFile(cwd, overrides?.configPath);

  const localesDir =
    overrides?.localesDir ??
    fileConfig.localesDir ??
    detectLocalesDir(cwd) ??
    DEFAULT_LINT_CONFIG.localesDir;

  const fullLocalesPath = resolve(cwd, localesDir);
  if (!existsSync(fullLocalesPath)) {
    throw new ConfigError(
      `Locales directory not found: "${localesDir}" (resolved to ${fullLocalesPath})`
    );
  }

  const srcDir = normalizeSrcDirs(
    overrides?.srcDir ?? fileConfig.srcDir ?? detectSrcDirs(cwd)
  );

  for (const dir of srcDir) {
    const fullSrcPath = resolve(cwd, dir);
    if (!existsSync(fullSrcPath)) {
      throw new ConfigError(
        `Source directory not found: "${dir}" (resolved to ${fullSrcPath})`
      );
    }
  }

  const baseLocale =
    overrides?.baseLocale ??
    fileConfig.baseLocale ??
    (await inferBaseLocale(fullLocalesPath)) ??
    DEFAULT_LINT_CONFIG.baseLocale;

  return {
    baseLocale,
    localesDir,
    srcDir,
    namespaceSeparator:
      fileConfig.namespaceSeparator ?? DEFAULT_LINT_CONFIG.namespaceSeparator,
    keySeparator: fileConfig.keySeparator ?? DEFAULT_LINT_CONFIG.keySeparator,
    ignoreKeys: fileConfig.ignoreKeys ?? DEFAULT_LINT_CONFIG.ignoreKeys,
    failOn: {
      unused: fileConfig.failOn?.unused ?? DEFAULT_LINT_CONFIG.failOn.unused,
      missing: fileConfig.failOn?.missing ?? DEFAULT_LINT_CONFIG.failOn.missing,
      interpolationMismatch:
        fileConfig.failOn?.interpolationMismatch ??
        DEFAULT_LINT_CONFIG.failOn.interpolationMismatch,
    },
  };
}

function detectLocalesDir(cwd: string): string | undefined {
  for (const candidate of STANDARD_LOCALE_DIRS) {
    if (existsSync(resolve(cwd, candidate))) {
      return candidate;
    }
  }
  return undefined;
}

function detectSrcDirs(cwd: string): string[] {
  const found: string[] = [];
  for (const candidate of STANDARD_SRC_DIRS) {
    if (existsSync(resolve(cwd, candidate))) {
      found.push(candidate);
    }
  }
  return found.length > 0 ? found : [...DEFAULT_LINT_CONFIG.srcDir];
}

function normalizeSrcDirs(input: string | string[]): string[] {
  if (typeof input === "string") {
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return input.length > 0 ? input : [...DEFAULT_LINT_CONFIG.srcDir];
}

async function inferBaseLocale(fullLocalesPath: string): Promise<string | undefined> {
  try {
    const entries = await readdir(fullLocalesPath, { withFileTypes: true });
    const codes: string[] = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
        codes.push(entry.name.slice(0, -".json".length));
      } else if (entry.isDirectory()) {
        codes.push(entry.name);
      }
    }

    if (codes.length === 0) return undefined;
    codes.sort();
    if (codes.includes("en")) return "en";
    const enVariant = codes.find((c) => c.toLowerCase().startsWith("en"));
    return enVariant ?? codes[0];
  } catch {
    return undefined;
  }
}

async function loadConfigFile(
  cwd: string,
  explicitPath?: string
): Promise<Partial<LintConfig>> {
  let targetPath: string | undefined;

  if (explicitPath) {
    targetPath = resolve(cwd, explicitPath);
    if (!existsSync(targetPath)) {
      throw new ConfigError(`Config file not found at "${explicitPath}"`);
    }
  } else {
    for (const fileName of DEFAULT_CONFIG_FILES) {
      const candidate = resolve(cwd, fileName);
      if (existsSync(candidate)) {
        targetPath = candidate;
        break;
      }
    }
  }

  if (!targetPath) {
    return {};
  }

  const ext = extname(targetPath).toLowerCase();

  try {
    if (ext === ".json") {
      const raw = await readFile(targetPath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      validateConfigObject(parsed, targetPath);
      return parsed;
    }

    if (ext === ".mjs" || ext === ".js") {
      const fileUrl = `${pathToFileURL(targetPath).href}?t=${Date.now()}`;
      const mod = (await import(fileUrl)) as { default?: unknown };
      const exported = mod.default ?? mod;
      validateConfigObject(exported, targetPath);
      return exported;
    }

    throw new ConfigError(
      `Unsupported config file extension "${ext}" in ${targetPath}. Supported extensions: .json, .mjs, .js`
    );
  } catch (err) {
    if (err instanceof ConfigError) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new ConfigError(`Failed to load config file "${targetPath}": ${msg}`);
  }
}

function validateConfigObject(
  value: unknown,
  filePath: string
): asserts value is Partial<LintConfig> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ConfigError(`Config file "${filePath}" must export a configuration object.`);
  }
  const obj = value as Record<string, unknown>;
  if (obj.baseLocale !== undefined && typeof obj.baseLocale !== "string") {
    throw new ConfigError(`Invalid "baseLocale" in ${filePath}: expected string.`);
  }
  if (obj.localesDir !== undefined && typeof obj.localesDir !== "string") {
    throw new ConfigError(`Invalid "localesDir" in ${filePath}: expected string.`);
  }
  if (
    obj.srcDir !== undefined &&
    (!Array.isArray(obj.srcDir) || !obj.srcDir.every((s) => typeof s === "string"))
  ) {
    throw new ConfigError(`Invalid "srcDir" in ${filePath}: expected string[].`);
  }
}
