import { describe, expect, it } from "vitest";
import { analyzeProject, scanSource, type ExtractedKey } from "../../src/index.js";
import { generateSyntheticRepo } from "./fixture-generator.js";

describe("Performance Requirement (PRD Section 6.2 & TRD Phase 4)", () => {
  it("scans a 500-file TypeScript/React fixture and runs diff analysis in under 500 ms", () => {
    const fixture = generateSyntheticRepo(500);

    // Warmup JIT
    scanSource(fixture.files[0]!.code, fixture.files[0]!.filePath);

    const start = performance.now();
    const extracted: ExtractedKey[] = [];
    for (const file of fixture.files) {
      extracted.push(...scanSource(file.code, file.filePath));
    }
    const report = analyzeProject(extracted, fixture.locales, undefined, {
      totalFilesScanned: fixture.files.length,
    });
    const elapsedMs = performance.now() - start;

    expect(report.summary.totalFilesScanned).toBe(500);
    expect(report.summary.totalKeysFound).toBe(1500);
    expect(report.diagnostics).toHaveLength(0);
    expect(elapsedMs).toBeLessThan(500);
  });
});
