import { describe, expect, it } from "vitest";
import { extractInterpolationVars } from "../../src/locales/interpolation.js";

describe("extractInterpolationVars", () => {
  it("extracts double-brace i18next variables including formatted and nested paths", () => {
    expect(
      extractInterpolationVars("Hello {{name}}, you have {{ count, number }} messages from {{user.sender}}.")
    ).toEqual(["count", "name", "user.sender"]);
  });

  it("extracts single-brace ICU variables and deduplicates them in sorted order", () => {
    expect(
      extractInterpolationVars("Welcome {firstName} {lastName}! Score: {score}, {firstName}")
    ).toEqual(["firstName", "lastName", "score"]);
  });

  it("handles mixed i18next {{var}} and ICU {var} without double-counting", () => {
    expect(extractInterpolationVars("Hello {{name}}, {count} items")).toEqual([
      "count",
      "name",
    ]);
  });

  it("extracts outer variable and inner branch variables from ICU plural and select blocks while ignoring #", () => {
    const icu =
      "{count, plural, =0 {No items for {user}} one {# item for {user}} other {# items in {cartName}}}";
    expect(extractInterpolationVars(icu)).toEqual(["cartName", "count", "user"]);
  });

  it("ignores escaped braces in ICU single quotes and backslash escapes", () => {
    expect(
      extractInterpolationVars("Literal '{ignored}' and \\{alsoIgnored\\} but real {activeVar}")
    ).toEqual(["activeVar"]);
  });
});
