import { describe, expect, it } from "vitest";
import {
  analyzeProject,
  pruneUnusedKeys,
  scanSource,
} from "../../src/index.js";

describe("Adversarial Regression Suite (TRD Section 6 + Real-World Edge Cases)", () => {
  it("1. Issue #34 (JSX <Trans>): extracts multi-line <Trans> with nested HTML and JSX expression attributes with zero false positives", () => {
    const code = `
      import React from "react";
      import { Trans } from "react-i18next";
      import { FormattedMessage } from "react-intl";

      export function LegalFooter() {
        return (
          <div>
            <Trans
              i18nKey="auth.terms"
            >
              Read our <a href="/terms">terms of service</a> carefully.
            </Trans>
            <Trans i18nKey={"auth.privacy"} ns="legal" />
            <FormattedMessage id="footer.contact" />
          </div>
        );
      }
    `;

    const extracted = scanSource(code, "src/LegalFooter.tsx");
    const keys = extracted.map((k) => k.key);

    expect(keys).toEqual([
      "auth.terms",
      "legal.auth.privacy",
      "footer.contact",
    ]);
  });

  it("2. Issue #18 (Scoped Namespaces): resolves multiple useTranslation hooks, aliased destructuring, next-intl useTranslations, and colon namespace overrides without collision", () => {
    const code = `
      import { useTranslation } from "react-i18next";
      import { useTranslations } from "next-intl";

      export function AccountHeader() {
        const { t } = useTranslation("auth");
        const { t: tCommon } = useTranslation(["common", "fallback"]);
        const tHeader = useTranslations("Dashboard.Header");

        return (
          <header>
            <h1>{tHeader("title")}</h1>
            <button>{t("login")}</button>
            <button>{tCommon("cancel")}</button>
            <span>{t("common:override")}</span>
          </header>
        );
      }
    `;

    const extracted = scanSource(code, "src/AccountHeader.tsx");
    expect(extracted.map((k) => k.key)).toEqual([
      "Dashboard.Header.title",
      "auth.login",
      "common.cancel",
      "common.override",
    ]);
  });

  it("3. Issue #42 (Comments & URLs): ignores single-line and block comments while preserving extraction after https:// URLs", () => {
    const code = `
      import { useTranslation } from "react-i18next";

      // t('commented.single_line')
      /*
        t('commented.block_comment')
        <Trans i18nKey="commented.jsx_trans" />
      */
      export function ApiBanner() {
        const { t } = useTranslation("banner");
        const docsUrl = "https://example.com/api//v1?query=1";
        const backupUrl = \`https://cdn.example.com/assets\`;
        return <a href={docsUrl}>{t("real.key")}</a>;
      }
    `;

    const extracted = scanSource(code, "src/ApiBanner.tsx");
    expect(extracted.map((k) => k.key)).toEqual(["banner.real.key"]);
  });

  it("4. Dynamic Prefix Protection: t(`errors.${errCode}`) emits DYNAMIC_KEY_DETECTED and protects matching keys from UNUSED_KEY and --fix deletion", () => {
    const code = `
      import { useTranslation } from "react-i18next";

      export function ErrorAlert({ errCode }: { errCode: string }) {
        const { t } = useTranslation();
        return <div>{t(\`errors.\${errCode}\`)}</div>;
      }
    `;

    const extracted = scanSource(code, "src/ErrorAlert.tsx");
    expect(extracted).toHaveLength(1);
    expect(extracted[0]).toMatchObject({
      key: "errors.",
      isDynamicPrefix: true,
    });

    const enJson = JSON.stringify(
      {
        errors: {
          not_found: "Resource not found",
          timeout: "Request timed out",
        },
        unused: {
          dead_banner: "Old promo banner",
        },
      },
      null,
      2
    );

    const report = analyzeProject(extracted, { en: enJson });

    const unusedDiagnostics = report.diagnostics.filter((d) => d.type === "UNUSED_KEY");
    const dynamicDiagnostics = report.diagnostics.filter(
      (d) => d.type === "DYNAMIC_KEY_DETECTED"
    );

    expect(dynamicDiagnostics).toHaveLength(1);
    expect(dynamicDiagnostics[0]?.key).toBe("errors.");

    // errors.not_found and errors.timeout are protected; only unused.dead_banner is flagged
    expect(unusedDiagnostics.map((d) => d.key)).toEqual(["unused.dead_banner"]);

    const pruned = pruneUnusedKeys(
      enJson,
      unusedDiagnostics.map((d) => d.key)
    );
    const parsedPruned = JSON.parse(pruned) as Record<string, unknown>;
    expect(parsedPruned).toEqual({
      errors: {
        not_found: "Resource not found",
        timeout: "Request timed out",
      },
    });
  });

  it("5. Plural Variant Protection: calling t('cart.items', { count }) protects cart.items_one and cart.items_other", () => {
    const code = `
      import { useTranslation } from "react-i18next";
      export function CartBadge({ count }: { count: number }) {
        const { t } = useTranslation();
        return <span>{t("cart.items", { count })}</span>;
      }
    `;

    const extracted = scanSource(code, "src/CartBadge.tsx");
    const enJson = JSON.stringify({
      cart: {
        items_zero: "No items",
        items_one: "{{count}} item",
        items_other: "{{count}} items",
        abandoned_label: "Unused label",
      },
    });

    const report = analyzeProject(extracted, { en: enJson });
    const unusedKeys = report.diagnostics
      .filter((d) => d.type === "UNUSED_KEY")
      .map((d) => d.key);
    const missingKeys = report.diagnostics
      .filter((d) => d.type === "MISSING_KEY")
      .map((d) => d.key);

    expect(unusedKeys).toEqual(["cart.abandoned_label"]);
    expect(missingKeys).toEqual([]);
  });

  it("6. Interpolation Mismatch: detects placeholder typos across both {{var}} (i18next) and {var} (ICU)", () => {
    const code = `
      export function Greeting() {
        return <div>{t("greeting.summary")}</div>;
      }
    `;
    const extracted = scanSource(code, "src/Greeting.tsx");

    const locales = {
      en: JSON.stringify({
        greeting: {
          summary: "Hello {{name}}, {count} items",
        },
      }),
      fr: JSON.stringify({
        greeting: {
          summary: "Bonjour {{nom}}, {counts} articles",
        },
      }),
    };

    const report = analyzeProject(extracted, locales);
    const mismatches = report.diagnostics.filter(
      (d) => d.type === "INTERPOLATION_MISMATCH"
    );

    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({
      type: "INTERPOLATION_MISMATCH",
      severity: "error",
      key: "greeting.summary",
      locale: "fr",
      expectedVars: ["count", "name"],
      actualVars: ["counts", "nom"],
    });
  });

  it("7. Format-Preserving Fix: removes only dead keys and empty parent objects from 4-space indented JSON while preserving sibling order", () => {
    const fourSpaceJson = [
      "{",
      '    "zebra": {',
      '        "keep_first": "First",',
      '        "remove_mid": "Dead",',
      '        "keep_last": "Last"',
      "    },",
      '    "alpha_dead_group": {',
      '        "only_dead": "Remove entire parent"',
      "    }",
      "}",
    ].join("\n");

    const fixed = pruneUnusedKeys(fourSpaceJson, [
      "zebra.remove_mid",
      "alpha_dead_group.only_dead",
    ]);

    expect(fixed).toBe(
      [
        "{",
        '    "zebra": {',
        '        "keep_first": "First",',
        '        "keep_last": "Last"',
        "    }",
        "}",
      ].join("\n")
    );
  });

  it("8. Real-World Patterns: keyPrefix, lexical constants, ternaries, fallback arrays, next-intl t.rich/markup/raw, i18next context, defineMessages, and non-i18n .t() immunity", () => {
    const code = `
      import { useTranslation } from "react-i18next";
      import { useTranslations, getTranslations } from "next-intl";
      import { defineMessages } from "react-intl";

      const MENU_HOME = "menu.home";
      const KEYS = {
        PROFILE: "menu.profile",
      } as const;

      const messages = defineMessages({
        title: { id: "page.title", defaultMessage: "Welcome" },
      });

      export async function ComplexView({ isAdmin }: { isAdmin: boolean }) {
        const { t } = useTranslation("auth", { keyPrefix: "form" });
        const tHome = useTranslations("Home");
        const tAbout = await getTranslations({ locale: "en", namespace: "About" });

        // Unrelated object with .t() method must NOT be extracted
        const anim = gsap.t("not.a.translation.key");

        return (
          <div>
            {t("email")}
            {i18n.t(MENU_HOME)}
            {i18n.t(KEYS.PROFILE)}
            {i18n.t(isAdmin ? "role.admin" : "role.user")}
            {i18n.t(["err.specific", "err.generic"])}
            {tHome.rich("intro")}
            {tHome.markup("note")}
            {tHome.raw("data")}
            {tAbout("headline")}
            {i18n.t("friend", { context: "male" })}
          </div>
        );
      }
    `;

    const extracted = scanSource(code, "src/ComplexView.tsx");
    const keys = extracted.map((k) => k.key);

    expect(keys).toEqual([
      "page.title",
      "auth.form.email",
      "menu.home",
      "menu.profile",
      "role.admin",
      "role.user",
      "err.specific",
      "err.generic",
      "Home.intro",
      "Home.note",
      "Home.data",
      "About.headline",
      "friend",
    ]);
    expect(extracted.find((k) => k.key === "friend")?.context).toBe("male");
    expect(keys).not.toContain("not.a.translation.key");
  });

  it("9. Unresolved Dynamic Argument Safety: emits UNRESOLVED_KEY warning when t(dynamicVar) cannot be resolved statically, and protects bound namespace", () => {
    const scopedCode = `
      import { useTranslation } from "react-i18next";
      export function DynamicComp({ dynamicKey }: { dynamicKey: string }) {
        const { t } = useTranslation("auth");
        return <span>{t(dynamicKey)}</span>;
      }
    `;

    const extractedScoped = scanSource(scopedCode, "src/DynamicComp.tsx");
    expect(extractedScoped).toHaveLength(1);
    expect(extractedScoped[0]).toMatchObject({
      key: "auth.",
      rawKey: "dynamicKey",
      isDynamicPrefix: true,
      isUnresolved: true,
    });

    const report = analyzeProject(extractedScoped, {
      en: JSON.stringify({
        auth: { login: "Sign in" },
        other: { dead: "Remove me" },
      }),
    });

    // auth.login is protected by the scoped namespace; other.dead is flagged unused; UNRESOLVED_KEY warning is emitted
    expect(
      report.diagnostics.filter((d) => d.type === "UNRESOLVED_KEY")
    ).toHaveLength(1);
    expect(
      report.diagnostics.filter((d) => d.type === "UNUSED_KEY").map((d) => d.key)
    ).toEqual(["other.dead"]);
  });
});
