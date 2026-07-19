import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { parseClipboard } from "../src/clipboard/parser";
import { resolveGraph } from "../src/graph/resolve";
import type { GraphNode, MaterialGraph } from "../src/graph/types";
import { generateAllPseudoHlsl, generatePseudoHlsl } from "../src/pseudo-hlsl/generate";
import {
  ALL_OUTPUTS_ID,
  analyzeClipboard,
  defaultAnalysisFormatting,
} from "../src/analyze";

const sampleIt = existsSync(resolve("samples")) ? it : it.skip;

describe("generatePseudoHlsl", () => {
  sampleIt("specializes DLWE Snow Static Switches from clipboard defaults", () => {
    const source = readFileSync(
      resolve("samples/DLWE_Snow/DLWE_Snow_full_clipboard.txt"),
      "utf8",
    );

    const result = analyzeClipboard(source);
    expect(result.staticSwitches.length).toBeGreaterThan(0);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "graph-cycle" })]),
    );
    const parallax = result.staticSwitches.find((item) => item.label === "Parallax Depth Effect")!;
    expect(parallax.value).toBe(true);

    const disabled = analyzeClipboard(source, {
      staticSwitchOverrides: new Map([[parallax.id, false]]),
    });
    expect(disabled.code).not.toContain("StaticSwitch(");
    expect(disabled.diagnostics).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "graph-cycle" })]),
    );
  });

  sampleIt("renders the SceneColor material as readable semantic operations", () => {
    const source = readFileSync(
      resolve("samples/SceneColor/SceneColor_full_clipboard.txt"),
      "utf8",
    );
    const graph = resolveGraph(parseClipboard(source));

    const result = generatePseudoHlsl(graph, graph.outputs[0].id);

    expect(result.code).toContain("SceneTexture(PPI_PostProcessInput0)");
    expect(result.code).toContain("SceneTexture(PPI_StoredBaseColor)");
    expect(result.code).toContain(".rgb");
    expect(result.code).toContain("lerp(");
    expect(result.code).toContain("Emissive_Color");
    expect(result.code).toBe(generatePseudoHlsl(graph, graph.outputs[0].id).code);
  });

  sampleIt("keeps missing partial-graph dependencies explicit", () => {
    const source = readFileSync(
      resolve("samples/SceneColor/SceneColor_partial_1_clipboard.txt"),
      "utf8",
    );
    const graph = resolveGraph(parseClipboard(source));

    const result = generatePseudoHlsl(graph, graph.outputs[0].id);

    expect(result.code).toContain("external_");
    expect(result.diagnostics.some((item) => item.code === "unresolved-link")).toBe(true);
  });

  it("optionally folds scalar constants and neutral arithmetic", () => {
    const source = `
Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Output"
  Begin Object Class=/Script/Engine.MaterialExpressionFunctionOutput Name="OutputExpression"
  End Object
  Begin Object Name="OutputExpression"
    OutputName="Result"
  End Object
  CustomProperties Pin (PinId=99999999999999999999999999999999,PinName="Input",LinkedTo=(FinalAdd 77777777777777777777777777777777))
End Object
Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="X"
  Begin Object Class=/Script/Engine.MaterialExpressionFunctionInput Name="XExpression"
  End Object
  Begin Object Name="XExpression"
    InputName="X"
    InputType=FunctionInput_Scalar
  End Object
  CustomProperties Pin (PinId=11111111111111111111111111111111,PinName="Output",Direction="EGPD_Output")
End Object
Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="OneA"
  Begin Object Class=/Script/Engine.MaterialExpressionConstant Name="OneAExpression"
  End Object
  Begin Object Name="OneAExpression"
    R=1.0
  End Object
  CustomProperties Pin (PinId=22222222222222222222222222222222,PinName="Output",Direction="EGPD_Output")
End Object
Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="OneB"
  Begin Object Class=/Script/Engine.MaterialExpressionConstant Name="OneBExpression"
  End Object
  Begin Object Name="OneBExpression"
    R=1.0
  End Object
  CustomProperties Pin (PinId=33333333333333333333333333333333,PinName="Output",Direction="EGPD_Output")
End Object
Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Two"
  Begin Object Class=/Script/Engine.MaterialExpressionConstant Name="TwoExpression"
  End Object
  Begin Object Name="TwoExpression"
    R=2.0
  End Object
  CustomProperties Pin (PinId=44444444444444444444444444444444,PinName="Output",Direction="EGPD_Output")
End Object
Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="ConstantAdd"
  Begin Object Class=/Script/Engine.MaterialExpressionAdd Name="ConstantAddExpression"
  End Object
  CustomProperties Pin (PinId=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,PinName="A",LinkedTo=(OneA 22222222222222222222222222222222))
  CustomProperties Pin (PinId=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB,PinName="B",LinkedTo=(Two 44444444444444444444444444444444))
  CustomProperties Pin (PinId=55555555555555555555555555555555,PinName="Output",Direction="EGPD_Output")
End Object
Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="IdentityMultiply"
  Begin Object Class=/Script/Engine.MaterialExpressionMultiply Name="IdentityMultiplyExpression"
  End Object
  CustomProperties Pin (PinId=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC,PinName="A",LinkedTo=(X 11111111111111111111111111111111))
  CustomProperties Pin (PinId=DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD,PinName="B",LinkedTo=(OneB 33333333333333333333333333333333))
  CustomProperties Pin (PinId=66666666666666666666666666666666,PinName="Output",Direction="EGPD_Output")
End Object
Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="FinalAdd"
  Begin Object Class=/Script/Engine.MaterialExpressionAdd Name="FinalAddExpression"
  End Object
  CustomProperties Pin (PinId=EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE,PinName="A",LinkedTo=(IdentityMultiply 66666666666666666666666666666666))
  CustomProperties Pin (PinId=FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF,PinName="B",LinkedTo=(ConstantAdd 55555555555555555555555555555555))
  CustomProperties Pin (PinId=77777777777777777777777777777777,PinName="Output",Direction="EGPD_Output")
End Object`;

    const exact = analyzeClipboard(source);
    const simplified = analyzeClipboard(source, {
      formatting: { ...defaultAnalysisFormatting, simplifyAlgebra: true },
    });

    expect(exact.code).toContain("((X * 1.0) + (1.0 + 2.0))");
    expect(simplified.code).toContain("float Result = (X + 3.0);");
  });

  it("does not turn prose node descriptions into variable names", () => {
    const source = `
Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Output"
  Begin Object Class=/Script/Engine.MaterialExpressionFunctionOutput Name="OutputExpression"
  End Object
  Begin Object Name="OutputExpression"
    OutputName="Result"
  End Object
  CustomProperties Pin (PinId=99999999999999999999999999999999,PinName="Input",LinkedTo=(FinalAdd 88888888888888888888888888888888))
End Object
Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="X"
  Begin Object Class=/Script/Engine.MaterialExpressionFunctionInput Name="XExpression"
  End Object
  Begin Object Name="XExpression"
    InputName="X"
    InputType=FunctionInput_Scalar
  End Object
  CustomProperties Pin (PinId=11111111111111111111111111111111,PinName="Output",Direction="EGPD_Output")
End Object
Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Two"
  Begin Object Class=/Script/Engine.MaterialExpressionConstant Name="TwoExpression"
  End Object
  Begin Object Name="TwoExpression"
    R=2.0
  End Object
  CustomProperties Pin (PinId=22222222222222222222222222222222,PinName="Output",Direction="EGPD_Output")
End Object
Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="SharedMultiply"
  Begin Object Class=/Script/Engine.MaterialExpressionMultiply Name="SharedMultiplyExpression"
  End Object
  Begin Object Name="SharedMultiplyExpression"
    Desc="a controllable power node is expensive and would add complication to the functions interface"
  End Object
  NodeComment="a controllable power node is expensive and would add complication to the functions interface"
  CustomProperties Pin (PinId=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,PinName="A",LinkedTo=(X 11111111111111111111111111111111))
  CustomProperties Pin (PinId=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB,PinName="B",LinkedTo=(Two 22222222222222222222222222222222))
  CustomProperties Pin (PinId=33333333333333333333333333333333,PinName="Output",Direction="EGPD_Output")
End Object
Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="AddA"
  Begin Object Class=/Script/Engine.MaterialExpressionAdd Name="AddAExpression"
  End Object
  CustomProperties Pin (PinId=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC,PinName="A",LinkedTo=(SharedMultiply 33333333333333333333333333333333))
  CustomProperties Pin (PinId=DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD,PinName="B",DefaultValue="1.0")
  CustomProperties Pin (PinId=44444444444444444444444444444444,PinName="Output",Direction="EGPD_Output")
End Object
Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="AddB"
  Begin Object Class=/Script/Engine.MaterialExpressionAdd Name="AddBExpression"
  End Object
  CustomProperties Pin (PinId=EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE,PinName="A",LinkedTo=(SharedMultiply 33333333333333333333333333333333))
  CustomProperties Pin (PinId=FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF,PinName="B",DefaultValue="2.0")
  CustomProperties Pin (PinId=55555555555555555555555555555555,PinName="Output",Direction="EGPD_Output")
End Object
Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="FinalAdd"
  Begin Object Class=/Script/Engine.MaterialExpressionAdd Name="FinalAddExpression"
  End Object
  CustomProperties Pin (PinId=66666666666666666666666666666666,PinName="A",LinkedTo=(AddA 44444444444444444444444444444444))
  CustomProperties Pin (PinId=77777777777777777777777777777777,PinName="B",LinkedTo=(AddB 55555555555555555555555555555555))
  CustomProperties Pin (PinId=88888888888888888888888888888888,PinName="Output",Direction="EGPD_Output")
End Object`;

    const result = analyzeClipboard(source);

    expect(result.code).toContain("float multiply = (X * 2.0);");
    expect(result.code).not.toContain("a_controllable_power_node");
  });

  sampleIt("ignores detached Custom nodes", () => {
    const source = readFileSync(
      resolve(
        "samples/MF_Noise_InterleavedGradientGolden_1d/MF_Noise_InterleavedGradientGolden_1d_full_clipboard.txt",
      ),
      "utf8",
    );
    const graph = resolveGraph(parseClipboard(source));
    const output = graph.outputs.find((candidate) => candidate.label === "Unsigned")!;

    const result = generatePseudoHlsl(graph, output.id);

    expect(result.code).toContain("frac(");
    expect(result.code).not.toContain("HLSL for Ref");
    expect(result).not.toHaveProperty("references");
  });

  sampleIt("compacts named noise stages instead of mirroring every graph node", () => {
    const source = readFileSync(
      resolve(
        "samples/MF_Noise_InterleavedGradientGolden_1d/MF_Noise_InterleavedGradientGolden_1d_full_clipboard.txt",
      ),
      "utf8",
    );
    const graph = resolveGraph(parseClipboard(source));
    const output = graph.outputs.find((candidate) => candidate.label === "Unsigned")!;

    const result = generatePseudoHlsl(graph, output.id);

    expect(result.code).not.toContain("node_");
    expect(result.code).toContain(
      "const float3 constant3 = float3(0.067111, 0.005837, 52.982918);",
    );
    expect(result.code).toContain(
      "float ign = frac((frac(dot(PixelPosition, constant3.rg)) * constant3.b));",
    );
    expect(result.code).toContain(
      "float gr = (TemporalSampleIndex * ((1.0 + sqrt(5.0)) * 0.5));",
    );
    expect(result.code).toContain("float ign = frac((frac(dot(PixelPosition, constant3.rg)) * constant3.b));\n\nfloat Unsigned = frac((gr + ign));");
    expect(result.code).toContain("float Unsigned = frac((gr + ign));\n\nreturn Unsigned;");
  });

  sampleIt("renders Gerstner math and external assets as readable function calls", () => {
    const source = readFileSync(
      resolve("samples/MF_GerstnerWaves/MF_GerstnerWaves_full_clipboard.txt"),
      "utf8",
    );
    const result = analyzeClipboard(source);

    expect(result.code).toContain("Pi(2.0)");
    expect(result.code).toContain("cos(add)");
    expect(result.code).toContain("sin(add)");
    expect(result.code).toContain("MakeFloat3(");
    expect(result.code).not.toContain("UE_MaterialFunction");
    expect(result.code).not.toContain("UE_Unsupported");
    expect(result.code).not.toContain("MaterialExpressionCosine is not supported");
    expect(result.code).toContain("?float pi = Pi(2.0);");
    expect(result.code).toContain("float3 Result = MakeFloat3(");
    expect(result.code).not.toContain("Result = makeFloat3;");
    expect(result.code).toContain("float3 Direction; // Function input");
    expect(result.code).not.toContain("unknown");
    expect(result.typeOverrideGroups.map((item) => item.name)).toEqual(["Pi"]);
    expect(result.typeOverrideGroups.filter((item) => item.name === "Pi")).toHaveLength(1);
    expect(result.typeOverrideGroups.find((item) => item.name === "Pi")?.values[0]).toEqual(
      expect.objectContaining({ name: "Result", type: "float", status: "inferred" }),
    );
    expect(
      result.code.split("\n").filter((line) => line.includes("Math/Pi.Pi")).length,
    ).toBe(1);
  });

  sampleIt("uses proven built-in expression types in the large coordinate-frame function", () => {
    const source = readFileSync(
      resolve(
        "samples/MF_ResolveCoordinateFrame_Biplanar_Dither/MF_ResolveCoordinateFrame_Biplanar_Dither_full_clipboard.txt",
      ),
      "utf8",
    );
    const result = analyzeClipboard(source);

    expect(result.code).toContain("float3 preSkinnedNormal = PreSkinnedNormal();");
    expect(result.code).toContain(
      "ShaderStageSwitch(VertexInterpolator(preSkinnedNormal), preSkinnedNormal)",
    );
    expect(result.code).toContain("float3 localPosition = LocalPosition();");
    expect(result.code).toContain("length(Transform(float3(1.0, 0.0, 0.0), Instance, World))");
    expect(result.code).toContain("float3 MeshVecScale = Convert(");
    expect(result.code).not.toContain("MeshVecScale = maintain_scale");
    expect(result.code).not.toContain("WARNING: MaterialExpressionPreSkinnedNormal");
    expect(result.code).not.toContain("WARNING: MaterialExpressionVertexInterpolator");
    expect(result.code).not.toContain("WARNING: MaterialExpressionLocalPosition");
    expect([...result.code.matchAll(
      /\/\/---------------------------------------------------\n\/\/ (.+)\n\/\/---------------------------------------------------/g,
    )].map((match) => match[1])).toEqual([
      "Coordinates",
      "Get Input Coordinates/Derivatives",
      "Dither Select + Transform Basis to World",
    ]);
  });

  sampleIt("preserves vector width through DDX and DDY", () => {
    const source = readFileSync(
      resolve("samples/HeightToNormalSmooth/HeightToNormalSmooth_full_clipboard.txt"),
      "utf8",
    );
    const result = analyzeClipboard(source);

    expect(result.code).toContain("cross(ddx(add), ddy(add))");
    expect(result.code).toContain(
      "float3 add = ((Height * World_Space_Vertex_Normals) + Absolute_World_Position);",
    );
    expect(result.code).toContain(
      "cross(ddx(Absolute_World_Position), ddy(Absolute_World_Position))",
    );
    expect(result.code).toContain(
      "\n\nfloat3 subtract = (\n    normalize(cross(ddx(add), ddy(add)))\n    - normalize(cross(ddx(Absolute_World_Position), ddy(Absolute_World_Position)))\n);\n\nfloat3 WorldSpaceNormal",
    );
    expect(result.code).not.toMatch(/float\d? reroute(?:_\d+)? =/i);
    expect(result.code).toContain("float3 WorldSpaceNormal");
    expect(result.code).not.toContain("?type");
    expect(result.code).not.toContain("WARNING: MaterialExpressionDDX");
    expect(result.code).not.toContain("WARNING: MaterialExpressionDDY");
  });

  sampleIt("applies one function-output override to every call of the same function", () => {
    const source = readFileSync(
      resolve("samples/MF_GerstnerWaves/MF_GerstnerWaves_full_clipboard.txt"),
      "utf8",
    );
    const initial = analyzeClipboard(source);
    const piOutput = initial.typeOverrideGroups.find((item) => item.name === "Pi")!.values[0];

    const overridden = analyzeClipboard(source, {
      typeOverrides: new Map([[piOutput.id, "float4"]]),
    });

    expect(overridden.typeOverrideGroups.find((item) => item.name === "Pi")?.values[0]).toEqual(
      expect.objectContaining({ type: "float4", status: "overridden" }),
    );
    expect(overridden.code).toContain("float4 pi = Pi(2.0);");
    expect(overridden.code).toContain("float4 pi_2 = Pi(2.0);");
  });

  it("marks channel-only evidence as a minimum vector width", () => {
    const source = [
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="MaterialGraphNode_Input"',
      'Begin Object Class=/Script/Engine.MaterialExpressionFutureValue Name="MaterialExpressionFutureValue_0"',
      "End Object",
      'Begin Object Name="MaterialExpressionFutureValue_0"',
      "End Object",
      'CustomProperties Pin (PinId=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,PinName="Output",Direction="EGPD_Output",LinkedTo=(MaterialGraphNode_Mask BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="MaterialGraphNode_Mask"',
      'Begin Object Class=/Script/Engine.MaterialExpressionComponentMask Name="MaterialExpressionComponentMask_0"',
      "End Object",
      'Begin Object Name="MaterialExpressionComponentMask_0"',
      "R=True",
      "G=True",
      "End Object",
      'CustomProperties Pin (PinId=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB,PinName="Input",LinkedTo=(MaterialGraphNode_Input AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA))',
      'CustomProperties Pin (PinId=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC,PinName="Output",Direction="EGPD_Output")',
      "End Object",
    ].join("\n");

    const result = analyzeClipboard(source);

    expect(result.code).toContain("?float2+ futureValue = FutureValue();");
  });

  it.each([
    [undefined, "float3"],
    ["FunctionInput_Scalar", "float"],
    ["FunctionInput_Vector2", "float2"],
    ["FunctionInput_Vector4", "float4"],
    ["FunctionInput_Texture2D", "Texture2D"],
    ["FunctionInput_TextureCube", "TextureCube"],
    ["FunctionInput_Texture2DArray", "Texture2DArray"],
    ["FunctionInput_VolumeTexture", "Texture3D"],
    ["FunctionInput_StaticBool", "static bool"],
    ["FunctionInput_MaterialAttributes", "MaterialAttributes"],
    ["FunctionInput_TextureExternal", "TextureExternal"],
    ["FunctionInput_Bool", "bool"],
    ["FunctionInput_Substrate", "Substrate"],
  ])("renders Function Input type %s as %s", (inputType, expected) => {
    const typeLine = inputType ? `InputType=${inputType}` : "";
    const source = [
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="MaterialGraphNode_Input"',
      'Begin Object Class=/Script/Engine.MaterialExpressionFunctionInput Name="MaterialExpressionFunctionInput_0"',
      "End Object",
      'Begin Object Name="MaterialExpressionFunctionInput_0"',
      'InputName="Value"',
      typeLine,
      "End Object",
      'CustomProperties Pin (PinId=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,PinName="Output",Direction="EGPD_Output")',
      "End Object",
    ].filter(Boolean).join("\n");

    expect(analyzeClipboard(source).code).toContain(`${expected} Value; // Function input`);
  });

  sampleIt("uses verified Engine Material Function output signatures", () => {
    const source = readFileSync(
      resolve(
        "samples/Bayer_Matrix_Dither_-_Material_Function/Bayer_Matrix_Dither_-_Material_Function_full_clipboard.txt",
      ),
      "utf8",
    );
    const result = analyzeClipboard(source);

    expect(result.code).toContain("float2 screenAlignedPixelToPixelUVs = ScreenAlignedPixelToPixelUVs(");
    expect(result.code).toContain("float2 screenAlignedPixelToPixelUVs_2 = ScreenAlignedPixelToPixelUVs(");
    expect(result.code).toContain(").r;");
    expect(result.code).not.toContain(").R;");
    expect(result.typeOverrideGroups.some((item) => item.name === "ScreenAlignedPixelToPixelUVs")).toBe(false);
  });

  sampleIt("recognizes BreakOutFloat3Components and MakeFloat3 signatures", () => {
    const source = readFileSync(
      resolve("samples/Texture_Adjustments_Function/Texture_Adjustments_Function_full_clipboard.txt"),
      "utf8",
    );

    const result = analyzeClipboard(source);

    expect(result.code).toContain("float r;");
    expect(result.code).toContain("float g;");
    expect(result.code).toContain("float b;");
    expect(result.code).toContain("float3 ARM_2 = MakeFloat3(");
    expect(result.typeOverrideGroups.some((item) => item.name === "BreakOutFloat3Components")).toBe(false);
    expect(result.typeOverrideGroups.some((item) => item.name === "MakeFloat3")).toBe(false);
  });

  sampleIt("does not treat the empty editor pin as a Custom HLSL input", () => {
    const source = readFileSync(
      resolve(
        "samples/Bayer_Matrix_Dither_-_Material_Function/Bayer_Matrix_Dither_-_Material_Function_full_clipboard.txt",
      ),
      "utf8",
    );

    const result = analyzeClipboard(source);

    expect(result.code).toContain("Custom_TemporalAA_SampleID()");
    expect(result.code).not.toContain("external_MaterialGraphNode_14_Input");
  });

  sampleIt("uses serialized Custom output types and exposes only unresolved inputs", () => {
    const source = readFileSync(
      resolve(
        "samples/Bayer_Matrix_Dither_-_Material_Function/Bayer_Matrix_Dither_-_Material_Function_full_clipboard.txt",
      ),
      "utf8",
    );
    const compact = analyzeClipboard(source);
    const expanded = analyzeClipboard(source, {
      formatting: { ...defaultAnalysisFormatting, expandCustomNodes: true },
    });

    expect(compact.code).toContain("Custom_TemporalAA_SampleID()");
    expect(expanded.code).toContain("float2 TemporalAA_SampleID = CustomHLSL\n{");
    expect(expanded.code).toContain("    View.TemporalAAParams.xy");
    expect(expanded.code).toContain("    // Inputs");
    expect(expanded.code).toMatch(/\s+p = .+;/);
    expect(expanded.code).not.toContain("preserved as an opaque call");
    expect(expanded.typeOverrideGroups.find((item) => item.name === "TemporalAA SampleID")).toBeUndefined();
    expect(expanded.code).toMatch(/TemporalAA_SampleID = CustomHLSL[\s\S]*?\n};\n\nfloat custom = CustomHLSL/);
  });

  it("uses Unreal's float3 Custom output default to resolve a following Custom input", () => {
    const source = [
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode_Custom Name="CustomA"',
      'Begin Object Class=/Script/Engine.MaterialExpressionCustom Name="CustomAExpression"',
      "End Object",
      'Begin Object Name="CustomAExpression"',
      'Code="return float3(1, 2, 3);"',
      'Description="Source"',
      "End Object",
      'CustomProperties Pin (PinId=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,PinName="Output",Direction="EGPD_Output",LinkedTo=(CustomB BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode_Custom Name="CustomB"',
      'Begin Object Class=/Script/Engine.MaterialExpressionCustom Name="CustomBExpression"',
      "End Object",
      'Begin Object Name="CustomBExpression"',
      'Code="return Lab;"',
      'Inputs(0)=(InputName="Lab",Input=(Expression="CustomAExpression"))',
      'Description="Consumer"',
      "End Object",
      'CustomProperties Pin (PinId=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB,PinName="Lab",LinkedTo=(CustomA AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA))',
      'CustomProperties Pin (PinId=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC,PinName="Output",Direction="EGPD_Output",LinkedTo=(Output DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Output"',
      'Begin Object Class=/Script/Engine.MaterialExpressionFunctionOutput Name="OutputExpression"',
      "End Object",
      'Begin Object Name="OutputExpression"',
      'OutputName="Result"',
      "End Object",
      'CustomProperties Pin (PinId=DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD,PinName="Input",LinkedTo=(CustomB CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC))',
      "End Object",
    ].join("\n");

    const result = analyzeClipboard(source, {
      formatting: { ...defaultAnalysisFormatting, expandCustomNodes: true },
    });

    expect(result.code).toContain("float3 Source = CustomHLSL");
    expect(result.code).toContain("float3 Lab = Source;");
    expect(result.typeOverrideGroups.filter((group) => group.kind === "custom-node")).toEqual([]);
  });

  it("offers a manual type only for a Custom input the graph cannot determine", () => {
    const source = [
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode_Custom Name="Custom"',
      'Begin Object Class=/Script/Engine.MaterialExpressionCustom Name="CustomExpression"',
      "End Object",
      'Begin Object Name="CustomExpression"',
      'Code="return Source;"',
      'Inputs(0)=(InputName="Source")',
      'Description="Needs Input Type"',
      "End Object",
      'CustomProperties Pin (PinId=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,PinName="Source",PinType.PinCategory="required")',
      'CustomProperties Pin (PinId=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB,PinName="Output",Direction="EGPD_Output",LinkedTo=(Output CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Output"',
      'Begin Object Class=/Script/Engine.MaterialExpressionFunctionOutput Name="OutputExpression"',
      "End Object",
      'Begin Object Name="OutputExpression"',
      'OutputName="Result"',
      "End Object",
      'CustomProperties Pin (PinId=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC,PinName="Input",LinkedTo=(Custom BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB))',
      "End Object",
    ].join("\n");
    const initial = analyzeClipboard(source);
    const customInput = initial.typeOverrideGroups.find((group) => group.kind === "custom-node")!.values[0];
    const overridden = analyzeClipboard(source, {
      formatting: { ...defaultAnalysisFormatting, expandCustomNodes: true },
      typeOverrides: new Map([[customInput.id, "float2"]]),
    });

    expect(customInput).toEqual(expect.objectContaining({ name: "Source", status: "unknown" }));
    expect(overridden.code).toMatch(/float2 Source = external_/);
    expect(overridden.typeOverrideGroups.find((group) => group.kind === "custom-node")?.values[0])
      .toEqual(expect.objectContaining({ type: "float2", status: "overridden" }));
  });

  it("preserves an unsupported connected node and its available input", () => {
    const source = [
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode_Root Name="MaterialGraphNode_Root_0"',
      'CustomProperties Pin (PinId=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,PinName="Emissive Color",LinkedTo=(MaterialGraphNode_0 BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="MaterialGraphNode_0"',
      'Begin Object Class=/Script/Engine.MaterialExpressionFutureMath Name="MaterialExpressionFutureMath_0"',
      "End Object",
      'Begin Object Name="MaterialExpressionFutureMath_0"',
      "End Object",
      'CustomProperties Pin (PinId=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC,PinName="Input",LinkedTo=(MaterialGraphNode_1 DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD))',
      'CustomProperties Pin (PinId=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB,PinName="Output",Direction="EGPD_Output",LinkedTo=(MaterialGraphNode_Root_0 AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="MaterialGraphNode_1"',
      'Begin Object Class=/Script/Engine.MaterialExpressionConstant Name="MaterialExpressionConstant_0"',
      "End Object",
      'Begin Object Name="MaterialExpressionConstant_0"',
      "R=2.000000",
      "End Object",
      'CustomProperties Pin (PinId=DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD,PinName="Output",Direction="EGPD_Output",LinkedTo=(MaterialGraphNode_0 CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC))',
      "End Object",
    ].join("\n");

    const result = analyzeClipboard(source);

    expect(result.code).toContain("FutureMath(2.0)");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "unsupported-node" })]),
    );
  });

  sampleIt("keeps function input and output identifiers unique", () => {
    const source = readFileSync(
      resolve(
        "samples/Texture_Adjustments_Function/Texture_Adjustments_Function_full_clipboard.txt",
      ),
      "utf8",
    );
    const graph = resolveGraph(parseClipboard(source));
    const output = graph.outputs.find((candidate) => candidate.label === "Color")!;

    const result = generatePseudoHlsl(graph, output.id);

    expect(result.code).toContain("float3 Color; // Function input");
    expect(result.code).toContain("float4 Color_2 =");
  });

  sampleIt("treats Named Reroutes as transparent named data flow", () => {
    const source = readFileSync(
      resolve(
        "samples/MF_ResolveCoordinateFrame_Biplanar_Dither/MF_ResolveCoordinateFrame_Biplanar_Dither_full_clipboard.txt",
      ),
      "utf8",
    );
    const graph = resolveGraph(parseClipboard(source));
    expect(graph.outputs.map((output) => output.label)).toEqual([
      "Tangent",
      "Bitangent",
      "UV",
      "DXY",
      "Rotation (Turns)",
    ]);
    for (const output of graph.outputs) {
      const result = generatePseudoHlsl(graph, output.id);

      expect(result.code).not.toContain("NamedReroute");
      expect(result.code).not.toContain("Reroute(");
      expect(result.code).not.toContain("external_");
      expect(result.diagnostics).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "unsupported-node", message: expect.stringContaining("Reroute") }),
        ]),
      );
    }
  });

  sampleIt("uses graph comments as sections and expands standalone calls with many arguments", () => {
    const source = readFileSync(
      resolve(
        "samples/MF_ResolveCoordinateFrame_Biplanar_Dither/MF_ResolveCoordinateFrame_Biplanar_Dither_full_clipboard.txt",
      ),
      "utf8",
    );
    const graph = resolveGraph(parseClipboard(source));
    const output = graph.outputs.find((candidate) => candidate.label === "Tangent")!;

    const result = generatePseudoHlsl(graph, output.id);

    expect(result.code).toContain("// Get Input Coordinates/Derivatives");
    expect(result.code).toContain("// Coordinates");
    expect(result.code).toContain("// Dither Select + Transform Basis to World");
    expect(result.code.match(/^\/\/ Coordinates$/gm)).toHaveLength(1);
    expect(result.code.match(/^\/\/ Get Input Coordinates\/Derivatives$/gm)).toHaveLength(1);
    expect(result.code.match(/^\/\/ Dither Select \+ Transform Basis to World$/gm)).toHaveLength(1);
    expect(result.code).toMatch(/= MF_Switch4_Vec3\(\n {4}[^\n]+,\n/);
    expect(result.code).toMatch(/\n {4}[^\n]+\n\);/);
  });

  sampleIt("generates all outputs from one shared graph slice", () => {
    const source = readFileSync(
      resolve(
        "samples/MF_ResolveCoordinateFrame_Biplanar_Dither/MF_ResolveCoordinateFrame_Biplanar_Dither_full_clipboard.txt",
      ),
      "utf8",
    );

    const result = analyzeClipboard(source);

    expect(result.selectedOutputId).toBe(ALL_OUTPUTS_ID);
    expect(result.outputs[0]).toEqual({ id: ALL_OUTPUTS_ID, label: "All outputs" });
    expect(result.code).toContain("return FunctionOutputs\n{");
    expect(result.code).toContain("Tangent: Tangent,");
    expect(result.code).toContain("Rotation_Turns: Rotation_Turns");
    expect(result.code.match(/float3 RefPos =/g)).toHaveLength(1);
    expect(result.code).not.toContain("?type mF_Coordinate_Biplanar =");
    expect(result.code).toContain("?type UV1T;");
    expect(result.code).toContain("out UV1T");
    expect(result.code).toContain("?type AxisIndex = MF_Blend_RGBToIndex(Blendi, Dither);");
    expect(result.code).not.toContain("?type axisIndex =");
    expect(result.code).not.toContain("?type AxisIndex = axisIndex;");
    expect(result.code).toContain("?float3 Tangent = MF_Switch4_Vec3(");
    expect(result.code).toContain("?float3 Bitangent = MF_Switch4_Vec3(");
    expect(result.code).not.toMatch(/Tangent = selectedVector/);
    expect(result.code).not.toContain("Rotation_Turns_2 = Rotation_Turns");
    expect(result.code.match(/^\/\/ Get Input Coordinates\/Derivatives$/gm)).toHaveLength(1);
  });

  sampleIt("names external results from their output pins and infers selected-vector signatures", () => {
    const source = readFileSync(
      resolve(
        "samples/MF_ResolveCoordinateFrame_Biplanar_Dither/MF_ResolveCoordinateFrame_Biplanar_Dither_full_clipboard.txt",
      ),
      "utf8",
    );
    const result = analyzeClipboard(source);
    const switchFunction = result.typeOverrideGroups.find(
      (item) => item.name === "MF_Switch4_Vec3",
    )!;

    expect(result.code).toContain("?float3 RefNorm = MF_Switch4_Vec3(");
    expect(result.code).not.toContain("RefNorm = selectedVector");
    const switchDeclarations = result.code.match(
      /\?float3 selectedVector(?:_\d+)? = MF_Switch4_Vec3\(/g,
    ) ?? [];
    expect(switchDeclarations).toHaveLength(1);
    expect(switchFunction.values[0]).toEqual(
      expect.objectContaining({ name: "Selected Vector", type: "float3", status: "inferred" }),
    );

    const overridden = analyzeClipboard(source, {
      typeOverrides: new Map([[switchFunction.values[0].id, "float3"]]),
    });
    expect(overridden.code).not.toMatch(/\?float3 selectedVector(?:_\d+)? = MF_Switch4_Vec3\(/);
    expect(overridden.code).toContain("float3 RefNorm = MF_Switch4_Vec3(");
    expect(overridden.code).toMatch(/float3 selectedVector(?:_\d+)? = MF_Switch4_Vec3\(/);
  });

  it("does not present a partially constrained repeated function output as globally inferred", () => {
    const source = [
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="CallTyped"',
      'Begin Object Class=/Script/Engine.MaterialExpressionMaterialFunctionCall Name="CallTypedExpression"',
      "End Object",
      'Begin Object Name="CallTypedExpression"',
      'MaterialFunction="/Script/Engine.MaterialFunction\'/Project/Opaque.Opaque\'"',
      "End Object",
      'CustomProperties Pin (PinId=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,PinName="Result",Direction="EGPD_Output",LinkedTo=(Mask BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="CallUnknown"',
      'Begin Object Class=/Script/Engine.MaterialExpressionMaterialFunctionCall Name="CallUnknownExpression"',
      "End Object",
      'Begin Object Name="CallUnknownExpression"',
      'MaterialFunction="/Script/Engine.MaterialFunction\'/Project/Opaque.Opaque\'"',
      "End Object",
      'CustomProperties Pin (PinId=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC,PinName="Result",Direction="EGPD_Output",LinkedTo=(OutputUnknown DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Mask"',
      'Begin Object Class=/Script/Engine.MaterialExpressionComponentMask Name="MaskExpression"',
      "End Object",
      'Begin Object Name="MaskExpression"',
      "R=True",
      "G=True",
      "End Object",
      'CustomProperties Pin (PinId=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB,PinName="Input",LinkedTo=(CallTyped AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA))',
      'CustomProperties Pin (PinId=EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE,PinName="Output",Direction="EGPD_Output",LinkedTo=(OutputTyped FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="OutputTyped"',
      'Begin Object Class=/Script/Engine.MaterialExpressionFunctionOutput Name="OutputTypedExpression"',
      "End Object",
      'Begin Object Name="OutputTypedExpression"',
      'OutputName="Typed"',
      "End Object",
      'CustomProperties Pin (PinId=FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF,PinName="Input",LinkedTo=(Mask EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="OutputUnknown"',
      'Begin Object Class=/Script/Engine.MaterialExpressionFunctionOutput Name="OutputUnknownExpression"',
      "End Object",
      'Begin Object Name="OutputUnknownExpression"',
      'OutputName="Unknown"',
      "End Object",
      'CustomProperties Pin (PinId=DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD,PinName="Input",LinkedTo=(CallUnknown CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC))',
      "End Object",
    ].join("\n");

    const result = analyzeClipboard(source);
    expect(result.typeOverrideGroups[0].values[0].status).toBe("unknown");
  });

  it("keeps every unpacked output scoped to its external call instance", () => {
    const target = "/Script/Engine.MaterialFunction'/Project/MF_TwoOutputs.MF_TwoOutputs'";
    const call = (id: string, prefix: string): GraphNode => ({
      id,
      expressionClass: "MaterialExpressionMaterialFunctionCall",
      kind: "external-call",
      properties: new Map([["MaterialFunction", target]]),
      startLine: 1,
      pins: ["A", "B"].map((name) => ({
        id: `${prefix}${name}`,
        name,
        direction: "output",
        links: [],
      })),
    });
    const outputNode = (id: string): GraphNode => ({
      id,
      expressionClass: "MaterialExpressionFunctionOutput",
      kind: "function-output",
      properties: new Map(),
      pins: [],
      startLine: 1,
    });
    const first = call("Call1", "1");
    const second = call("Call2", "2");
    const graph: MaterialGraph = {
      nodes: new Map([
        [first.id, first],
        [second.id, second],
        ...["Out1A", "Out1B", "Out2A", "Out2B"].map(
          (id): [string, GraphNode] => [id, outputNode(id)],
        ),
      ]),
      outputs: [
        { id: "Out1A:Input", label: "First A", ownerNodeId: "Out1A", ownerPinId: "Input", sourceNodeId: "Call1", sourcePinId: "1A" },
        { id: "Out1B:Input", label: "First B", ownerNodeId: "Out1B", ownerPinId: "Input", sourceNodeId: "Call1", sourcePinId: "1B" },
        { id: "Out2A:Input", label: "Second A", ownerNodeId: "Out2A", ownerPinId: "Input", sourceNodeId: "Call2", sourcePinId: "2A" },
        { id: "Out2B:Input", label: "Second B", ownerNodeId: "Out2B", ownerPinId: "Input", sourceNodeId: "Call2", sourcePinId: "2B" },
      ],
      diagnostics: [],
    };

    const result = generateAllPseudoHlsl(graph);
    expect(result.code).toContain("MF_TwoOutputs(out First_A, out First_B);");
    expect(result.code).toContain("MF_TwoOutputs(out Second_A, out Second_B);");
  });

  it("collapses an exclusive chain of Named Reroute renames to its final name", () => {
    const node = (
      id: string,
      expressionClass: string,
      pins: GraphNode["pins"],
      displayName?: string,
    ): GraphNode => ({ id, expressionClass, kind: "expression", properties: new Map(), pins, startLine: 1, displayName });
    const call: GraphNode = {
      ...node("Call", "MaterialExpressionMaterialFunctionCall", [{ id: "CallOut", name: "Result", direction: "output", links: [] }]),
      kind: "external-call",
      properties: new Map([["MaterialFunction", "/Project/MF_Value.MF_Value"]]),
    };
    const declaration = (id: string, inputNodeId: string, inputPinId: string, name: string) => node(
      id,
      "MaterialExpressionNamedRerouteDeclaration",
      [
        { id: `${id}In`, name: "Input", direction: "input", links: [{ nodeId: inputNodeId, pinId: inputPinId }] },
        { id: `${id}Out`, name: "Output", direction: "output", links: [] },
      ],
      name,
    );
    const usage = (id: string, declarationId: string) => node(
      id,
      "MaterialExpressionNamedRerouteUsage",
      [
        { id: `${id}In`, name: "Input", direction: "input", links: [{ nodeId: declarationId, pinId: `${declarationId}Out` }] },
        { id: `${id}Out`, name: "Output", direction: "output", links: [] },
      ],
    );
    const first = declaration("First", "Call", "CallOut", "FirstName");
    const firstUsage = usage("FirstUsage", "First");
    const final = declaration("Final", "FirstUsage", "FirstUsageOut", "FinalName");
    const finalUsage = usage("FinalUsage", "Final");
    const graph: MaterialGraph = {
      nodes: new Map([call, first, firstUsage, final, finalUsage].map((item) => [item.id, item])),
      outputs: [{
        id: "Output:Input",
        label: "Result",
        ownerNodeId: "Output",
        ownerPinId: "Input",
        sourceNodeId: "FinalUsage",
        sourcePinId: "FinalUsageOut",
      }],
      diagnostics: [],
    };

    const result = generatePseudoHlsl(graph, "Output:Input");
    expect(result.code).toContain("?type FinalName = MF_Value();");
    expect(result.code).not.toContain("FirstName");
    expect(result.code).not.toContain("FinalName = FirstName");

    graph.outputs.push({
      id: "Branch:Input",
      label: "Branch",
      ownerNodeId: "Branch",
      ownerPinId: "Input",
      sourceNodeId: "Call",
      sourcePinId: "CallOut",
    });
    const branched = generateAllPseudoHlsl(graph);
    expect(branched.code).toContain("?type mF_Value = MF_Value();");
    expect(branched.code).toContain("?type FinalName = mF_Value;");
    expect(branched.code).not.toContain("FirstName");
  });

  sampleIt("supports strict bundles and compact formatting settings", () => {
    const source = readFileSync(
      resolve(
        "samples/MF_ResolveCoordinateFrame_Biplanar_Dither/MF_ResolveCoordinateFrame_Biplanar_Dither_full_clipboard.txt",
      ),
      "utf8",
    );

    const result = analyzeClipboard(source, {
      outputId: ALL_OUTPUTS_ID,
      formatting: {
        bundleFormat: "strict",
        commentSections: false,
        expandCustomNodes: false,
        multilineCalls: false,
        spaceComplexOperations: false,
        simplifyAlgebra: false,
      },
    });

    expect(result.code).toContain("struct FunctionOutputs\n{");
    expect(result.code).toContain(
      "MF_Coordinate_Biplanar_Outputs coordinateBiplanarOutputs = MF_Coordinate_Biplanar(",
    );
    expect(result.code).toContain("FunctionOutputs result;");
    expect(result.code).toContain("result.Tangent = Tangent;");
    expect(result.code).toContain("return result;");
    expect(result.code).not.toContain("//---------------------------------------------------");
    expect(result.code).toMatch(/= MF_Switch4_Vec3\([^\n]+\);/);
  });

  it("classifies nested comment regions after declaration planning", () => {
    const outer = { id: "outer", text: "Main Stage" };
    const focused = { id: "focused", text: "FocusedValue" };
    const fallback = { id: "fallback", text: "FallbackName" };
    const call = (
      id: string,
      outputId: string,
      commentRegions: GraphNode["commentRegions"],
      displayName?: string,
    ): GraphNode => ({
      id,
      expressionClass: "MaterialExpressionMaterialFunctionCall",
      kind: "external-call",
      properties: new Map([["MaterialFunction", `/Project/MF_${id}.MF_${id}`]]),
      pins: [{ id: outputId, name: "Result", direction: "output", links: [] }],
      startLine: 1,
      displayName,
      commentRegions,
    });
    const a = call("A", "AOut", [outer, focused]);
    const b = call("B", "BOut", [outer, fallback], "AuthoredValue");
    const add: GraphNode = {
      id: "Add",
      expressionClass: "MaterialExpressionAdd",
      kind: "expression",
      properties: new Map(),
      pins: [
        { id: "AddA", name: "A", direction: "input", links: [{ nodeId: "A", pinId: "AOut" }] },
        { id: "AddB", name: "B", direction: "input", links: [{ nodeId: "B", pinId: "BOut" }] },
        { id: "AddOut", name: "Output", direction: "output", links: [] },
      ],
      startLine: 1,
      commentRegions: [outer],
    };
    const output: GraphNode = {
      id: "Output",
      expressionClass: "MaterialExpressionFunctionOutput",
      kind: "function-output",
      properties: new Map([["OutputName", "Result"]]),
      pins: [{
        id: "OutputIn",
        name: "Input",
        direction: "input",
        links: [{ nodeId: "Add", pinId: "AddOut" }],
      }],
      startLine: 1,
    };
    const graph: MaterialGraph = {
      nodes: new Map([a, b, add, output].map((node) => [node.id, node])),
      outputs: [{
        id: "Output:Input",
        label: "Result",
        ownerNodeId: "Output",
        ownerPinId: "OutputIn",
        sourceNodeId: "Add",
        sourcePinId: "AddOut",
      }],
      diagnostics: [],
    };

    const result = generatePseudoHlsl(graph, "Output:Input");

    expect(result.code).toContain("//---------------------------------------------------\n// Main Stage\n//---------------------------------------------------");
    expect(result.code).toContain("?type FocusedValue = MF_A();");
    expect(result.code).not.toContain("// FocusedValue\n");
    expect(result.code).toContain("// FallbackName\n?type AuthoredValue = MF_B();");

    const withoutComments = generatePseudoHlsl(
      graph,
      "Output:Input",
      new Map(),
      { ...defaultAnalysisFormatting, commentSections: false },
    );
    expect(withoutComments.code).not.toContain("Main Stage");
    expect(withoutComments.code).not.toContain("FocusedValue");
    expect(withoutComments.code).not.toContain("FallbackName");
  });

  it("renders a multi-node region collapsed into one declaration as a local comment", () => {
    const region = { id: "combined", text: "Combined math" };
    const constant = (id: string, pinId: string, value: string): GraphNode => ({
      id,
      expressionClass: "MaterialExpressionConstant",
      kind: "expression",
      properties: new Map([["R", value]]),
      pins: [{ id: pinId, name: "Output", direction: "output", links: [] }],
      startLine: 1,
      commentRegions: [region],
    });
    const a = constant("A", "AOut", "1");
    const b = constant("B", "BOut", "2");
    const add: GraphNode = {
      id: "Add",
      expressionClass: "MaterialExpressionAdd",
      kind: "expression",
      properties: new Map(),
      pins: [
        { id: "AddA", name: "A", direction: "input", links: [{ nodeId: "A", pinId: "AOut" }] },
        { id: "AddB", name: "B", direction: "input", links: [{ nodeId: "B", pinId: "BOut" }] },
        { id: "AddOut", name: "Output", direction: "output", links: [] },
      ],
      startLine: 1,
      commentRegions: [region],
    };
    const output: GraphNode = {
      id: "Output",
      expressionClass: "MaterialExpressionFunctionOutput",
      kind: "function-output",
      properties: new Map([["OutputName", "Result"]]),
      pins: [{
        id: "OutputIn",
        name: "Input",
        direction: "input",
        links: [{ nodeId: "Add", pinId: "AddOut" }],
      }],
      startLine: 1,
    };
    const graph: MaterialGraph = {
      nodes: new Map([a, b, add, output].map((node) => [node.id, node])),
      outputs: [{
        id: "Output:Input",
        label: "Result",
        ownerNodeId: "Output",
        ownerPinId: "OutputIn",
        sourceNodeId: "Add",
        sourcePinId: "AddOut",
      }],
      diagnostics: [],
    };

    const result = generatePseudoHlsl(graph, "Output:Input");

    expect(result.code).toContain("// Combined math\nfloat Result = (1.0 + 2.0);");
    expect(result.code).not.toContain("//---------------------------------------------------\n// Combined math");
  });
});
