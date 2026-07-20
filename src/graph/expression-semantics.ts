import type { MaterialType, NumericType } from "./material-types";
import type { GraphNode, GraphPin } from "./types";

export type MathRenderKind = "call" | "operator" | "special";
export type MathTypeRule =
  | "same"
  | "arithmetic"
  | "branches"
  | "append"
  | "component-mask"
  | "float-to-uint"
  | "uint-to-float"
  | "fixed-float"
  | "fixed-float3"
  | "modulo";

export interface MathExpressionSemantics {
  render: MathRenderKind;
  token: string;
  inputs: readonly string[];
  typeRule: MathTypeRule;
  resultInput?: string;
  inputAliases?: Readonly<Record<string, readonly string[]>>;
  inputDefaults?: Readonly<Record<string, string>>;
}

const call = (
  token: string,
  inputs: readonly string[],
  typeRule: MathTypeRule = "same",
  resultInput?: string,
): MathExpressionSemantics => ({ render: "call", token, inputs, typeRule, resultInput });

const operator = (
  token: string,
  inputDefaults?: Readonly<Record<string, string>>,
): MathExpressionSemantics => ({
  render: "operator",
  token,
  inputs: ["A", "B"],
  typeRule: "arithmetic",
  inputDefaults,
});

export const mathExpressionSemantics = {
  MaterialExpressionAbs: call("abs", ["Input"]),
  MaterialExpressionAdd: operator("+", { A: "ConstA", B: "ConstB" }),
  MaterialExpressionAppendVector: call("Append", ["A", "B"], "append"),
  MaterialExpressionArccosine: call("acos", ["Input"]),
  MaterialExpressionArccosineFast: call("AcosFast", ["Input"]),
  MaterialExpressionArcsine: call("asin", ["Input"]),
  MaterialExpressionArcsineFast: call("AsinFast", ["Input"]),
  MaterialExpressionArctangent: call("atan", ["Input"]),
  MaterialExpressionArctangent2: call("atan2", ["Y", "X"], "arithmetic"),
  MaterialExpressionArctangent2Fast: call("Atan2Fast", ["Y", "X"], "arithmetic"),
  MaterialExpressionArctangentFast: call("AtanFast", ["Input"]),
  MaterialExpressionCeil: call("ceil", ["Input"]),
  MaterialExpressionClamp: call("clamp", ["Input", "Min", "Max"], "same", "Input"),
  MaterialExpressionComponentMask: call("ComponentMask", ["Input"], "component-mask"),
  MaterialExpressionCosine: call("cos", ["Input"]),
  MaterialExpressionCrossProduct: call("cross", ["A", "B"], "fixed-float3"),
  MaterialExpressionDivide: operator("/", { A: "ConstA", B: "ConstB" }),
  MaterialExpressionDotProduct: call("dot", ["A", "B"], "fixed-float"),
  MaterialExpressionExponential: call("exp", ["Input"]),
  MaterialExpressionExponential2: call("exp2", ["Input"]),
  MaterialExpressionFloatToUInt: call("FloatToUInt", ["Input"], "float-to-uint"),
  MaterialExpressionFloor: call("floor", ["Input"]),
  MaterialExpressionFmod: call("fmod", ["A", "B"], "arithmetic"),
  MaterialExpressionFrac: call("frac", ["Input"]),
  MaterialExpressionHsvToRgb: call("HsvToRgb", ["Input"], "fixed-float3"),
  MaterialExpressionIf: call(
    "If",
    ["A", "B", "A > B", "A == B", "A < B", "Equals Threshold"],
    "branches",
  ),
  MaterialExpressionInverseLinearInterpolate: call(
    "inverseLerp",
    ["A", "B", "Value"],
    "same",
    "Value",
  ),
  MaterialExpressionLinearInterpolate: {
    ...call("lerp", ["A", "B", "Alpha"], "arithmetic"),
    inputDefaults: { A: "ConstA", B: "ConstB", Alpha: "ConstAlpha" },
  },
  MaterialExpressionLogarithm: call("log", ["Input"]),
  MaterialExpressionLogarithm10: call("log10", ["X"]),
  MaterialExpressionLogarithm2: call("log2", ["X"]),
  MaterialExpressionMax: call("max", ["A", "B"], "arithmetic"),
  MaterialExpressionMin: call("min", ["A", "B"], "arithmetic"),
  MaterialExpressionModulo: { render: "operator", token: "%", inputs: ["A", "B"], typeRule: "modulo" },
  MaterialExpressionMultiply: operator("*", { A: "ConstA", B: "ConstB" }),
  MaterialExpressionNormalize: {
    ...call("normalize", ["VectorInput"]),
    inputAliases: { VectorInput: ["Input"] },
  },
  MaterialExpressionOneMinus: call("OneMinus", ["Input"]),
  MaterialExpressionPower: {
    ...call("pow", ["Base", "Exp"], "same", "Base"),
    inputAliases: { Exp: ["Exponent"] },
    inputDefaults: { Exp: "ConstExponent" },
  },
  MaterialExpressionRgbToHsv: call("RgbToHsv", ["Input"], "fixed-float3"),
  MaterialExpressionRound: call("round", ["Input"]),
  MaterialExpressionSaturate: call("saturate", ["Input"]),
  MaterialExpressionSign: call("sign", ["Input"]),
  MaterialExpressionSine: call("sin", ["Input"]),
  MaterialExpressionSmoothStep: call("smoothstep", ["Min", "Max", "Value"], "same", "Value"),
  MaterialExpressionSquareRoot: call("sqrt", ["Input"]),
  MaterialExpressionStep: call("step", ["Y", "X"], "same", "X"),
  MaterialExpressionSubtract: operator("-"),
  MaterialExpressionSwitch: call("Switch", ["SwitchValue", "Default"], "branches"),
  MaterialExpressionTangent: call("tan", ["Input"]),
  MaterialExpressionTruncate: call("trunc", ["Input"]),
  MaterialExpressionUIntToFloat: call("UIntToFloat", ["Input"], "uint-to-float"),
} as const satisfies Readonly<Record<string, MathExpressionSemantics>>;

