import { cac } from "cac";
import { LocaleParseError } from "@locale-lint/core";
import { ConfigError } from "./config.js";
import { formatJsonReport, formatTerminalReport } from "./reporter.js";
import { runCheck, runFix } from "./index.js";

interface CheckCliOptions {
  ci?: boolean;
  json?: boolean;
  config?: string;
  locales?: string;
  src?: string | string[];
  base?: string;
}

interface FixCliOptions {
  dryRun?: boolean;
  force?: boolean;
  json?: boolean;
  config?: string;
  locales?: string;
  src?: string | string[];
  base?: string;
}

export async function runCli(argv = process.argv): Promise<number> {
  const cli = cac("i18n-ast-lint");

  let exitCode = 0;
  let actionPromise: Promise<void> | undefined;

  cli
    .command("check", "Analyze source files and locale JSON files for i18n issues")
    .option("--ci", "Disable ANSI colors and fail on warning-level diagnostics")
    .option("--json", "Output raw JSON report to stdout without ANSI colors or banners")
    .option("--config <path>", "Path to i18n-ast-lint config file (.json, .mjs, .js)")
    .option("--locales <dir>", "Path to locales directory")
    .option("--src <dir>", "Path(s) to source directory (comma-separated)")
    .option("--base <locale>", "Base locale code (default: en)")
    .action((options: CheckCliOptions) => {
      actionPromise = (async () => {
        const result = await runCheck(process.cwd(), {
          configPath: options.config,
          localesDir: options.locales,
          srcDir: options.src,
          baseLocale: options.base,
          ci: options.ci,
        });

        if (options.json) {
          process.stdout.write(`${formatJsonReport(result.report)}\n`);
        } else {
          process.stdout.write(
            `${formatTerminalReport(result.report, { ci: options.ci })}\n`
          );
        }

        exitCode = result.exitCode;
      })();
    });

  cli
    .command("fix", "Format-preserving removal of unused keys from locale JSON files")
    .option("--dry-run", "Preview unused keys that would be removed without writing files")
    .option("--force", "Prune unused keys even when unresolved dynamic t(expr) calls exist")
    .option("--json", "Output JSON summary of pruned keys and files")
    .option("--config <path>", "Path to i18n-ast-lint config file (.json, .mjs, .js)")
    .option("--locales <dir>", "Path to locales directory")
    .option("--src <dir>", "Path(s) to source directory (comma-separated)")
    .option("--base <locale>", "Base locale code (default: en)")
    .action((options: FixCliOptions) => {
      actionPromise = (async () => {
        const result = await runFix(process.cwd(), {
          configPath: options.config,
          localesDir: options.locales,
          srcDir: options.src,
          baseLocale: options.base,
          dryRun: options.dryRun,
          force: options.force,
        });

        if (result.blockedByUnresolved) {
          const unresolved = result.report.diagnostics.filter(
            (d) => d.type === "UNRESOLVED_KEY"
          );
          if (options.json) {
            process.stdout.write(
              `${JSON.stringify(
                {
                  blockedByUnresolved: true,
                  unresolvedCalls: unresolved,
                  totalRemovedKeys: 0,
                  modifiedFiles: [],
                },
                null,
                2
              )}\n`
            );
          } else {
            process.stderr.write(
              `Aborted fix: found ${unresolved.length} unresolved dynamic translation call(s) that could not be statically analyzed:\n`
            );
            for (const u of unresolved) {
              const loc = u.location
                ? ` (${u.location.filePath}:${u.location.line}:${u.location.column})`
                : "";
              process.stderr.write(`  - t(${u.key})${loc}\n`);
            }
            process.stderr.write(
              `Pass --force to prune unused keys anyway, or use a template prefix like t(\`prefix.\${key}\`).\n`
            );
          }
          exitCode = 1;
          return;
        }

        if (options.json) {
          process.stdout.write(
            `${JSON.stringify(
              {
                dryRun: Boolean(options.dryRun),
                blockedByUnresolved: false,
                totalRemovedKeys: result.totalRemovedKeys,
                modifiedFiles: result.modifiedFiles.map((f) => ({
                  filePath: f.filePath,
                  locale: f.locale,
                  namespace: f.namespace,
                  removedKeys: f.removedKeys,
                })),
              },
              null,
              2
            )}\n`
          );
        } else if (result.modifiedFiles.length === 0) {
          process.stdout.write("✓ No unused keys found to prune.\n");
        } else {
          const modeLabel = options.dryRun ? "[DRY RUN] Would prune" : "✓ Pruned";
          process.stdout.write(
            `${modeLabel} ${result.totalRemovedKeys} unused key(s) across ${result.modifiedFiles.length} locale file(s):\n`
          );
          for (const file of result.modifiedFiles) {
            process.stdout.write(
              `  - ${file.filePath} (${file.removedKeys.length} key(s): ${file.removedKeys.join(", ")})\n`
            );
          }
        }

        exitCode = 0;
      })();
    });

  cli.help();
  cli.version("0.1.0");

  try {
    cli.parse(argv, { run: false });

    if (!cli.matchedCommand) {
      if (!cli.options.help && !cli.options.version) {
        // Default to running `check` if invoked with no subcommand
        const result = await runCheck(process.cwd());
        process.stdout.write(`${formatTerminalReport(result.report)}\n`);
        return result.exitCode;
      }
      return 0;
    }

    await cli.runMatchedCommand();
    if (actionPromise) {
      await actionPromise;
    }
    return exitCode;
  } catch (err) {
    if (err instanceof ConfigError || err instanceof LocaleParseError) {
      process.stderr.write(`Fatal Error: ${err.message}\n`);
      return 2;
    }
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Fatal Error: ${msg}\n`);
    return 2;
  }
}

const code = await runCli(process.argv);
process.exit(code);
