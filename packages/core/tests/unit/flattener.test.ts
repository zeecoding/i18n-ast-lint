import { describe, expect, it } from "vitest";
import {
  LocaleParseError,
  flattenLocale,
  hasPluralVariantsInLocale,
  isPluralVariantOfUsedKey,
  stripPluralSuffix,
} from "../../src/locales/flattener.js";

describe("flattenLocale", () => {
  it("flattens nested JSON objects and stores exact jsonPath and line/column locations", () => {
    const raw = [
      "{",
      '  "auth": {',
      '    "login": "Sign in",',
      '    "nested": {',
      '      "cta": "Continue"',
      "    }",
      "  },",
      '  "auth.v2": {',
      '    "login.btn": "Log in v2"',
      "  }",
      "}",
    ].join("\n");

    const flattened = flattenLocale(raw);

    expect(flattened.values).toEqual({
      "auth.login": "Sign in",
      "auth.nested.cta": "Continue",
      "auth.v2.login.btn": "Log in v2",
    });

    expect(flattened.entries["auth.login"]).toEqual({
      value: "Sign in",
      jsonPath: ["auth", "login"],
      line: 3,
      column: 5,
    });

    // Keys containing literal dots keep their exact 2-segment jsonPath
    expect(flattened.entries["auth.v2.login.btn"]).toEqual({
      value: "Log in v2",
      jsonPath: ["auth.v2", "login.btn"],
      line: 9,
      column: 5,
    });
  });

  it("throws LocaleParseError on invalid JSON syntax", () => {
    const malformed = '{ "auth": { "login": "Sign in", } }';
    expect(() => flattenLocale(malformed, { filePath: "locales/en.json" })).toThrowError(
      LocaleParseError
    );
  });

  it("identifies plural suffixes and links plural variants to used base keys", () => {
    const usedKeys = new Set(["cart.items", "notifications.count"]);

    expect(stripPluralSuffix("cart.items_one")).toBe("cart.items");
    expect(stripPluralSuffix("cart.items_other")).toBe("cart.items");
    expect(stripPluralSuffix("cart.items_zero")).toBe("cart.items");
    expect(stripPluralSuffix("cart.items")).toBeUndefined();

    expect(isPluralVariantOfUsedKey("cart.items_one", usedKeys)).toBe(true);
    expect(isPluralVariantOfUsedKey("cart.items_other", usedKeys)).toBe(true);
    expect(isPluralVariantOfUsedKey("cart.other_key_one", usedKeys)).toBe(false);

    const localeValues = {
      "cart.items_one": "{{count}} item",
      "cart.items_other": "{{count}} items",
    };
    expect(hasPluralVariantsInLocale("cart.items", localeValues)).toBe(true);
    expect(hasPluralVariantsInLocale("cart.empty", localeValues)).toBe(false);
  });
});