export type KnownMathExpressionClass = keyof typeof mathExpressionSemantics;

export function mathExpression(
  expressionClass: string,
): MathExpressionSemantics | undefined {
  return mathExpressionSemantics[expressionClass as KnownMathExpressionClass];
}

export function mathInputNames(
  semantics: MathExpressionSemantics,
  inputName: string,
): readonly string[] {
  return [inputName, ...(semantics.inputAliases?.[inputName] ?? [])];
}

export function mathInputDefault(
  semantics: MathExpressionSemantics,
  inputName: string,
): string | undefined {
  return semantics.inputDefaults?.[inputName];
}

export interface BuiltInExpressionSemantics {
  token: string;
  inputs: readonly string[];
  outputs: readonly NumericType[];
  selectors?: readonly string[];
}

const source = (
  token: string,
  outputs: readonly NumericType[],
  selectors?: readonly string[],
): BuiltInExpressionSemantics => ({ token, inputs: [], outputs, selectors });

const operation = (
  token: string,
  inputs: readonly string[],
  outputs: readonly NumericType[],
): BuiltInExpressionSemantics => ({ token, inputs, outputs });

/** UE 5.8 constants and deterministic engine-provided input data. */
export const inputDataExpressionSemantics = {
  MaterialExpressionActorPositionWS: source("ActorPositionWS", ["float3"]),
  MaterialExpressionCameraPositionWS: source("CameraPositionWS", ["float3"]),
  MaterialExpressionCameraVectorWS: source("CameraVectorWS", ["float3"]),
  MaterialExpressionConstant2Vector: source("Constant2Vector", ["float2", "float", "float"], ["", ".r", ".g"]),
  MaterialExpressionConstant3Vector: source("Constant3Vector", ["float3", "float", "float", "float"], ["", ".r", ".g", ".b"]),
  MaterialExpressionConstant4Vector: source("Constant4Vector", ["float4", "float", "float", "float", "float", "float3"], ["", ".r", ".g", ".b", ".a", ".rgb"]),
  MaterialExpressionConstantDouble: source("ConstantDouble", ["float"]),
  MaterialExpressionDistanceCullFade: source("DistanceCullFade", ["float"]),
  MaterialExpressionDynamicParameter: source("DynamicParameter", ["float", "float", "float", "float"], [".Param1", ".Param2", ".Param3", ".Param4"]),
  MaterialExpressionFontSignedDistance: source("FontSignedDistance", ["float", "float", "float", "float"], [".SignedDistance", ".SmoothSignedDistance", ".PixelDistanceFactor", ".ImplicitOpacity"]),
  MaterialExpressionIsFirstPerson: source("IsFirstPerson", ["float"]),
  MaterialExpressionIsOrthographic: source("IsOrthographic", ["float"]),
  MaterialExpressionLightmapUVs: source("LightmapUVs", ["float2"]),
  MaterialExpressionLightVector: source("LightVector", ["float3"]),
  MaterialExpressionLocalPosition: source("LocalPosition", ["float3", "float2", "float"], ["", ".xy", ".z"]),
  MaterialExpressionObjectOrientation: source("ObjectOrientation", ["float3"]),
  MaterialExpressionObjectBounds: source("ObjectBounds", ["float3"]),
  MaterialExpressionObjectPositionWS: source("ObjectPositionWS", ["float3"]),
  MaterialExpressionObjectRadius: source("ObjectRadius", ["float"]),
  MaterialExpressionPanner: operation("Panner", ["Coordinate", "Time", "Speed"], ["float2"]),
  MaterialExpressionParticleColor: source("ParticleColor", ["float3", "float", "float", "float", "float", "float4"], [".rgb", ".r", ".g", ".b", ".a", ""]),
  MaterialExpressionParticleDirection: source("ParticleDirection", ["float3"]),
  MaterialExpressionParticleMotionBlurFade: source("ParticleMotionBlurFade", ["float"]),
  MaterialExpressionParticleMacroUV: source("ParticleMacroUV", ["float2"]),
  MaterialExpressionParticlePositionWS: source("ParticlePositionWS", ["float3"]),
  MaterialExpressionParticleRadius: source("ParticleRadius", ["float"]),
  MaterialExpressionParticleRandom: source("ParticleRandom", ["float"]),
  MaterialExpressionParticleRelativeTime: source("ParticleRelativeTime", ["float"]),
  MaterialExpressionParticleSize: source("ParticleSize", ["float2"]),
  MaterialExpressionParticleSpeed: source("ParticleSpeed", ["float"]),
  MaterialExpressionParticleSpriteRotation: source("ParticleSpriteRotation", ["float", "float"], [".Radians", ".Degrees"]),
  MaterialExpressionParticleSubUVProperties: source("ParticleSubUVProperties", ["float2", "float2", "float"], [".TextureCoordinate0", ".TextureCoordinate1", ".Blend"]),
  MaterialExpressionPerInstanceFadeAmount: source("PerInstanceFadeAmount", ["float"]),
  MaterialExpressionPerInstanceRandom: source("PerInstanceRandom", ["float"]),
  MaterialExpressionPixelDepth: source("PixelDepth", ["float"]),
  MaterialExpressionPixelNormalWS: source("PixelNormalWS", ["float3"]),
  MaterialExpressionPrecomputedAOMask: source("PrecomputedAOMask", ["float"]),
  MaterialExpressionPreSkinnedNormal: source("PreSkinnedNormal", ["float3"]),
  MaterialExpressionPreSkinnedPosition: source("PreSkinnedPosition", ["float3"]),
  MaterialExpressionReflectionVectorWS: source("ReflectionVectorWS", ["float3"]),
  MaterialExpressionRotator: operation("Rotator", ["Coordinate", "Time", "Center X", "Center Y", "Speed"], ["float2"]),
  MaterialExpressionSceneDepth: operation("SceneDepth", ["UVs", "Input Mode"], ["float"]),
  MaterialExpressionSceneTexelSize: source("SceneTexelSize", ["float2"]),
  MaterialExpressionScreenPosition: source("ScreenPosition", ["float2", "float2"], [".ViewportUV", ".PixelPosition"]),
  MaterialExpressionSphericalParticleOpacity: operation("SphericalParticleOpacity", ["Density"], ["float"]),
  MaterialExpressionTextureCoordinate: operation("TextureCoordinate", ["Coordinate Index", "UTiling", "VTiling", "Un Mirror U", "Un Mirror V"], ["float2"]),
  MaterialExpressionTime: source("Time", ["float"]),
  MaterialExpressionTruncateLWC: operation("TruncateLWC", ["Input"], ["float3"]),
  MaterialExpressionTwoSidedSign: source("TwoSidedSign", ["float"]),
  MaterialExpressionVertexColor: source("VertexColor", ["float3", "float", "float", "float", "float"], [".rgb", ".r", ".g", ".b", ".a"]),
  MaterialExpressionVertexNormalWS: source("VertexNormalWS", ["float3"]),
  MaterialExpressionVertexTangentWS: source("VertexTangentWS", ["float3"]),
  MaterialExpressionViewProperty: source("ViewProperty", ["float", "float"], [".Property", ".InvProperty"]),
  MaterialExpressionViewSize: source("ViewSize", ["float2"]),
  MaterialExpressionWorldPosition: source("WorldPosition", ["float3", "float2", "float"], ["", ".xy", ".z"]),
} as const satisfies Readonly<Record<string, BuiltInExpressionSemantics>>;

