import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  advancedExpressionSemantics,
  equivalentExpressionInputs,
  fixedExpressionOutputType,
  inputDataExpressionSemantics,
  knownMaterialFunctionOutputType,
  mathExpressionSemantics,
  proceduralNoiseExpression,
} from "../src/graph/expression-semantics";
import { analyzeClipboard } from "../src/analyze";
import type { GraphNode, GraphPin } from "../src/graph/types";

const output = (name: string, id = name): GraphPin => ({
  id,
  name,
  direction: "output",
  links: [],
});

const node = (
  expressionClass: string,
  pins: GraphPin[],
  properties: ReadonlyMap<string, string> = new Map(),
): GraphNode => ({
  id: "Node",
  expressionClass,
  kind: "expression",
  properties,
  pins,
  startLine: 1,
});

describe("built-in Material Expression semantics", () => {
  const ue58AdvancedClasses = [
    "MaterialExpressionAtmosphericFogColor", "MaterialExpressionAtmosphericLightColor",
    "MaterialExpressionAtmosphericLightVector", "MaterialExpressionBlendMaterialAttributes",
    "MaterialExpressionBreakMaterialAttributes", "MaterialExpressionDistanceFieldApproxAO",
    "MaterialExpressionDistanceFieldGradient", "MaterialExpressionDistanceToNearestSurface",
    "MaterialExpressionGetMaterialAttributes", "MaterialExpressionLayerStack",
    "MaterialExpressionLightVector", "MaterialExpressionMainDirectionalLight",
    "MaterialExpressionMakeMaterialAttributes", "MaterialExpressionParticleSubUV",
    "MaterialExpressionParticleSubUVProperties", "MaterialExpressionPathTracingRayTypeSwitch",
    "MaterialExpressionPerInstanceCustomData", "MaterialExpressionPerInstanceCustomData3Vector",
    "MaterialExpressionQualitySwitch", "MaterialExpressionRayTracingQualitySwitch",
    "MaterialExpressionRuntimeVirtualTextureCustomData", "MaterialExpressionRuntimeVirtualTextureOutput",
    "MaterialExpressionRuntimeVirtualTextureReplace", "MaterialExpressionRuntimeVirtualTextureSample",
    "MaterialExpressionRuntimeVirtualTextureSampleParameter", "MaterialExpressionScalarParameter",
    "MaterialExpressionNoise", "MaterialExpressionScalarBlueNoise", "MaterialExpressionVectorNoise",
    "MaterialExpressionSetMaterialAttributes", "MaterialExpressionShadingModel",
    "MaterialExpressionSkyAtmosphereAerialPerspective", "MaterialExpressionSkyAtmosphereDistantLightScatteredLuminance",
    "MaterialExpressionSkyAtmosphereLightDirection", "MaterialExpressionSkyAtmosphereLightDiskLuminance",
    "MaterialExpressionSkyAtmosphereLightIlluminance", "MaterialExpressionSkyAtmosphereLightIlluminanceOnGround",
    "MaterialExpressionSkyAtmosphereViewLuminance", "MaterialExpressionSkyLightEnvMapSample",
    "MaterialExpressionSparseVolumeTextureObject", "MaterialExpressionSparseVolumeTextureObjectParameter",
    "MaterialExpressionSparseVolumeTextureSampleParameter", "MaterialExpressionStaticBool",
    "MaterialExpressionStaticBoolParameter", "MaterialExpressionStaticSwitch",
    "MaterialExpressionStaticSwitchParameter", "MaterialExpressionSubstrateConvertMaterialAttributes",
    "MaterialExpressionSubstrateEyeBSDF", "MaterialExpressionSubstrateHairBSDF",
    "MaterialExpressionSubstrateLightFunction", "MaterialExpressionSubstrateSimpleClearCoatBSDF",
    "MaterialExpressionSubstrateSingleLayerWaterBSDF", "MaterialExpressionSubstrateSlabBSDF",
    "MaterialExpressionSubstrateToonBSDF", "MaterialExpressionSubstrateUnlitBSDF",
    "MaterialExpressionSubstrateVolumetricFogCloudBSDF", "MaterialExpressionTextureObject",
    "MaterialExpressionTextureObjectParameter", "MaterialExpressionTextureSample",
    "MaterialExpressionTextureSampleParameter2D", "MaterialExpressionTextureSampleParameterVolume",
    "MaterialExpressionVectorParameter", "MaterialExpressionVirtualTextureFeatureSwitch",
    "MaterialExpressionVolumetricAdvancedMaterialInput", "MaterialExpressionVolumetricAdvancedMaterialOutput",
    "MaterialExpressionVolumetricCloudEmptySpaceSkippingInput", "MaterialExpressionVolumetricCloudEmptySpaceSkippingOutput",
  ];

  const documentedAdvancedSupplements = [
    "MaterialExpressionSparseVolumeTextureSample",
    "MaterialExpressionTextureSampleParameter2DArray",
    "MaterialExpressionTextureSampleParameterCube",
    "MaterialExpressionTextureSampleParameterCubeArray",
    "MaterialExpressionTextureSampleParameterSubUV",
  ];

  const ue58InputDataClasses = [
    "MaterialExpressionActorPositionWS", "MaterialExpressionCameraPositionWS",
    "MaterialExpressionConstant2Vector", "MaterialExpressionConstant3Vector",
    "MaterialExpressionConstant4Vector", "MaterialExpressionConstantDouble",
    "MaterialExpressionDistanceCullFade", "MaterialExpressionFontSignedDistance",
    "MaterialExpressionIsFirstPerson", "MaterialExpressionIsOrthographic",
    "MaterialExpressionLightmapUVs", "MaterialExpressionLocalPosition",
    "MaterialExpressionObjectOrientation", "MaterialExpressionObjectPositionWS",
    "MaterialExpressionObjectRadius", "MaterialExpressionPanner",
    "MaterialExpressionParticleColor", "MaterialExpressionParticleDirection",
    "MaterialExpressionParticleMotionBlurFade", "MaterialExpressionParticlePositionWS",
    "MaterialExpressionParticleRadius", "MaterialExpressionParticleRandom",
    "MaterialExpressionParticleRelativeTime", "MaterialExpressionParticleSize",
    "MaterialExpressionParticleSpeed", "MaterialExpressionParticleSpriteRotation",
    "MaterialExpressionParticleSubUVProperties", "MaterialExpressionPerInstanceFadeAmount",
    "MaterialExpressionPerInstanceRandom", "MaterialExpressionPixelDepth",
    "MaterialExpressionPrecomputedAOMask", "MaterialExpressionRotator",
    "MaterialExpressionSceneDepth", "MaterialExpressionSceneTexelSize",
    "MaterialExpressionScreenPosition", "MaterialExpressionTextureCoordinate",
    "MaterialExpressionTime", "MaterialExpressionTruncateLWC",
    "MaterialExpressionTwoSidedSign", "MaterialExpressionVertexColor",
    "MaterialExpressionVertexNormalWS", "MaterialExpressionVertexTangentWS",
    "MaterialExpressionViewProperty", "MaterialExpressionViewSize",
    "MaterialExpressionWorldPosition",
  ];

  const ue58MathClasses = [
    "MaterialExpressionAbs",
    "MaterialExpressionAdd",
    "MaterialExpressionAppendVector",
    "MaterialExpressionArccosine",
    "MaterialExpressionArccosineFast",
    "MaterialExpressionArcsine",
    "MaterialExpressionArcsineFast",
    "MaterialExpressionArctangent",
    "MaterialExpressionArctangent2",
    "MaterialExpressionArctangent2Fast",
    "MaterialExpressionArctangentFast",
    "MaterialExpressionCeil",
    "MaterialExpressionClamp",
    "MaterialExpressionComponentMask",
    "MaterialExpressionCosine",
    "MaterialExpressionCrossProduct",
    "MaterialExpressionDivide",
    "MaterialExpressionDotProduct",
    "MaterialExpressionExponential",
    "MaterialExpressionExponential2",
    "MaterialExpressionFloatToUInt",
    "MaterialExpressionFloor",
    "MaterialExpressionFmod",
    "MaterialExpressionFrac",
    "MaterialExpressionHsvToRgb",
    "MaterialExpressionIf",
    "MaterialExpressionInverseLinearInterpolate",
    "MaterialExpressionLinearInterpolate",
    "MaterialExpressionLogarithm",
    "MaterialExpressionLogarithm10",
    "MaterialExpressionLogarithm2",
    "MaterialExpressionMax",
    "MaterialExpressionMin",
    "MaterialExpressionModulo",
    "MaterialExpressionMultiply",
    "MaterialExpressionNormalize",
    "MaterialExpressionOneMinus",
    "MaterialExpressionPower",
    "MaterialExpressionRgbToHsv",
    "MaterialExpressionRound",
    "MaterialExpressionSaturate",
    "MaterialExpressionSign",
    "MaterialExpressionSine",
    "MaterialExpressionSmoothStep",
    "MaterialExpressionSquareRoot",
    "MaterialExpressionStep",
    "MaterialExpressionSubtract",
    "MaterialExpressionSwitch",
    "MaterialExpressionTangent",
    "MaterialExpressionTruncate",
    "MaterialExpressionUIntToFloat",
  ];

  it("covers every Math expression class copied from Unreal Engine 5.8", () => {
    expect(Object.keys(mathExpressionSemantics).sort()).toEqual(ue58MathClasses.sort());
  });

  it("covers every constant and input-data class copied from Unreal Engine 5.8", () => {
    expect(Object.keys(inputDataExpressionSemantics)).toEqual(expect.arrayContaining(ue58InputDataClasses));
  });

  it("covers every advanced expression class copied from Unreal Engine 5.8", () => {
    expect(Object.keys(advancedExpressionSemantics)).toEqual(expect.arrayContaining(ue58AdvancedClasses));
  });

  it("also covers documented texture and sparse-volume variants missing from the copied palette", () => {
    expect(Object.keys(advancedExpressionSemantics)).toEqual(expect.arrayContaining(documentedAdvancedSupplements));
  });

  it("renders every captured scalar and vector Noise mode with its exact type", () => {
    const source = readFileSync(
      resolve("docs/raw/ue5.8-clipboard-captures/noise-expression-modes.clipboard.txt"),
      "utf8",
    );
    const initial = analyzeClipboard(source);
    const rendered = initial.outputs.map((output) =>
      analyzeClipboard(source, { outputId: output.id }).code);

    expect(rendered).toEqual(expect.arrayContaining([
      expect.stringContaining("float Noise = Noise(WorldPosition(), 1.0, Function: SimplexTexture)"),
      expect.stringContaining("Function: GradientTexture"),
      expect.stringContaining("Function: FastGradient3DTexture"),
      expect.stringContaining("Function: GradientALU"),
      expect.stringContaining("Function: ValueALU"),
      expect.stringContaining("Function: VoronoiALU"),
      expect.stringContaining("float3 VectorNoise = VectorNoise(WorldPosition(), Function: CellNoise"),
      expect.stringContaining("float3 VectorNoise = VectorNoise(WorldPosition(), Function: Perlin3D"),
      expect.stringContaining("float4 VectorNoise = VectorNoise(WorldPosition(), Function: PerlinGradient"),
      expect.stringContaining("float3 VectorNoise = VectorNoise(WorldPosition(), Function: PerlinCurl"),
      expect.stringContaining("float4 VectorNoise = VectorNoise(WorldPosition(), Function: Voronoi"),
    ]));
    expect(rendered.join("\n")).not.toContain("is not supported");
    expect(rendered.join("\n")).not.toContain("?type");
  });

  it("renders Scalar Blue Noise as a parameterless scalar pixel source", () => {
    const source = readFileSync(
      resolve("docs/raw/ue5.8-clipboard-captures/scalar-blue-noise.clipboard.txt"),
      "utf8",
    );
    const result = analyzeClipboard(source);

    expect(result.code).toContain("float ScalarBlueNoise = ScalarBlueNoise();");
    expect(result.diagnostics.some((item) => item.code === "unsupported-node")).toBe(false);
  });

  it("preserves explicit scalar Noise settings without inventing omitted defaults", () => {
    const semantics = proceduralNoiseExpression(node(
      "MaterialExpressionNoise",
      [],
      new Map([
        ["NoiseFunction", "NOISEFUNCTION_VoronoiALU"],
        ["Quality", "3"],
        ["Levels", "4"],
        ["bTurbulence", "False"],
        ["bTiling", "True"],
        ["RepeatSize", "127"],
      ]),
    ));

    expect(semantics).toEqual(expect.objectContaining({
      outputType: "float",
      settings: [
        ["Function", "VoronoiALU"],
        ["Quality", "3"],
        ["Levels", "4"],
        ["Turbulence", "False"],
        ["Tiling", "True"],
        ["RepeatSize", "127"],
      ],
    }));
  });

  it.each(Object.entries(advancedExpressionSemantics).filter(([, semantics]) => !semantics.terminal))(
    "renders advanced expression %s without an unsupported-node fallback",
    (expressionClass, semantics) => {
      const outputNames = Object.keys(semantics.outputs ?? { Output: semantics.defaultOutput });
      const pins = outputNames.map((name, index) =>
        `CustomProperties Pin (PinId=${(index + 1).toString(16).padStart(32, "0")},PinName="${name}",Direction="EGPD_Output")`,
      );
      const source = [
        'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="MaterialGraphNode_Test"',
        `Begin Object Class=/Script/Engine.${expressionClass} Name="Expression_0"`,
        "End Object", 'Begin Object Name="Expression_0"', "End Object", ...pins, "End Object",
      ].join("\n");
      const result = analyzeClipboard(source);
      expect(result.diagnostics.some((item) => item.code === "unsupported-node")).toBe(false);
    },
  );

  it("also covers documented base input nodes missing from the copied palette", () => {
    expect(Object.keys(inputDataExpressionSemantics)).toEqual(expect.arrayContaining([
      "MaterialExpressionCameraVectorWS", "MaterialExpressionDynamicParameter",
      "MaterialExpressionLightVector", "MaterialExpressionObjectBounds",
      "MaterialExpressionParticleMacroUV", "MaterialExpressionPixelNormalWS",
      "MaterialExpressionPreSkinnedNormal", "MaterialExpressionPreSkinnedPosition",
      "MaterialExpressionReflectionVectorWS", "MaterialExpressionSphericalParticleOpacity",
    ]));
  });

  it.each(Object.entries(inputDataExpressionSemantics))(
    "renders input-data expression %s without an unsupported-node fallback",
    (expressionClass, semantics) => {
      const pinId = (index: number): string => (index + 1).toString(16).padStart(32, "0").toUpperCase();
      const inputs = semantics.inputs.map(
        (name, index) => `CustomProperties Pin (PinId=${pinId(index)},PinName="${name}",DefaultValue="0.0")`,
      );
      const outputs = semantics.outputs.map(
        (_, index) => `CustomProperties Pin (PinId=${pinId(inputs.length + index)},PinName="Output${index || ""}",Direction="EGPD_Output")`,
      );
      const source = [
        'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="MaterialGraphNode_Test"',
        `Begin Object Class=/Script/Engine.${expressionClass} Name="Expression_0"`,
        "End Object", 'Begin Object Name="Expression_0"', "End Object",
        ...inputs, ...outputs, "End Object",
      ].join("\n");

      const result = analyzeClipboard(source);
      expect(result.diagnostics.some((item) => item.code === "unsupported-node")).toBe(false);
      expect(result.outputs).toHaveLength(semantics.outputs.length);
    },
  );

  it.each(Object.entries(mathExpressionSemantics))(
    "renders %s without an unsupported-node fallback",
    (expressionClass, semantics) => {
      const pinId = (index: number): string => (index + 1).toString(16).padStart(32, "0").toUpperCase();
      const inputPins = semantics.inputs.map(
        (name, index) => `CustomProperties Pin (PinId=${pinId(index)},PinName="${name}",DefaultValue="0.0")`,
      );
      const source = [
        'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="MaterialGraphNode_Test"',
        `Begin Object Class=/Script/Engine.${expressionClass} Name="Expression_0"`,
        "End Object",
        'Begin Object Name="Expression_0"',
        ...(expressionClass === "MaterialExpressionComponentMask" ? ["R=True"] : []),
        "End Object",
        ...inputPins,
        `CustomProperties Pin (PinId=${pinId(inputPins.length)},PinName="Output",Direction="EGPD_Output")`,
        "End Object",
      ].join("\n");

      const result = analyzeClipboard(source);
      expect(result.diagnostics.some((item) => item.code === "unsupported-node")).toBe(false);
      expect(result.code).not.toContain("is not supported");
      expect(result.code).not.toMatch(/\?type (?:if|switch) =/);
      expect(result.outputs[0].label).toBe(
        expressionClass.replace(/^MaterialExpression/, "")
          + (expressionClass === "MaterialExpressionComponentMask" ? ".R" : ""),
      );
    },
  );

  it.each([
    ["XYZ", "float3"],
    ["XY", "float2"],
    ["Z", "float"],
  ])("types LocalPosition.%s as %s", (pinName, expected) => {
    const pin = output(pinName);
    expect(fixedExpressionOutputType(node("MaterialExpressionLocalPosition", [pin]), pin))
      .toBe(expected);
  });

  it("reads dynamic Convert output types from clipboard metadata", () => {
    const pin = output("Output");
    const convert = node(
      "MaterialExpressionConvert",
      [pin],
      new Map([["ConvertOutputs(0)", "(Type=Vector3)"]]),
    );
    expect(fixedExpressionOutputType(convert, pin)).toBe("float3");
  });

  it("recognizes the two scalar outputs of BreakOutFloat2Components", () => {
    const x = output("X", "X");
    const y = output("Y", "Y");
    const call = node(
      "MaterialExpressionMaterialFunctionCall",
      [x, y],
      new Map([["MaterialFunction", "/Engine/Functions/Utility/BreakOutFloat2Components.BreakOutFloat2Components"]]),
    );
    expect(knownMaterialFunctionOutputType(call, x)).toBe("float");
    expect(knownMaterialFunctionOutputType(call, y)).toBe("float");
  });

  it.each([
    ["MaterialExpressionFloatToUInt", "uint"],
    ["MaterialExpressionUIntToFloat", "float"],
    ["MaterialExpressionModulo", "uint"],
  ])("uses the fixed integer-domain contract for %s", (expressionClass, expected) => {
    const pin = output("Output");
    expect(fixedExpressionOutputType(node(expressionClass, [pin]), pin)).toBe(expected);
  });

  it("declares generic same-type expressions explicitly", () => {
    expect(equivalentExpressionInputs(node("MaterialExpressionDDX", [])))
      .toEqual(["Value"]);
    expect(equivalentExpressionInputs(node("MaterialExpressionDDY", [])))
      .toEqual(["Value"]);
    expect(equivalentExpressionInputs(node("MaterialExpressionVertexInterpolator", [])))
      .toEqual(["VS", "Input"]);
    expect(equivalentExpressionInputs(node("MaterialExpressionShaderStageSwitch", [])))
      .toEqual(["PixelShader", "VertexShader"]);
    expect(equivalentExpressionInputs(node("MaterialExpressionSaturate", [])))
      .toEqual(["Input"]);
  });

  it("preserves derivative texture-sampling controls from serialized pins", () => {
    const source = [
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="MaterialGraphNode_Test"',
      'Begin Object Class=/Script/Engine.MaterialExpressionTextureSample Name="Expression_0"',
      "End Object", 'Begin Object Name="Expression_0"', "End Object",
      'CustomProperties Pin (PinId=00000000000000000000000000000001,PinName="UVs",DefaultValue="0.0")',
      'CustomProperties Pin (PinId=00000000000000000000000000000002,PinName="MipValueMode",DefaultValue="Derivative")',
      'CustomProperties Pin (PinId=00000000000000000000000000000003,PinName="DDX",DefaultValue="0.0")',
      'CustomProperties Pin (PinId=00000000000000000000000000000004,PinName="DDY",DefaultValue="0.0")',
      'CustomProperties Pin (PinId=00000000000000000000000000000005,PinName="R",Direction="EGPD_Output",PinType.PinSubCategory="red")',
      "End Object",
    ].join("\n");
    const result = analyzeClipboard(source);
    expect(result.code).toContain("MipValueMode: Derivative");
    expect(result.code).toContain("DDX:");
    expect(result.code).toContain("DDY:");
    expect(result.code).toContain("float R = TextureSample(");
  });

  it("normalizes displaced UE texture enum defaults by enum domain", () => {
    const source = [
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="MaterialGraphNode_Test"',
      'Begin Object Class=/Script/Engine.MaterialExpressionTextureSampleParameter2D Name="Expression_0"',
      "End Object", 'Begin Object Name="Expression_0"', 'ParameterName="Param"', "End Object",
      'CustomProperties Pin (PinId=00000000000000000000000000000001,PinName="MipValueMode",DefaultValue="None (use computed mip level)")',
      'CustomProperties Pin (PinId=00000000000000000000000000000002,PinName="Sampler Source",DefaultValue="None (use computed mip level)")',
      'CustomProperties Pin (PinId=00000000000000000000000000000003,PinName="Sampler Type",DefaultValue="From texture asset")',
      'CustomProperties Pin (PinId=00000000000000000000000000000004,PinName="RGB",Direction="EGPD_Output")',
      "End Object",
    ].join("\n");
    const result = analyzeClipboard(source);
    expect(result.code).toContain("MipValueMode: None_use_computed_mip_level");
    expect(result.code).toContain("Sampler_Source: From_texture_asset");
    expect(result.code).not.toContain("Sampler_Type:");
  });

  it.each([
    ["/Script/Engine.Texture2D'/Game/T.T'", "Texture2D"],
    ["/Script/Engine.TextureCube'/Game/T.T'", "TextureCube"],
    ["/Script/Engine.Texture2DArray'/Game/T.T'", "Texture2DArray"],
    ["/Script/Engine.VolumeTexture'/Game/T.T'", "Texture3D"],
    ["None", undefined],
  ])("derives TextureObject type from its serialized asset class: %s", (texture, expected) => {
    const pin = output("Output");
    expect(fixedExpressionOutputType(
      node("MaterialExpressionTextureObject", [pin], new Map([["Texture", texture]])),
      pin,
    )).toBe(expected);
  });

  it("does not render inherited sampler controls on a TextureObjectParameter", () => {
    const source = [
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="MaterialGraphNode_Test"',
      'Begin Object Class=/Script/Engine.MaterialExpressionTextureObjectParameter Name="Expression_0"',
      "End Object", 'Begin Object Name="Expression_0"', 'ParameterName="ObjectParam"', "Texture=None", "End Object",
      'CustomProperties Pin (PinId=00000000000000000000000000000001,PinName="MipValueMode",DefaultValue="None (use computed mip level)")',
      'CustomProperties Pin (PinId=00000000000000000000000000000002,PinName="Output",Direction="EGPD_Output")',
      "End Object",
    ].join("\n");
    const result = analyzeClipboard(source);
    expect(result.code).toContain("TextureObjectParameter(Parameter: ObjectParam)");
    expect(result.code).not.toContain("MipValueMode:");
  });

  it.each([
    ["Base Color", "float3"],
    ["Roughness", "float"],
    ["CustomizedUV3", "float2"],
    ["ShadingModel", "ShadingModel"],
  ])("types dynamic Material Attribute %s as %s", (pinName, expected) => {
    const pin = output(pinName);
    expect(fixedExpressionOutputType(node("MaterialExpressionGetMaterialAttributes", [pin]), pin))
      .toBe(expected);
  });

  it("treats connected runtime virtual texture inputs as named graph outputs", () => {
    const source = [
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="MaterialGraphNode_Output"',
      'Begin Object Class=/Script/Engine.MaterialExpressionRuntimeVirtualTextureOutput Name="Output_0"',
      "End Object", 'Begin Object Name="Output_0"', "End Object",
      'CustomProperties Pin (PinId=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,PinName="BaseColor",PinType.PinCategory="required",LinkedTo=(MaterialGraphNode_Value BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="MaterialGraphNode_Value"',
      'Begin Object Class=/Script/Engine.MaterialExpressionConstant3Vector Name="Value_0"',
      "End Object", 'Begin Object Name="Value_0"', "Constant=(R=1.0,G=0.5,B=0.25)", "End Object",
      'CustomProperties Pin (PinId=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB,PinName="Output",Direction="EGPD_Output",LinkedTo=(MaterialGraphNode_Output AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA))',
      "End Object",
    ].join("\n");

    const result = analyzeClipboard(source);
    expect(result.outputs.map((item) => item.label)).toContain("RuntimeVirtualTextureOutput.BaseColor");
    expect(result.code).toContain("float3 RuntimeVirtualTextureOutput_BaseColor");
  });

  it("covers every supplied UE 5.8 Substrate expression and output", () => {
    const classes = [
      "MaterialExpressionSubstrateAdd",
      "MaterialExpressionSubstrateConvertMaterialAttributes",
      "MaterialExpressionSubstrateConvertToDecal",
      "MaterialExpressionSubstrateHazinessToSecondaryRoughness",
      "MaterialExpressionSubstrateHorizontalMixing",
      "MaterialExpressionSubstrateLightFunction",
      "MaterialExpressionSubstrateMetalnessToDiffuseAlbedoF0",
      "MaterialExpressionSubstratePostProcess",
      "MaterialExpressionSubstrateSelect",
      "MaterialExpressionSubstrateShadingModels",
      "MaterialExpressionSubstrateThinFilm",
      "MaterialExpressionSubstrateTransmittanceToMFP",
      "MaterialExpressionSubstrateUI",
      "MaterialExpressionSubstrateVerticalLayering",
      "MaterialExpressionSubstrateWeight",
    ];
    expect(Object.keys(advancedExpressionSemantics)).toEqual(expect.arrayContaining(classes));

    const source = readFileSync(resolve(
      "docs/raw/ue5.8-clipboard-captures/substrate-expressions.clipboard.txt",
    ), "utf8");
    const initial = analyzeClipboard(source);
    expect(initial.outputs).toHaveLength(19);
    for (const output of initial.outputs) {
      const result = analyzeClipboard(source, { outputId: output.id });
      expect(result.diagnostics, output.label).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "unsupported-node" })]),
      );
    }
  });
});
