# Official Unreal Material Semantics Research

Status: Source review, 2026-07-13  
Primary documentation version: Unreal Engine 5.8 unless noted otherwise

This note records only claims supported by Epic documentation. It does not replace source-code analysis or inspection of a specific installed Engine Content version.

## High-confidence findings

### Material Function inputs are typed; outputs are not declared the same way

Epic documents a required `Input Type` on every `FunctionInput`. Supported categories include Scalar, Vector2, Vector3, Vector4, Texture2D, TextureCube, Texture2DArray, VolumeTexture, StaticBool, MaterialAttributes, and TextureExternal. A caller value must be convertible to that input type or compilation fails.

The documented `FunctionOutput` properties contain Output Name, Description, and Sort Priority, but no independently selected output type. A `MaterialFunctionCall` exposes the function's input and output nodes as call-node pins. This supports treating a function result as graph-derived rather than assuming a declared signature.

Sources:

- [Material Functions Overview](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-material-functions-overview)
- [Material Function Expressions](https://dev.epicgames.com/documentation/unreal-engine/material-function-expressions-in-unreal-engine?lang=en-US)
- [UMaterialExpressionFunctionOutput API](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/UMaterialExpressionFunctionOutpu-)
- [UMaterialExpressionMaterialFunctionCall API](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/UMaterialExpressionMaterialFunct-)

### Unreal has a richer internal type system than float widths alone

`EMaterialValueType` is the material compiler's type enum. It includes float widths, texture families, static bool and additional engine-specific categories. `FMaterialCompiler::GetType(Code)` returns the type of a compiled code chunk.

Implication: the interpreter should keep a normalized public type vocabulary but preserve `unknown` for categories or contexts it cannot prove.

Sources:

- [EMaterialValueType API](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/EMaterialValueType?lang=en-US)
- [FMaterialCompiler::GetType](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/FMaterialCompiler/GetType)
- [GetMaterialValueTypeDescriptions](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/GetMaterialValueTypeDescriptions)

### Node type behavior is not captured by one universal pin rule

`UMaterialExpression` exposes output records and virtual input/output type methods; many subclasses override `GetOutputType`. The compiler interface separately provides operations such as constants, `Cosine`, `Cross`, `ComponentMask`, arithmetic, and custom expressions. Therefore type inference must use expression-specific rules plus compiled/graph context where static metadata is insufficient.

Sources:

- [UMaterialExpression API](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/UMaterialExpression)
- [UMaterialExpression::GetOutputType](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/Materials/UMaterialExpression/GetOutputType)
- [UMaterialExpression::GetInputType](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/Materials/UMaterialExpression/GetInputType)
- [FMaterialCompiler API](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/FMaterialCompiler)

### Cast behavior supplies useful constraints

Epic documents `ValidCast` as allowing truncation (`float4` to `float3`) and scalar replication, but not general component addition (`float2` to `float3`). Invalid conversions produce a compile error.

Source:

- [FMaterialCompiler::ValidCast](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/FMaterialCompiler/ValidCast)

### Custom nodes can declare their output width

`UMaterialExpressionCustom` exposes `OutputType`, and `ECustomMaterialOutputType` contains Float1 through Float4 and MaterialAttributes. Connected Custom nodes should use this property before falling back to `unknown`.

Sources:

- [UMaterialExpressionCustom API](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/UMaterialExpressionCustom?lang=en-US)
- [ECustomMaterialOutputType API](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/ECustomMaterialOutputType?lang=en-US)

## Documented deterministic rules useful to the interpreter

| Expression or function | Supported conclusion |
| --- | --- |
| Constant / Constant2Vector / Constant3Vector / Constant4Vector | `float` / `float2` / `float3` / `float4` |
| AppendVector | Output channels are A followed by B; output width is the sum when valid |
| ComponentMask | Output contains the selected channels; requesting a missing vector channel errors, except scalar input may replicate |
| CrossProduct | Requires two three-channel vectors and returns a three-channel vector |
| DotProduct | Inputs must have equal channel counts; mathematical result is scalar |
| Normalize | Preserves vector width while normalizing magnitude |
| OneMinus | Applies per channel and therefore preserves input width |
| Pi Material Function | Epic documents a Scalar Multiplier input and the constant value 3.141592; a scalar result is strongly implied, but the page does not expose a formal output-type field |

Sources:

- [Material Data Types](https://dev.epicgames.com/documentation/unreal-engine/material-data-types-in-unreal-engine)
- [Vector Operation Material Expressions](https://dev.epicgames.com/documentation/unreal-engine/vector-operation-material-expressions-in-unreal-engine?lang=en-US)
- [Math Material Expressions](https://dev.epicgames.com/documentation/unreal-engine/math-material-expressions-in-unreal-engine?lang=en-US)
- [Math Material Functions](https://dev.epicgames.com/documentation/unreal-engine/math-material-functions-in-unreal-engine?lang=en-US)

## Gaps and negative findings

- Epic's searchable 5.8 documentation did not yield dedicated entries for `MakeFloat3` or `ScreenAlignedPixelToPixelUVs`. Their return types remain unverified from official web documentation.
- Function reference prose is useful evidence but is not a machine-readable or complete type registry.
- Material Functions are arbitrary encapsulated expression graphs. The function overview explicitly says their internal behavior is defined by that graph and hidden at the call site.
- Documentation version matters: the fixture corpus spans UE 4.22 through 5.8, while most sources above describe 5.8.
- The API reference exposes methods and declarations but often omits implementation detail required for exact promotion and context-dependent rules. Source review remains necessary.

## Consequences for this project

1. Maintain a small expression rule table backed by official documentation or source evidence.
2. Infer types through Graph IR constraints and swizzles instead of assigning every external function a fixed return type.
3. Read FunctionInput types and call-pin abbreviations such as `(S)`, `(V2)`, and `(V3)` when clipboard evidence contains them.
4. Read connected Custom `OutputType` metadata.
5. Store external-function facts with engine version, evidence, and confidence; do not infer signatures from asset names alone.
6. Prefer copied internal function graphs for undocumented Engine Content assets.