export type KnownInputDataExpressionClass = keyof typeof inputDataExpressionSemantics;

export function inputDataExpression(expressionClass: string): BuiltInExpressionSemantics | undefined {
  return inputDataExpressionSemantics[expressionClass as KnownInputDataExpressionClass];
}

function outputIndex(node: GraphNode, pin: GraphPin): number {
  return node.pins.filter((candidate) => candidate.direction === "output")
    .findIndex((candidate) => candidate.id === pin.id);
}

export function inputDataOutputLabel(node: GraphNode, pin: GraphPin): string | undefined {
  const selector = inputDataExpression(node.expressionClass)?.selectors?.[outputIndex(node, pin)];
  if (!selector) return undefined;
  const field = selector.slice(1);
  return /^(?:r|g|b|a|rgb|rgba)$/i.test(field) ? field.toUpperCase() : field;
}

export interface AdvancedExpressionSemantics {
  token: string;
  defaultOutput?: MaterialType;
  outputs?: Readonly<Record<string, MaterialType>>;
  branches?: boolean;
  terminal?: boolean;
}

const advanced = (
  token: string,
  defaultOutput?: MaterialType,
  outputs?: Readonly<Record<string, MaterialType>>,
  options: Pick<AdvancedExpressionSemantics, "branches" | "terminal"> = {},
): AdvancedExpressionSemantics => ({ token, defaultOutput, outputs, ...options });

const colorOutputs = {
  RGB: "float3", R: "float", G: "float", B: "float", A: "float", RGBA: "float4",
} as const;

const runtimeVirtualTextureOutputs = {
  BaseColor: "float3", Specular: "float", Roughness: "float", Normal: "float3",
  WorldHeight: "float", Mask: "float", Displacement: "float", Mask4: "float4",
} as const;

