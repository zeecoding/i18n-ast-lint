import type { LocaleMap } from "../../src/types.js";

export interface SyntheticRepoFixture {
  files: Array<{ filePath: string; code: string }>;
  locales: LocaleMap;
}

const NAMESPACES = [
  "common",
  "auth",
  "dashboard",
  "settings",
  "billing",
  "profile",
  "notifications",
  "checkout",
  "catalog",
  "analytics",
] as const;

/**
 * Generates a realistic 500-file TypeScript/React codebase + 2 locale JSON files (`en`, `fr`)
 * with 500+ translation keys, scoped hooks, `<Trans>` components, and dynamic template prefixes.
 */
export function generateSyntheticRepo(fileCount = 500): SyntheticRepoFixture {
  const files: Array<{ filePath: string; code: string }> = [];
  const enObj: Record<string, Record<string, string>> = {};
  const frObj: Record<string, Record<string, string>> = {};

  for (const ns of NAMESPACES) {
    enObj[ns] = {};
    frObj[ns] = {};
  }

  for (let i = 0; i < fileCount; i++) {
    const ns = NAMESPACES[i % NAMESPACES.length]!;
    const keyA = `title_${i}`;
    const keyB = `Action_${i}`;
    const keyC = `trans_desc_${i}`;

    enObj[ns]![keyA] = `Title ${i} for {{user}}`;
    enObj[ns]![keyB] = `Action ${i} ({count} items)`;
    enObj[ns]![keyC] = `Read description ${i}`;

    frObj[ns]![keyA] = `Titre ${i} pour {{user}}`;
    frObj[ns]![keyB] = `Action ${i} ({count} articles)`;
    frObj[ns]![keyC] = `Lire la description ${i}`;

    const code = [
      `import React from "react";`,
      `import { useTranslation, Trans } from "react-i18next";`,
      ``,
      `export function FeatureComponent${i}({ user, count }: { user: string; count: number }) {`,
      `  const { t } = useTranslation("${ns}");`,
      `  return (`,
      `    <section className="p-4">`,
      `      <h2>{t("${keyA}", { user })}</h2>`,
      `      <button>{t("${keyB}", { count })}</button>`,
      `      <Trans i18nKey="${ns}:${keyC}">Read description</Trans>`,
      `    </section>`,
      `  );`,
      `}`,
    ].join("\n");

    files.push({
      filePath: `src/features/${ns}/FeatureComponent${i}.tsx`,
      code,
    });
  }

  return {
    files,
    locales: {
      en: JSON.stringify(enObj, null, 2),
      fr: JSON.stringify(frObj, null, 2),
    },
  };
}
