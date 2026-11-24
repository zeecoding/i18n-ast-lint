import { parseTree, printParseErrorCode, type Node as JsonNode, type ParseError } from "jsonc-parser";
import type { FlattenedLocale, FlattenedLocaleEntry } from "../types.js";

export interface FlattenOptions {
  keySeparator?: string;
  filePath?: string;
}

const PLURAL_SUFFIXES = [
  "_zero",
  "_one",
  "_two",
  "_few",
  "_many",
  "_other",
  "_0",
  "_1",
  "_2",
  "_3",
  "_4",
  "_5",
  "_ordinal_zero",
  "_ordinal_one",
  "_ordinal_two",
  "_ordinal_few",
  "_ordinal_many",
  "_ordinal_other",
] as const;

export class LocaleParseError extends Error {
  public readonly filePath?: string;
  public readonly offset: number;

  constructor(message: string, offset: number, filePath?: string) {
    super(message);
    this.name = "LocaleParseError";
    this.offset = offset;
    this.filePath = filePath;
  }
}

/**
 * Recursively flattens a raw JSON locale string into dot-notation keys while
 * storing the exact `jsonPath: string[]` and 1-indexed line/column for each leaf entry.
 */
export function flattenLocale(
  rawJson: string,
  options?: FlattenOptions
): FlattenedLocale {
  const keySeparator = options?.keySeparator ?? ".";
  const errors: ParseError[] = [];
  const root = parseTree(rawJson, errors, {
    allowTrailingComma: false,
    disallowComments: true,
  });

  if (errors.length > 0 || !root || root.type !== "object") {
    const firstError = errors[0];
    const errDesc = firstError
      ? `${printParseErrorCode(firstError.error)} at offset ${firstError.offset}`
      : "Root JSON value must be an object";
    const fileLabel = options?.filePath ? ` in ${options.filePath}` : "";
    throw new LocaleParseError(
      `Invalid JSON syntax${fileLabel}: ${errDesc}`,
      firstError?.offset ?? 0,
      options?.filePath
    );
  }

  const lineStarts = computeLineStarts(rawJson);
  const values: Record<string, string> = {};
  const entries: Record<string, FlattenedLocaleEntry> = {};

  function walkObject(node: JsonNode, currentPath: string[]): void {
    if (!node.children) return;

    for (const propNode of node.children) {
      if (propNode.type !== "property" || !propNode.children || propNode.children.length < 2) {
        continue;
      }

      const keyNode = propNode.children[0];
      const valNode = propNode.children[1];
      if (!keyNode || !valNode) continue;

      const segment = String(keyNode.value ?? "");
      const nextPath = [...currentPath, segment];

      if (valNode.type === "object") {
        walkObject(valNode, nextPath);
      } else if (
        valNode.type === "string" ||
        valNode.type === "number" ||
        valNode.type === "boolean"
      ) {
        const flatKey = nextPath.join(keySeparator);
        const strValue = String(valNode.value ?? "");
        const { line, column } = offsetToLineColumn(keyNode.offset, lineStarts);
        const entry: FlattenedLocaleEntry = {
          value: strValue,
          jsonPath: nextPath,
          line,
          column,
        };
        values[flatKey] = strValue;
        entries[flatKey] = entry;
      }
    }
  }

  walkObject(root, []);
  return { values, entries };
}

/**
 * Strips a known plural suffix from a key if present.
 * E.g. `cart.items_one` -> `cart.items`, `cart.items_other` -> `cart.items`.
 */
export function stripPluralSuffix(key: string): string | undefined {
  for (const suffix of PLURAL_SUFFIXES) {
    if (key.endsWith(suffix) && key.length > suffix.length) {
      return key.slice(0, -suffix.length);
    }
  }
  return undefined;
}

/**
 * Checks whether `candidateKey` is a plural variant (e.g. `items_one`, `items_other`)
 * of any key in `usedKeys`.
 */
export function isPluralVariantOfUsedKey(
  candidateKey: string,
  usedKeys: ReadonlySet<string>
): boolean {
  const baseKey = stripPluralSuffix(candidateKey);
  if (!baseKey) return false;
  return usedKeys.has(baseKey);
}

/**
 * Checks whether a base key (e.g. `cart.items`) is satisfied by plural variant keys
 * (e.g. `cart.items_one` / `cart.items_other`) inside a locale map.
 */
export function hasPluralVariantsInLocale(
  baseKey: string,
  localeValues: Readonly<Record<string, string>>
): boolean {
  for (const suffix of PLURAL_SUFFIXES) {
    if (Object.prototype.hasOwnProperty.call(localeValues, `${baseKey}${suffix}`)) {
      return true;
    }
  }
  return false;
}

function computeLineStarts(text: string): number[] {
  const starts: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      starts.push(i + 1);
    }
  }
  return starts;
}

function offsetToLineColumn(
  offset: number,
  lineStarts: readonly number[]
): { line: number; column: number } {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    const midStart = lineStarts[mid] ?? 0;
    if (midStart <= offset) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  const lineIndex = Math.max(0, high);
  const lineStart = lineStarts[lineIndex] ?? 0;
  return {
    line: lineIndex + 1,
    column: offset - lineStart + 1,
  };
}