/** UE 5.8 parameters, attributes, samplers, switches, Substrate and environment nodes. */
export const advancedExpressionSemantics = {
  MaterialExpressionAtmosphericFogColor: advanced("AtmosphericFogColor", "float3"),
  MaterialExpressionAtmosphericLightColor: advanced("AtmosphericLightColor", "float3"),
  MaterialExpressionAtmosphericLightVector: advanced("AtmosphericLightVector", "float3"),
  MaterialExpressionBlendMaterialAttributes: advanced("BlendMaterialAttributes", "MaterialAttributes"),
  MaterialExpressionBreakMaterialAttributes: advanced("BreakMaterialAttributes"),
  MaterialExpressionCollectionParameter: advanced("CollectionParameter"),
  MaterialExpressionConstantBiasScale: advanced("ConstantBiasScale"),
  MaterialExpressionDistance: advanced("distance", "float"),
  MaterialExpressionDistanceFieldApproxAO: advanced("DistanceFieldApproxAO", "float"),
  MaterialExpressionDistanceFieldGradient: advanced("DistanceFieldGradient", "float3"),
  MaterialExpressionDistanceToNearestSurface: advanced("DistanceToNearestSurface", "float"),
  MaterialExpressionFeatureLevelSwitch: advanced("FeatureLevelSwitch", undefined, undefined, { branches: true }),
  MaterialExpressionGetMaterialAttributes: advanced("GetMaterialAttributes"),
  MaterialExpressionLayerStack: advanced("LayerStack", "MaterialAttributes"),
  MaterialExpressionLandscapeGrassOutput: advanced("LandscapeGrassOutput", undefined, undefined, { terminal: true }),
  MaterialExpressionLandscapeLayerSample: advanced("LandscapeLayerSample", "float"),
  MaterialExpressionLightVector: advanced("LightVector", "float3"),
  MaterialExpressionMainDirectionalLight: advanced("MainDirectionalLight", undefined, { Illuminance: "float3", Direction: "float3" }),
  MaterialExpressionMakeMaterialAttributes: advanced("MakeMaterialAttributes", "MaterialAttributes"),
  MaterialExpressionParticleSubUV: advanced("ParticleSubUV", "float4", colorOutputs),
  MaterialExpressionParticleSubUVProperties: advanced("ParticleSubUVProperties", undefined, { TextureCoordinate0: "float2", TextureCoordinate1: "float2", Blend: "float" }),
  MaterialExpressionPathTracingRayTypeSwitch: advanced("PathTracingRayTypeSwitch", undefined, undefined, { branches: true }),
  MaterialExpressionPerInstanceCustomData: advanced("PerInstanceCustomData", "float"),
  MaterialExpressionPerInstanceCustomData3Vector: advanced("PerInstanceCustomData3Vector", "float3"),
  MaterialExpressionQualitySwitch: advanced("QualitySwitch", undefined, undefined, { branches: true }),
  MaterialExpressionRayTracingQualitySwitch: advanced("RayTracingQualitySwitch", undefined, undefined, { branches: true }),
  MaterialExpressionRuntimeVirtualTextureCustomData: advanced("RuntimeVirtualTextureCustomData", "float4"),
  MaterialExpressionRuntimeVirtualTextureOutput: advanced("RuntimeVirtualTextureOutput", undefined, undefined, { terminal: true }),
  MaterialExpressionRuntimeVirtualTextureReplace: advanced("RuntimeVirtualTextureReplace", undefined, undefined, { branches: true }),
  MaterialExpressionNoise: advanced("Noise", "float"),
  MaterialExpressionScalarBlueNoise: advanced("ScalarBlueNoise", "float"),
  MaterialExpressionRuntimeVirtualTextureSample: advanced("RuntimeVirtualTextureSample", undefined, runtimeVirtualTextureOutputs),
  MaterialExpressionRuntimeVirtualTextureSampleParameter: advanced("RuntimeVirtualTextureSampleParameter", undefined, runtimeVirtualTextureOutputs),
  MaterialExpressionScalarParameter: advanced("ScalarParameter", "float"),
  MaterialExpressionSetMaterialAttributes: advanced("SetMaterialAttributes", "MaterialAttributes"),
  MaterialExpressionShadingPathSwitch: advanced("ShadingPathSwitch", undefined, undefined, { branches: true }),
  MaterialExpressionShadingModel: advanced("ShadingModel", "ShadingModel"),
  MaterialExpressionShadowReplace: advanced("ShadowReplace", undefined, undefined, { branches: true }),
  MaterialExpressionSkyAtmosphereAerialPerspective: advanced("SkyAtmosphereAerialPerspective", "float4"),
  MaterialExpressionSkyAtmosphereDistantLightScatteredLuminance: advanced("SkyAtmosphereDistantLightScatteredLuminance", "float3"),
  MaterialExpressionSkyAtmosphereLightDirection: advanced("SkyAtmosphereLightDirection", "float3"),
  MaterialExpressionSkyAtmosphereLightDiskLuminance: advanced("SkyAtmosphereLightDiskLuminance", "float3"),
  MaterialExpressionSkyAtmosphereLightIlluminance: advanced("SkyAtmosphereLightIlluminance", "float3"),
  MaterialExpressionSkyAtmosphereLightIlluminanceOnGround: advanced("SkyAtmosphereLightIlluminanceOnGround", "float3"),
  MaterialExpressionSkyAtmosphereViewLuminance: advanced("SkyAtmosphereViewLuminance", "float3"),
  MaterialExpressionSkyLightEnvMapSample: advanced("SkyLightEnvMapSample", "float3"),
  MaterialExpressionSparseVolumeTextureObject: advanced("SparseVolumeTextureObject", "SparseVolumeTexture"),
  MaterialExpressionSparseVolumeTextureObjectParameter: advanced("SparseVolumeTextureObjectParameter", "SparseVolumeTexture"),
  MaterialExpressionSparseVolumeTextureSample: advanced("SparseVolumeTextureSample", undefined, { "Attributes A": "float4", "Attributes B": "float4" }),
  MaterialExpressionSparseVolumeTextureSampleParameter: advanced("SparseVolumeTextureSampleParameter", undefined, { "Attributes A": "float4", "Attributes B": "float4" }),
  MaterialExpressionStaticBool: advanced("StaticBool", "static bool"),
  MaterialExpressionStaticBoolParameter: advanced("StaticBoolParameter", "static bool"),
  MaterialExpressionStaticSwitch: advanced("StaticSwitch", undefined, undefined, { branches: true }),
  MaterialExpressionStaticSwitchParameter: advanced("StaticSwitchParameter", undefined, undefined, { branches: true }),
  MaterialExpressionSubstrateAdd: advanced("SubstrateAdd", "Substrate"),
  MaterialExpressionSubstrateConvertMaterialAttributes: advanced("SubstrateConvertMaterialAttributes", "Substrate"),
  MaterialExpressionSubstrateConvertToDecal: advanced("SubstrateConvertToDecal", "Substrate"),
  MaterialExpressionSubstrateEyeBSDF: advanced("SubstrateEyeBSDF", "Substrate"),
  MaterialExpressionSubstrateHairBSDF: advanced("SubstrateHairBSDF", "Substrate"),
  MaterialExpressionSubstrateHazinessToSecondaryRoughness: advanced(
    "SubstrateHazinessToSecondaryRoughness",
    undefined,
    { "Second Roughness": "float", "Second Roughness Weight": "float" },
  ),
  MaterialExpressionSubstrateHorizontalMixing: advanced("SubstrateHorizontalMixing", "Substrate"),
  MaterialExpressionSubstrateLightFunction: advanced("SubstrateLightFunction", "Substrate"),
  MaterialExpressionSubstrateSimpleClearCoatBSDF: advanced("SubstrateSimpleClearCoatBSDF", "Substrate"),
  MaterialExpressionSubstrateSingleLayerWaterBSDF: advanced("SubstrateSingleLayerWaterBSDF", "Substrate"),
  MaterialExpressionSubstrateSlabBSDF: advanced("SubstrateSlabBSDF", "Substrate"),
  MaterialExpressionSubstrateMetalnessToDiffuseAlbedoF0: advanced(
    "SubstrateMetalnessToDiffuseAlbedoF0",
    undefined,
    { DiffuseAlbedo: "float3", F0: "float3" },
  ),
  MaterialExpressionSubstratePostProcess: advanced("SubstratePostProcess", "Substrate"),
  MaterialExpressionSubstrateSelect: advanced("SubstrateSelect", "Substrate"),
  MaterialExpressionSubstrateShadingModels: advanced("SubstrateShadingModels", "Substrate"),
  MaterialExpressionSubstrateThinFilm: advanced(
    "SubstrateThinFilm",
    undefined,
    { "Specular Color": "float3", "Edge Specular Color": "float3" },
  ),
  MaterialExpressionSubstrateToonBSDF: advanced("SubstrateToonBSDF", "Substrate"),
  MaterialExpressionSubstrateTransmittanceToMFP: advanced(
    "SubstrateTransmittanceToMFP",
    undefined,
    { MFP: "float3", Thickness: "float" },
  ),
  MaterialExpressionSubstrateUI: advanced("SubstrateUI", "Substrate"),
  MaterialExpressionSubstrateUnlitBSDF: advanced("SubstrateUnlitBSDF", "Substrate"),
  MaterialExpressionSubstrateVerticalLayering: advanced("SubstrateVerticalLayering", "Substrate"),
  MaterialExpressionSubstrateVolumetricFogCloudBSDF: advanced("SubstrateVolumetricFogCloudBSDF", "Substrate"),
  MaterialExpressionSubstrateWeight: advanced("SubstrateWeight", "Substrate"),
  MaterialExpressionPreviousFrameSwitch: advanced("PreviousFrameSwitch", undefined, undefined, { branches: true }),
  MaterialExpressionRotateAboutAxis: advanced("RotateAboutAxis", "float3"),
  MaterialExpressionSphereMask: advanced("SphereMask", "float"),
  MaterialExpressionTextureObject: advanced("TextureObject"),
  MaterialExpressionTextureObjectParameter: advanced("TextureObjectParameter"),
  MaterialExpressionTextureSample: advanced("TextureSample", "float4", colorOutputs),
  MaterialExpressionTextureSampleParameter2D: advanced("TextureSampleParameter2D", "float4", colorOutputs),
  MaterialExpressionTextureSampleParameter2DArray: advanced("TextureSampleParameter2DArray", "float4", colorOutputs),
  MaterialExpressionTextureSampleParameterCube: advanced("TextureSampleParameterCube", "float4", colorOutputs),
  MaterialExpressionTextureSampleParameterCubeArray: advanced("TextureSampleParameterCubeArray", "float4", colorOutputs),
  MaterialExpressionTextureSampleParameterSubUV: advanced("TextureSampleParameterSubUV", "float4", colorOutputs),
  MaterialExpressionTextureSampleParameterVolume: advanced("TextureSampleParameterVolume", "float4", colorOutputs),
  MaterialExpressionVectorParameter: advanced("VectorParameter", "float4", colorOutputs),
  MaterialExpressionVectorNoise: advanced("VectorNoise"),
  MaterialExpressionVirtualTextureFeatureSwitch: advanced("VirtualTextureFeatureSwitch", undefined, undefined, { branches: true }),
  MaterialExpressionVolumetricAdvancedMaterialInput: advanced("VolumetricAdvancedMaterialInput", undefined, { "ConservativeDensity as Float3": "float3", "ConservativeDensity as Float4": "float4" }),
  MaterialExpressionVolumetricAdvancedMaterialOutput: advanced("VolumetricAdvancedMaterialOutput", undefined, undefined, { terminal: true }),
  MaterialExpressionVolumetricCloudEmptySpaceSkippingInput: advanced("VolumetricCloudEmptySpaceSkippingInput", undefined, { "Sphere Center": "float3", "Sphere Radius": "float" }),
  MaterialExpressionVolumetricCloudEmptySpaceSkippingOutput: advanced("VolumetricCloudEmptySpaceSkippingOutput", undefined, undefined, { terminal: true }),
} as const satisfies Readonly<Record<string, AdvancedExpressionSemantics>>;

