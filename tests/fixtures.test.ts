import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { analyzeClipboard } from "../src/analyze";

const sampleIt = existsSync(resolve("samples")) ? it : it.skip;

function sampleFixtures(suffix: string): string[] {
  return readdirSync(resolve("samples"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => readdirSync(resolve("samples", entry.name))
      .filter((name) => name.endsWith(suffix))
      .map((name) => `samples/${entry.name}/${name}`));
}

describe("analyzeClipboard", () => {
  sampleIt("analyses every complete fixture and every detected output without throwing", () => {
    const fixtures = sampleFixtures("_full_clipboard.txt");

    for (const fixture of fixtures) {
      const source = readFileSync(resolve(fixture), "utf8");
      const first = analyzeClipboard(source);
      expect(first.outputs.length, fixture).toBeGreaterThan(0);
      for (const output of first.outputs) {
        const result = analyzeClipboard(source, { outputId: output.id });
        expect(result.code, `${fixture}:${output.label}`).toContain("Pseudo-HLSL");
        expect(result.code, `${fixture}:${output.label}`).not.toContain("unresolved_output");
        expect(result.diagnostics, fixture).not.toEqual(
          expect.arrayContaining([expect.objectContaining({ code: "unsupported-node" })]),
        );
        expect(result.diagnostics, fixture).not.toEqual(
          expect.arrayContaining([expect.objectContaining({ code: "type-conflict" })]),
        );
      }
    }
  });

  sampleIt("returns diagnostics instead of throwing for every physically truncated fixture", () => {
    const fixtures = [
      ...sampleFixtures("_broken_missing_first_50pct.txt"),
      ...sampleFixtures("_broken_missing_last_50pct.txt"),
      "samples/MF_GerstnerWaves/MF_GerstnerWaves_half_of_clipboard_deleted.txt",
    ];

    for (const fixture of fixtures) {
      const result = analyzeClipboard(readFileSync(resolve(fixture), "utf8"));
      expect(
        result.diagnostics.some((item) => item.severity === "error"),
        fixture,
      ).toBe(true);
    }
  });
});
