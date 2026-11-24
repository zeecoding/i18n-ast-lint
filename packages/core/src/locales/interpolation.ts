/**
 * Extracts sorted unique interpolation placeholder variable names from a translation string.
 *
 * Supports:
 * 1. i18next double-brace syntax: `{{name}}`, `{{ count, number }}`, `{{user.firstName}}`
 * 2. ICU / next-intl / react-intl single-brace syntax: `{name}`, `{count, plural, one {# item} other {# items}}`
 *
 * Ignores escaped braces (`\{var\}`, `'{var}'`) and ICU inner `#` tokens.
 */
export function extractInterpolationVars(translation: string): string[] {
  if (!translation || !translation.includes("{")) {
    return [];
  }

  // Strip ICU quoted literal segments like '{notAVar}' (ignoring doubled '')
  const withoutQuotedLiterals = stripIcuQuotedLiterals(translation);
  // Strip backslash-escaped braces \{ and \}
  const sanitized = withoutQuotedLiterals.replace(/\\[{}]/g, "  ");

  const vars = new Set<string>();

  // 1. Extract double-brace i18next placeholders: {{ varName }} or {{ varName, format }}
  const doubleBraceRegex = /\{\{\s*([a-zA-Z0-9_.-]+)\s*(?:,[^}]*)?\}\}/g;
  let working = sanitized.replace(doubleBraceRegex, (_match, varName: string) => {
    const clean = varName.trim();
    if (clean.length > 0) {
      vars.add(clean);
    }
    return " ";
  });

  // 2. Extract single-brace ICU placeholders (including nested plural/select blocks)
  extractIcuVariables(working, vars);

  return Array.from(vars).sort();
}

function stripIcuQuotedLiterals(input: string): string {
  let result = "";
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === "'") {
      const next = input[i + 1];
      if (next === "'") {
        // Escaped single quote ''
        result += "  ";
        i += 2;
        continue;
      }
      if (next === "{" || next === "}") {
        // ICU quoted escape starts here until closing single quote or end of string
        i++;
        while (i < input.length) {
          if (input[i] === "'" && input[i + 1] === "'") {
            i += 2;
            continue;
          }
          if (input[i] === "'") {
            i++;
            break;
          }
          i++;
        }
        continue;
      }
    }
    result += ch;
    i++;
  }
  return result;
}

const ICU_SIMPLE_OR_HEADER_REGEX = /^\{\s*([a-zA-Z0-9_]+)\s*(?:,([\s\S]*))?\}$/;

function extractIcuVariables(text: string, vars: Set<string>): void {
  let i = 0;
  while (i < text.length) {
    if (text[i] === "{") {
      const end = findMatchingClosingBrace(text, i);
      if (end === -1) {
        break;
      }
      const block = text.slice(i, end + 1);
      parseIcuBlock(block, vars);
      i = end + 1;
    } else {
      i++;
    }
  }
}

function parseIcuBlock(block: string, vars: Set<string>): void {
  const match = ICU_SIMPLE_OR_HEADER_REGEX.exec(block);
  if (!match) return;

  const varName = match[1];
  const rest = match[2];

  if (varName) {
    vars.add(varName);
  }

  if (rest) {
    // Could be `{count, plural, one {# item with {otherVar}} other {# items}}`
    // Scan nested blocks inside `rest`, skipping the option selector headers (e.g. `one {...}`)
    scanIcuComplexBody(rest, vars);
  }
}

function scanIcuComplexBody(rest: string, vars: Set<string>): void {
  // Find comma after format type (e.g. `plural, ...` or `select, ...` or `selectordinal, ...`)
  const firstComma = rest.indexOf(",");
  if (firstComma === -1) return;

  const formatType = rest.slice(0, firstComma).trim().toLowerCase();
  if (
    formatType !== "plural" &&
    formatType !== "select" &&
    formatType !== "selectordinal"
  ) {
    return;
  }

  const branchesText = rest.slice(firstComma + 1);
  let i = 0;
  while (i < branchesText.length) {
    if (branchesText[i] === "{") {
      const end = findMatchingClosingBrace(branchesText, i);
      if (end === -1) break;
      // The content inside a plural/select case branch `{# items for {user}}` is message text, not a variable header itself
      const branchInner = branchesText.slice(i + 1, end);
      extractIcuVariables(branchInner, vars);
      i = end + 1;
    } else {
      i++;
    }
  }
}

function findMatchingClosingBrace(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}