export type KnownAdvancedExpressionClass = keyof typeof advancedExpressionSemantics;

export function advancedExpression(expressionClass: string): AdvancedExpressionSemantics | undefined {
  return advancedExpressionSemantics[expressionClass as KnownAdvancedExpressionClass];
}

export interface ProceduralNoiseSemantics {
  token: string;
  outputType: MaterialType;
  inputs: readonly string[];
  settings: readonly (readonly [name: string, value: string])[];
}

const scalarNoiseModes: Readonly<Record<string, string>> = {
  NOISEFUNCTION_SimplexTex: "SimplexTexture",
  NOISEFUNCTION_GradientTex: "GradientTexture",
  NOISEFUNCTION_GradientTex3D: "FastGradient3DTexture",
  NOISEFUNCTION_GradientALU: "GradientALU",
  NOISEFUNCTION_ValueALU: "ValueALU",
  NOISEFUNCTION_VoronoiALU: "VoronoiALU",
};

const vectorNoiseModes: Readonly<Record<string, readonly [string, MaterialType]>> = {
  VNF_CellnoiseALU: ["CellNoise", "float3"],
  VNF_VectorALU: ["Perlin3D", "float3"],
  VNF_GradientALU: ["PerlinGradient", "float4"],
  VNF_CurlALU: ["PerlinCurl", "float3"],
  VNF_VoronoiALU: ["Voronoi", "float4"],
};

