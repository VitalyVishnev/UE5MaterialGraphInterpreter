import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseClipboard } from "../src/clipboard/parser";

const sampleIt = existsSync(resolve("samples")) ? it : it.skip;

describe("parseClipboard", () => {
  it("preserves nested UE object records and their source spans", () => {
    const source = [
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="MaterialGraphNode_0"',
      'Begin Object Class=/Script/Engine.MaterialExpressionAdd Name="MaterialExpressionAdd_0"',
      "End Object",
      'Begin Object Name="MaterialExpressionAdd_0"',
      "ConstA=1.000000",
      "End Object",
      "End Object",
    ].join("\n");

    const result = parseClipboard(source);

    expect(result.diagnostics).toEqual([]);
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0]).toMatchObject({
      className: "/Script/UnrealEd.MaterialGraphNode",
      name: "MaterialGraphNode_0",
      startLine: 1,
      endLine: 7,
    });
    expect(result.objects[0].children).toHaveLength(2);
    expect(result.objects[0].children[1].properties.get("ConstA")?.value).toBe("1.000000");
  });
});

describe("clipboard fixture corpus", () => {
  sampleIt("structurally parses every complete fixture without incomplete-object errors", () => {
    const fixtures = [
      "samples/SceneColor/SceneColor_full_clipboard.txt",
      "samples/MF_GerstnerWaves/MF_GerstnerWaves_full_clipboard.txt",
      "samples/Bayer_Matrix_Dither_-_Material_Function/Bayer_Matrix_Dither_-_Material_Function_full_clipboard.txt",
      "samples/MF_Noise_InterleavedGradientGolden_1d/MF_Noise_InterleavedGradientGolden_1d_full_clipboard.txt",
      "samples/Texture_Adjustments_Function/Texture_Adjustments_Function_full_clipboard.txt",
      "samples/HeightToNormalSmooth/HeightToNormalSmooth_full_clipboard.txt",
      "samples/MF_ResolveCoordinateFrame_Biplanar_Dither/MF_ResolveCoordinateFrame_Biplanar_Dither_full_clipboard.txt",
    ];

    for (const fixture of fixtures) {
      const result = parseClipboard(readFileSync(resolve(fixture), "utf8"));
      expect(result.objects.length, fixture).toBeGreaterThan(0);
      expect(
        result.diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
        fixture,
      ).toEqual([]);
    }
  });

  sampleIt("distinguishes valid partial selections from physically truncated text", () => {
    const validPartial = parseClipboard(
      readFileSync(resolve("samples/SceneColor/SceneColor_partial_1_clipboard.txt"), "utf8"),
    );
    const missingEnd = parseClipboard(
      readFileSync(resolve("samples/MF_GerstnerWaves/MF_GerstnerWaves_half_of_clipboard_deleted.txt"), "utf8"),
    );
    const missingStart = parseClipboard(
      readFileSync(
        resolve("samples/Bayer_Matrix_Dither_-_Material_Function/Bayer_Matrix_Dither_-_Material_Function_broken_missing_first_50pct.txt"),
        "utf8",
      ),
    );

    expect(validPartial.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
    expect(missingEnd.diagnostics.some((item) => item.code === "incomplete-object")).toBe(true);
    expect(missingStart.diagnostics.some((item) => item.code === "unexpected-end-object")).toBe(true);
  });

  sampleIt("preserves escaped multiline Custom HLSL as one property value", () => {
    const source = readFileSync(
      resolve(
        "samples/MF_Noise_InterleavedGradientGolden_1d/MF_Noise_InterleavedGradientGolden_1d_full_clipboard.txt",
      ),
      "utf8",
    );
    const result = parseClipboard(source);
    const custom = result.objects
      .flatMap((object) => object.children)
      .find(
        (object) =>
          object.name === "MaterialExpressionCustom_1" && object.properties.has("Code"),
      );

    expect(custom?.properties.get("Code")?.value).toContain("return frac(ign + gr)");
  });
});
