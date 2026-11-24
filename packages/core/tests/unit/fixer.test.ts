import { describe, expect, it } from "vitest";
import { pruneUnusedKeys } from "../../src/engine/fixer.js";

describe("pruneUnusedKeys", () => {
  it("surgically removes unused keys and empty parent objects while preserving 4-space indentation", () => {
    const input = [
      "{",
      '    "common": {',
      '        "save": "Save",',
      '        "deadKey": "Remove me",',
      '        "cancel": "Cancel"',
      "    },",
      '    "orphanedSection": {',
      '        "deep": {',
      '            "unusedLeaf": "Gone"',
      "        }",
      "    },",
      '    "footer": {',
      '        "copyright": "2026"',
      "    }",
      "}",
      "",
    ].join("\n");

    const output = pruneUnusedKeys(input, [
      "common.deadKey",
      "orphanedSection.deep.unusedLeaf",
    ]);

    const expected = [
      "{",
      '    "common": {',
      '        "save": "Save",',
      '        "cancel": "Cancel"',
      "    },",
      '    "footer": {',
      '        "copyright": "2026"',
      "    }",
      "}",
      "",
    ].join("\n");

    expect(output).toBe(expected);
  });

  it("accurately prunes keys containing literal dots via exact jsonPath lookup or explicit jsonPath array", () => {
    const input = [
      "{",
      '  "auth.v2": {',
      '    "login.btn": "Log in",',
      '    "logout.btn": "Log out"',
      "  }",
      "}",
    ].join("\n");

    // String lookup uses flattenLocale's stored jsonPath ["auth.v2", "logout.btn"]
    const afterFirst = pruneUnusedKeys(input, ["auth.v2.logout.btn"]);
    expect(afterFirst).toBe(
      [
        "{",
        '  "auth.v2": {',
        '    "login.btn": "Log in"',
        "  }",
        "}",
      ].join("\n")
    );

    // Direct jsonPath array also works and removes the now-empty "auth.v2" parent object
    const afterSecond = pruneUnusedKeys(afterFirst, [["auth.v2", "login.btn"]]);
    expect(afterSecond).toBe("{}");
  });

  it("preserves tab indentation and CRLF line endings when present", () => {
    const input = "{\r\n\t\"a\": \"Keep\",\r\n\t\"b\": \"Delete\"\r\n}\r\n";
    const output = pruneUnusedKeys(input, ["b"]);
    expect(output).toBe("{\r\n\t\"a\": \"Keep\"\r\n}\r\n");
  });
});