function pinDefault(node: GraphNode, name: string): string | undefined {
  return node.pins.find((pin) => pin.name === name)?.defaultValue;
}

export function proceduralNoiseExpression(node: GraphNode): ProceduralNoiseSemantics | undefined {
  if (node.expressionClass === "MaterialExpressionScalarBlueNoise") {
    return { token: "ScalarBlueNoise", outputType: "float", inputs: [], settings: [] };
  }
  if (node.expressionClass === "MaterialExpressionNoise") {
    const mode = node.properties.get("NoiseFunction") ?? "NOISEFUNCTION_SimplexTex";
    const settings: [string, string][] = [["Function", scalarNoiseModes[mode] ?? mode]];
    for (const [label, property] of [
      ["Scale", "Scale"], ["Quality", "Quality"], ["Levels", "Levels"],
      ["OutputMin", "OutputMin"], ["OutputMax", "OutputMax"], ["LevelScale", "LevelScale"],
      ["Turbulence", "bTurbulence"], ["Tiling", "bTiling"], ["RepeatSize", "RepeatSize"],
      ["Origin", "WorldPositionOriginType"],
    ] as const) {
      const value = node.properties.get(property);
      if (value !== undefined) settings.push([label, value]);
    }
    return {
      token: "Noise",
      outputType: "float",
      inputs: ["World Position", "FilterWidth"],
      settings,
    };
  }
  if (node.expressionClass === "MaterialExpressionVectorNoise") {
    const mode = node.properties.get("NoiseFunction") ?? "VNF_CellnoiseALU";
    const [name, outputType] = vectorNoiseModes[mode] ?? [mode, "float4"];
    return {
      token: "VectorNoise",
      outputType,
      inputs: ["World Position"],
      settings: [
        ["Function", name],
        ["Quality", node.properties.get("Quality") ?? pinDefault(node, "Quality") ?? "1"],
        ["Tiling", node.properties.get("bTiling") ?? pinDefault(node, "Tiling") ?? "false"],
        ["TileSize", node.properties.get("TileSize") ?? pinDefault(node, "Tile Size") ?? "300"],
      ],
    };
  }
  return undefined;
}

const knownMaterialFunctionOutputs: Readonly<Record<string, readonly MaterialType[]>> = {
  BreakOutFloat2Components: ["float", "float"],
  BreakOutFloat3Components: ["float", "float", "float"],
  MakeFloat3: ["float3"],
  ScreenAlignedPixelToPixelUVs: ["float2"],
};

export function knownMaterialFunctionOutputType(
  node: GraphNode,
  pin: GraphPin,
): MaterialType | undefined {
  if (node.expressionClass !== "MaterialExpressionMaterialFunctionCall") return undefined;
  const target = node.properties.get("MaterialFunction") ?? "";
  const path = target.match(/"([^"]+)"/)?.[1] ?? target;
  const name = ((path.split("/").at(-1) ?? path).split(".").at(-1) ?? path)
    .replace(/[^A-Za-z0-9_]/g, "");
  const index = node.pins.filter((candidate) => candidate.direction === "output").indexOf(pin);
  return index >= 0 ? knownMaterialFunctionOutputs[name]?.[index] : undefined;
}

export function isTerminalExpression(node: GraphNode): boolean {
  return advancedExpression(node.expressionClass)?.terminal === true;
}

function normalizedPinName(name: string): string {
  return name.replace(/[ _]/g, "").toLowerCase();
}

export function materialAttributeType(name: string): MaterialType | undefined {
  const normalized = normalizedPinName(name);
  if (/^customizeduvs?\d$/.test(normalized)) return "float2";
  if (["basecolor", "emissivecolor", "normal", "tangent", "worldpositionoffset", "subsurfacecolor"].includes(normalized)) return "float3";
  if (normalized === "shadingmodel") return "ShadingModel";
  if ([
    "metallic", "specular", "roughness", "anisotropy", "opacity", "opacitymask",
    "clearcoat", "clearcoatroughness", "ambientocclusion", "refraction",
    "pixeldepthoffset", "displacement",
  ].includes(normalized)) return "float";
  return undefined;
}

