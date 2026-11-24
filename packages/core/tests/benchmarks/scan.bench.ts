import { bench, describe } from "vitest";
import { analyzeProject, scanSource, type ExtractedKey } from "../../src/index.js";
import { generateSyntheticRepo } from "./fixture-generator.js";

const fixture = generateSyntheticRepo(500);

describe("500-file TypeScript/React AST Scan & Diff Benchmark", () => {
  bench("scan 500 TSX files + analyzeProject across 1,500 keys", () => {
    const extracted: ExtractedKey[] = [];
    for (const file of fixture.files) {
      extracted.push(...scanSource(file.code, file.filePath));
    }
    analyzeProject(extracted, fixture.locales);
  });
});
