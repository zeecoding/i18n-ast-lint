import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import type { LintReport } from "@locale-lint/core";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const cliBinPath = resolve(__dirname, "../dist/bin.mjs");

interface CliExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function execCli(args: string[], cwd: string): Promise<CliExecResult> {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [cliBinPath, ...args],
      { cwd }
    );
    return { stdout, stderr, exitCode: 0 };
  } catch (err) {
    const e = err as {
      stdout?: string;
      stderr?: string;
      code?: number;
    };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      exitCode: typeof e.code === "number" ? e.code : 1,
    };
  }
}

describe("CLI End-to-End Suite (Issues #35 & #43, Namespaced Pruning, Exit Codes)", () => {
  const tempDirs: string[] = [];

  async function createTempFixture(prefix: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), `locale-lint-${prefix}-`));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        await rm(dir, { recursive: true, force: true });
      }
    }
  });

  it("8. Issues #35 & #43 (ESM + CI Exit Codes): runs inside a \"type\": \"module\" repo, exits 1 on unused keys, prunes cleanly with fix, and exits 0 afterwards", async () => {
    const repoDir = await createTempFixture("esm-ci");
    await mkdir(join(repoDir, "src"), { recursive: true });
    await mkdir(join(repoDir, "locales"), { recursive: true });

    await writeFile(
      join(repoDir, "package.json"),
      JSON.stringify({ name: "esm-fixture", type: "module", private: true }, null, 2)
    );

    await writeFile(
      join(repoDir, "i18n-ast-lint.config.mjs"),
      `export default {
        baseLocale: "en",
        localesDir: "locales",
        srcDir: ["src"]
      };\n`
    );

    await writeFile(
      join(repoDir, "src", "App.tsx"),
      `
      import { useTranslation } from "react-i18next";
      export function App() {
        const { t } = useTranslation("auth");
        return <button>{t("login")}</button>;
      }
      `
    );

    await writeFile(
      join(repoDir, "locales", "en.json"),
      [
        "{",
        '  "auth": {',
        '    "login": "Sign in",',
        '    "unused_legacy": "Delete me"',
        "  }",
        "}",
        "",
      ].join("\n")
    );

    // 1. `check --ci` must exit 1 and contain no ANSI escape sequences
    const initialCheck = await execCli(["check", "--ci"], repoDir);
    expect(initialCheck.exitCode).toBe(1);
    expect(initialCheck.stdout).not.toContain("\x1b[");
    expect(initialCheck.stdout).toContain("i18n-ast-lint v0.1.0");
    expect(initialCheck.stdout).toContain("auth.unused_legacy");

    // 2. `check --json` outputs valid JSON report and still exits 1 on error diagnostics
    const jsonCheck = await execCli(["check", "--json"], repoDir);
    expect(jsonCheck.exitCode).toBe(1);
    const parsedReport = JSON.parse(jsonCheck.stdout) as LintReport;
    expect(parsedReport.summary.unusedCount).toBe(1);
    expect(parsedReport.diagnostics[0]?.key).toBe("auth.unused_legacy");

    // 3. `fix` removes auth.unused_legacy while preserving formatting
    const fixRun = await execCli(["fix"], repoDir);
    expect(fixRun.exitCode).toBe(0);

    const updatedEn = await readFile(join(repoDir, "locales", "en.json"), "utf8");
    expect(updatedEn).toBe(
      [
        "{",
        '  "auth": {',
        '    "login": "Sign in"',
        "  }",
        "}",
        "",
      ].join("\n")
    );

    // 4. Subsequent `check --ci` exits 0
    const finalCheck = await execCli(["check", "--ci"], repoDir);
    expect(finalCheck.exitCode).toBe(0);
    expect(finalCheck.stdout).toContain("All translation keys and interpolations are in sync");
  });

  it("tracks { locale, namespace, filePath } and strips namespace prefixes when running fix on public/locales/<locale>/<ns>.json", async () => {
    const repoDir = await createTempFixture("namespaced-locales");
    await mkdir(join(repoDir, "src"), { recursive: true });
    await mkdir(join(repoDir, "public", "locales", "en"), { recursive: true });

    await writeFile(
      join(repoDir, "src", "Login.tsx"),
      `
      import { useTranslation } from "react-i18next";
      export function Login() {
        const { t } = useTranslation("auth");
        const { t: tCommon } = useTranslation("common");
        return <div>{t("title")} {tCommon("save")}</div>;
      }
      `
    );

    await writeFile(
      join(repoDir, "public", "locales", "en", "auth.json"),
      [
        "{",
        '    "title": "Welcome back",',
        '    "dead_auth_key": "Remove from auth.json"',
        "}",
      ].join("\n")
    );

    await writeFile(
      join(repoDir, "public", "locales", "en", "common.json"),
      [
        "{",
        '    "save": "Save changes",',
        '    "dead_common_key": "Remove from common.json"',
        "}",
      ].join("\n")
    );

    // Zero-config detects public/locales and src automatically
    const checkBefore = await execCli(["check", "--json"], repoDir);
    expect(checkBefore.exitCode).toBe(1);
    const reportBefore = JSON.parse(checkBefore.stdout) as LintReport;
    expect(reportBefore.diagnostics.map((d) => d.key).sort()).toEqual([
      "auth.dead_auth_key",
      "common.dead_common_key",
    ]);

    const fixRes = await execCli(["fix", "--json"], repoDir);
    expect(fixRes.exitCode).toBe(0);

    const authContent = await readFile(
      join(repoDir, "public", "locales", "en", "auth.json"),
      "utf8"
    );
    const commonContent = await readFile(
      join(repoDir, "public", "locales", "en", "common.json"),
      "utf8"
    );

    expect(authContent).toBe(['{', '    "title": "Welcome back"', '}'].join("\n"));
    expect(commonContent).toBe(['{', '    "save": "Save changes"', '}'].join("\n"));

    const checkAfter = await execCli(["check"], repoDir);
    expect(checkAfter.exitCode).toBe(0);
  });

  it("exits with code 2 on malformed JSON or missing config file", async () => {
    const repoDir = await createTempFixture("fatal-exit-2");
    await mkdir(join(repoDir, "src"), { recursive: true });
    await mkdir(join(repoDir, "locales"), { recursive: true });

    await writeFile(join(repoDir, "src", "index.ts"), `export const x = 1;\n`);
    await writeFile(
      join(repoDir, "locales", "en.json"),
      `{ "broken": "trailing comma", }`
    );

    const malformedRes = await execCli(["check"], repoDir);
    expect(malformedRes.exitCode).toBe(2);
    expect(malformedRes.stderr).toContain("Invalid JSON syntax");

    const badConfigRes = await execCli(
      ["check", "--config", "nonexistent.config.json"],
      repoDir
    );
    expect(badConfigRes.exitCode).toBe(2);
    expect(badConfigRes.stderr).toContain("Config file not found");
  });
});