function advancedOutputType(node: GraphNode, pin: GraphPin): MaterialType | undefined {
  const semantics = advancedExpression(node.expressionClass);
  if (!semantics) return undefined;
  if (/^MaterialExpressionTextureObject(?:Parameter)?$/.test(node.expressionClass)) {
    const texture = node.properties.get("Texture") ?? "";
    if (/TextureCubeArray/i.test(texture)) return "TextureCubeArray";
    if (/TextureCube/i.test(texture)) return "TextureCube";
    if (/Texture2DArray/i.test(texture)) return "Texture2DArray";
    if (/(?:VolumeTexture|Texture3D)/i.test(texture)) return "Texture3D";
    if (/TextureExternal/i.test(texture)) return "TextureExternal";
    if (/Texture2D/i.test(texture)) return "Texture2D";
    return undefined;
  }
  if (/MaterialAttributes$/.test(node.expressionClass) || node.expressionClass === "MaterialExpressionBreakMaterialAttributes") {
    if (normalizedPinName(pin.name) === "materialattributes" || pin.name === "Output") {
      return node.expressionClass === "MaterialExpressionSubstrateConvertMaterialAttributes" ? "Substrate" : "MaterialAttributes";
    }
    return materialAttributeType(pin.name);
  }
  const normalizedName = normalizedPinName(pin.name);
  const named = Object.entries(semantics.outputs ?? {}).find(
    ([name]) => normalizedPinName(name) === normalizedName,
  )?.[1];
  return named ?? semantics.defaultOutput;
}

const fixedOutputs: Readonly<Record<string, NumericType>> = {
  MaterialExpressionLength: "float",
  MaterialExpressionTransform: "float3",
};

const fixedAdvancedInputTypes: Readonly<Record<string, Readonly<Record<string, MaterialType>>>> = {
  MaterialExpressionSubstrateAdd: { A: "Substrate", B: "Substrate" },
  MaterialExpressionSubstrateConvertMaterialAttributes: {
    Attributes: "MaterialAttributes",
    "Water Scattering Coefficients (Water)": "float3",
    "Water Absorption Coefficients (Water)": "float3",
    "Water Phase G (Water)": "float",
    "Color Scale BehindWater (Water)": "float3",
    "Single Shading Model": "ShadingModel",
  },
  MaterialExpressionSubstrateConvertToDecal: { DecalMaterial: "Substrate", Coverage: "float" },
  MaterialExpressionSubstrateHazinessToSecondaryRoughness: { BaseRoughness: "float", Haziness: "float" },
  MaterialExpressionSubstrateHorizontalMixing: { Background: "Substrate", Foreground: "Substrate", Mix: "float" },
  MaterialExpressionSubstrateLightFunction: { Color: "float3" },
  MaterialExpressionSubstrateMetalnessToDiffuseAlbedoF0: { BaseColor: "float3", Metallic: "float", Specular: "float" },
  MaterialExpressionSubstratePostProcess: { Color: "float3", Opacity: "float" },
  MaterialExpressionSubstrateSelect: { A: "Substrate", B: "Substrate", SelectValue: "float" },
  MaterialExpressionSubstrateShadingModels: {
    BaseColor: "float3",
    Metallic: "float",
    Specular: "float",
    Roughness: "float",
    Anisotropy: "float",
    "Emissive Color": "float3",
    Normal: "float3",
    Tangent: "float3",
    "Subsurface Color": "float3",
    Opacity: "float",
    "Thin Translucent Transmittance Color": "float3",
    "Water Scattering Coefficients": "float3",
    "Water Absorption Coefficients": "float3",
    "Water Phase G": "float",
    "Color Scale BehindWater": "float3",
    "Custom Tangent": "float3",
    "Thin Translucent Surface Coverage": "float",
    "Single Shading Model": "ShadingModel",
  },
  MaterialExpressionSubstrateThinFilm: { Normal: "float3", F0: "float3", F90: "float3", Thickness: "float", IOR: "float" },
  MaterialExpressionSubstrateTransmittanceToMFP: { TransmittanceColor: "float3", Thickness: "float" },
  MaterialExpressionSubstrateUI: { Color: "float3", Opacity: "float" },
  MaterialExpressionSubstrateVerticalLayering: { Top: "Substrate", Bottom: "Substrate", "Top Thickness": "float" },
  MaterialExpressionSubstrateWeight: { A: "Substrate", Weight: "float" },
};

const equivalentInputs: Readonly<Record<string, readonly string[]>> = {
  MaterialExpressionConstantBiasScale: ["Input"],
  MaterialExpressionDDX: ["Value"],
  MaterialExpressionDDY: ["Value"],
  MaterialExpressionShaderStageSwitch: ["PixelShader", "VertexShader"],
  MaterialExpressionVertexInterpolator: ["VS", "Input"],
  MaterialExpressionReroute: ["Input", "InputPin", "A"],
  MaterialExpressionNamedRerouteDeclaration: ["Input", "InputPin", "A"],
  MaterialExpressionNamedRerouteUsage: ["Input", "InputPin", "A"],
  MaterialExpressionFunctionOutput: ["Input", "InputPin", "A"],
};

const convertTypes: Readonly<Record<string, NumericType>> = {
  Scalar: "float",
  Vector2: "float2",
  Vector3: "float3",
  Vector4: "float4",
};

function convertOutputType(node: GraphNode, pin: GraphPin): NumericType | undefined {
  const outputs = node.pins.filter((candidate) => candidate.direction === "output");
  const index = outputs.findIndex((candidate) => candidate.id === pin.id);
  if (index < 0) return undefined;
  const serialized = node.properties.get(`ConvertOutputs(${index})`);
  const type = serialized?.match(/(?:^|[,()])Type=([A-Za-z0-9_]+)/)?.[1];
  return type ? convertTypes[type] : undefined;
}

