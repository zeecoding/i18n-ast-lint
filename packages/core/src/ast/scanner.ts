import ts from "typescript";
import type { ExtractedKey, ScanOptions } from "../types.js";
import {
  extractFromCallExpression,
  extractFromJsxElement,
  normalizeScannerOptions,
} from "./extractors.js";
import { ScopeTracker } from "./scope.js";

/**
 * Infers TypeScript `ScriptKind` from a file path extension.
 * Defaults to `ts.ScriptKind.TSX` if unknown.
 */
export function inferScriptKind(filePath: string): ts.ScriptKind {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (lower.endsWith(".ts") || lower.endsWith(".mts") || lower.endsWith(".cts")) {
    return ts.ScriptKind.TS;
  }
  if (lower.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TSX;
}

function isFunctionScopeBoundary(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    ts.isMethodDeclaration(node)
  );
}

/**
 * Scans a TypeScript/JavaScript/JSX/TSX source string using the TypeScript Compiler API
 * and returns all extracted translation keys and dynamic prefixes.
 */
export function scanSource(
  code: string,
  filePath: string,
  options?: ScanOptions
): ExtractedKey[] {
  const scriptKind = inferScriptKind(filePath);
  const sourceFile = ts.createSourceFile(
    filePath,
    code,
    ts.ScriptTarget.Latest,
    true,
    scriptKind
  );

  const resolvedOptions = normalizeScannerOptions(options);
  const scope = new ScopeTracker();
  const extracted: ExtractedKey[] = [];

  function visit(node: ts.Node): void {
    const pushedScope = isFunctionScopeBoundary(node);
    if (pushedScope) {
      scope.pushScope();
    }

    if (ts.isVariableDeclaration(node)) {
      scope.inspectVariableDeclaration(node);
    } else if (ts.isCallExpression(node)) {
      const hit = extractFromCallExpression(
        node,
        sourceFile,
        filePath,
        scope,
        resolvedOptions
      );
      if (hit) {
        extracted.push(hit);
      }
    } else if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const hit = extractFromJsxElement(
        node,
        sourceFile,
        filePath,
        scope,
        resolvedOptions
      );
      if (hit) {
        extracted.push(hit);
      }
    }

    ts.forEachChild(node, visit);

    if (pushedScope) {
      scope.popScope();
    }
  }

  visit(sourceFile);
  return extracted;
}
