import {
  applyEdits,
  findNodeAtLocation,
  modify,
  parseTree,
  type FormattingOptions,
} from "jsonc-parser";
import { flattenLocale } from "../locales/flattener.js";

/**
 * Format-preserving JSON dead-key pruner powered by `jsonc-parser`.
 *
 * Accepts either dot-separated key strings or exact `jsonPath: readonly string[]` tuples.
 * When given string keys, resolves each key's exact `jsonPath: string[]` from `flattenLocale(rawJson)`
 * so keys containing literal dots (e.g. `"auth.v2": { "login.button": "Sign in" }`) are pruned accurately.
 * Also removes any parent objects that become empty (`{}`) after pruning.
 */
export function pruneUnusedKeys(
  rawJson: string,
  unusedKeys: ReadonlyArray<string | readonly string[]>,
  keySeparator = "."
): string {
  if (unusedKeys.length === 0) {
    return rawJson;
  }

  const formattingOptions = detectJsonFormatting(rawJson);
  const flattened = flattenLocale(rawJson, { keySeparator });

  // Resolve each unused item to its exact jsonPath: string[]
  const targetPaths: string[][] = [];
  for (const item of unusedKeys) {
    if (typeof item === "string") {
      const entry = flattened.entries[item];
      if (entry) {
        targetPaths.push([...entry.jsonPath]);
      } else {
        targetPaths.push(item.split(keySeparator));
      }
    } else if (Array.isArray(item) && item.length > 0) {
      targetPaths.push([...item]);
    }
  }

  let currentText = rawJson;

  for (const pathSegments of targetPaths) {
    if (pathSegments.length === 0) continue;

    const treeBefore = parseTree(currentText);
    if (!treeBefore || !findNodeAtLocation(treeBefore, pathSegments)) {
      continue;
    }

    const edits = modify(currentText, pathSegments, undefined, {
      formattingOptions,
    });
    if (edits.length > 0) {
      currentText = applyEdits(currentText, edits);
    }

    // Walk up parent path segments; if a parent object is now empty (`{}`), remove the parent property too
    for (let depth = pathSegments.length - 1; depth >= 1; depth--) {
      const parentPath = pathSegments.slice(0, depth);
      const tree = parseTree(currentText);
      if (!tree) break;

      const parentNode = findNodeAtLocation(tree, parentPath);
      if (
        parentNode &&
        parentNode.type === "object" &&
        (!parentNode.children || parentNode.children.length === 0)
      ) {
        const parentEdits = modify(currentText, parentPath, undefined, {
          formattingOptions,
        });
        if (parentEdits.length > 0) {
          currentText = applyEdits(currentText, parentEdits);
        }
      } else {
        break;
      }
    }
  }

  const rootAfter = parseTree(currentText);
  if (
    rootAfter &&
    rootAfter.type === "object" &&
    (!rootAfter.children || rootAfter.children.length === 0)
  ) {
    const trailingMatch = /(\r?\n)+$/.exec(rawJson);
    return `{}${trailingMatch ? trailingMatch[0] : ""}`;
  }

  return currentText;
}

export function detectJsonFormatting(rawJson: string): FormattingOptions {
  const eol = rawJson.includes("\r\n") ? "\r\n" : "\n";
  const lines = rawJson.split(/\r?\n/);

  for (const line of lines) {
    if (line.startsWith("\t")) {
      return {
        insertSpaces: false,
        tabSize: 1,
        eol,
      };
    }
    const spaceMatch = /^( +)\S/.exec(line);
    if (spaceMatch?.[1]) {
      return {
        insertSpaces: true,
        tabSize: spaceMatch[1].length,
        eol,
      };
    }
  }

  return {
    insertSpaces: true,
    tabSize: 2,
    eol,
  };
}
