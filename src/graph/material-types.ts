export type FloatType = "float" | "float2" | "float3" | "float4";
export type UIntType = "uint" | "uint2" | "uint3" | "uint4";
export type NumericType = FloatType | UIntType;
export type NumericFamily = "float" | "uint";

export type MaterialType =
  | NumericType
  | "bool"
  | "static bool"
  | "Texture2D"
  | "TextureCube"
  | "TextureCubeArray"
  | "Texture2DArray"
  | "Texture3D"
  | "TextureExternal"
  | "SparseVolumeTexture"
  | "MaterialAttributes"
  | "ShadingModel"
  | "Substrate";

export const materialTypeOptions: readonly MaterialType[] = [
  "float",
  "float2",
  "float3",
  "float4",
  "bool",
  "static bool",
  "Texture2D",
  "TextureCube",
  "TextureCubeArray",
  "Texture2DArray",
  "Texture3D",
  "TextureExternal",
  "SparseVolumeTexture",
  "MaterialAttributes",
  "ShadingModel",
  "Substrate",
];

const functionInputTypes: Readonly<Record<string, MaterialType>> = {
  FunctionInput_Scalar: "float",
  FunctionInput_Vector2: "float2",
  FunctionInput_Vector3: "float3",
  FunctionInput_Vector4: "float4",
  FunctionInput_Texture2D: "Texture2D",
  FunctionInput_TextureCube: "TextureCube",
  FunctionInput_Texture2DArray: "Texture2DArray",
  FunctionInput_VolumeTexture: "Texture3D",
  FunctionInput_StaticBool: "static bool",
  FunctionInput_MaterialAttributes: "MaterialAttributes",
  FunctionInput_TextureExternal: "TextureExternal",
  FunctionInput_Bool: "bool",
  FunctionInput_Substrate: "Substrate",
};

export function declaredFunctionInputType(value: string | undefined): MaterialType | undefined {
  return value === undefined ? "float3" : functionInputTypes[value];
}

export function isNumericType(type: string): type is NumericType {
  return /^(?:float|uint)[2-4]$/.test(type) || type === "float" || type === "uint";
}

export function numericDimensions(type: NumericType): number {
  return type === "float" || type === "uint" ? 1 : Number(type.slice(-1));
}

export function numericFamily(type: NumericType): NumericFamily {
  return type.startsWith("uint") ? "uint" : "float";
}

export function numericType(
  dimensions: number,
  family: NumericFamily = "float",
): NumericType | undefined {
  return dimensions === 1
    ? family
    : dimensions >= 2 && dimensions <= 4
      ? `${family}${dimensions}` as NumericType
      : undefined;
}

export function promoteNumericTypes(a: NumericType, b: NumericType): NumericType | undefined {
  if (a === b) return a;
  if (numericFamily(a) !== numericFamily(b)) return undefined;
  if (numericDimensions(a) === 1) return b;
  if (numericDimensions(b) === 1) return a;
  return undefined;
}

export function castNumericFamily(type: NumericType, family: NumericFamily): NumericType {
  return numericType(numericDimensions(type), family)!;
}