export function fixedExpressionOutputType(
  node: GraphNode,
  pin: GraphPin,
): MaterialType | undefined {
  const noise = proceduralNoiseExpression(node);
  if (noise) return noise.outputType;
  const knownFunctionType = knownMaterialFunctionOutputType(node, pin);
  if (knownFunctionType) return knownFunctionType;
  const math = mathExpression(node.expressionClass);
  if (math?.typeRule === "fixed-float") return "float";
  if (math?.typeRule === "fixed-float3") return "float3";
  if (math?.typeRule === "float-to-uint" || math?.typeRule === "modulo") return "uint";
  if (math?.typeRule === "uint-to-float") return "float";
  if (node.expressionClass === "MaterialExpressionLocalPosition"
    || node.expressionClass === "MaterialExpressionWorldPosition") {
    return ({ XYZ: "float3", XY: "float2", Z: "float" } as const)[
      pin.name as "XYZ" | "XY" | "Z"
    ];
  }
  const builtIn = inputDataExpression(node.expressionClass);
  if (builtIn) {
    const index = outputIndex(node, pin);
    if (node.expressionClass === "MaterialExpressionViewProperty") {
      const property = node.properties.get("Property") ?? "";
      return /(?:BufferSize|ViewSize|RenderTargetSize)/i.test(property) ? "float2" : "float";
    }
    return index >= 0 ? builtIn.outputs[index] : undefined;
  }
  const advancedType = advancedOutputType(node, pin);
  if (advancedType) return advancedType;
  if (node.expressionClass === "MaterialExpressionConvert") {
    return convertOutputType(node, pin);
  }
  return fixedOutputs[node.expressionClass];
}

export function equivalentExpressionInputs(node: GraphNode): readonly string[] {
  const math = mathExpression(node.expressionClass);
  if (math?.typeRule === "same") return [math.resultInput ?? math.inputs[0]];
  return equivalentInputs[node.expressionClass] ?? [];
}

export function arithmeticExpressionInputs(node: GraphNode): readonly string[] {
  const math = mathExpression(node.expressionClass);
  return math?.typeRule === "arithmetic" ? math.inputs.slice(0, 2) : [];
}

export function branchExpressionInputs(node: GraphNode): readonly string[] {
  if (node.expressionClass === "MaterialExpressionIf") return ["A > B", "A == B", "A < B"];
  if (node.expressionClass === "MaterialExpressionSwitch") {
    return node.pins
      .filter((pin) => pin.direction === "input" && pin.name !== "SwitchValue")
      .map((pin) => pin.name);
  }
  if (advancedExpression(node.expressionClass)?.branches) {
    return node.pins
      .filter((pin) => pin.direction === "input"
        && !/^(?:Value|Default Value)$/i.test(pin.name))
      .map((pin) => pin.name);
  }
  return [];
}

export function fixedExpressionInputType(
  node: GraphNode,
  pin: GraphPin,
): MaterialType | undefined {
  if (/^MaterialExpression(?:Vector)?Noise$/.test(node.expressionClass)) {
    if (pin.name === "World Position") return "float3";
    if (pin.name === "FilterWidth") return "float";
  }
  const fixedAdvanced = fixedAdvancedInputTypes[node.expressionClass]?.[pin.name];
  if (fixedAdvanced) return fixedAdvanced;
  if (node.expressionClass === "MaterialExpressionTransform" && pin.name === "Input") return "float3";
  if (node.expressionClass === "MaterialExpressionConstantBiasScale"
    && (pin.name === "Bias" || pin.name === "Scale")) return "float";
  if (node.expressionClass === "MaterialExpressionRotateAboutAxis") {
    if (["NormalizedRotationAxis", "PivotPoint", "Position"].includes(pin.name)) return "float3";
    if (pin.name === "Period") return "float";
  }
  if (node.expressionClass === "MaterialExpressionSphereMask"
    && (pin.name === "Radius" || pin.name === "Hardness")) return "float";
  if (node.expressionClass === "MaterialExpressionIf" && (pin.name === "A" || pin.name === "B")) return "float";
  if (node.expressionClass === "MaterialExpressionFloatToUInt" && pin.name === "Input") return "float";
  if (node.expressionClass === "MaterialExpressionUIntToFloat" && pin.name === "Input") return "uint";
  if (node.expressionClass === "MaterialExpressionModulo" && (pin.name === "A" || pin.name === "B")) return "uint";
  if (["MaterialExpressionBreakMaterialAttributes", "MaterialExpressionGetMaterialAttributes"].includes(node.expressionClass)
    && /^(?:Attr|Input)$/i.test(pin.name)) return "MaterialAttributes";
  if (node.expressionClass === "MaterialExpressionSetMaterialAttributes" && pin.name === "MaterialAttributes") return "MaterialAttributes";
  if (node.expressionClass === "MaterialExpressionSubstrateConvertMaterialAttributes" && pin.name === "Attributes") return "MaterialAttributes";
  if (["MaterialExpressionStaticSwitch", "MaterialExpressionStaticSwitchParameter"].includes(node.expressionClass)
    && /^(?:Value|Default Value)$/i.test(pin.name)) return "static bool";
  if (/TextureSample|ParticleSubUV/.test(node.expressionClass) && pin.name === "UVs") {
    if (/CubeArray/.test(node.expressionClass)) return "float4";
    return /Volume|SparseVolume|Cube|2DArray/.test(node.expressionClass) ? "float3" : "float2";
  }
  if (/^(?:MaterialExpressionMakeMaterialAttributes|MaterialExpressionSetMaterialAttributes)$/.test(node.expressionClass)) {
    return materialAttributeType(pin.name);
  }
  return undefined;
}
