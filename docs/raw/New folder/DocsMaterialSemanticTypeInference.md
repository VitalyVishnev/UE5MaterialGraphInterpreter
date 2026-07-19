# Source-only MaterialExpression semantic rules

This revision is intentionally source-text only: it does not build Unreal, run the editor, create a commandlet, parse `.uasset` packages, or infer Material Function asset contents from names. The machine-readable deliverable is `material_expression_rules.json`.

## Repository version analyzed

`Engine/Build/Build.version` reports Unreal Engine 5.8.0, branch `UE5`, changelist `0`, compatible changelist `0`, non-licensee and non-promoted. The git commit analyzed in this workspace is `667bbca26dd195708d71f5ce34001f3ef3788679`.

## Numeric promotion

The legacy translator centralizes binary arithmetic typing in `FHLSLMaterialTranslator::GetArithmeticResultType`. It rejects non-primitive operands, preserves identical primitive types, promotes scalar float (`MCT_Float`/`MCT_Float1`) to the other operand's numeric float/vector type, maps scalar/vector combinations into LWC equivalents when either side is LWC, and emits an error plus `MCT_Unknown` for undefined arithmetic. `Add`, `Sub`, `Mul`, and `Div` all call this rule before emitting chunks.

## Casts and widening/narrowing

`ValidCast` is the restrictive cast used by typed inputs: it accepts overlapping source/destination types, special texture-to-Texture2D cases, passthrough into material-attributes sockets, and float-numeric casts. Its comment states that it may truncate (`float4 -> float3`) and replicate scalar (`float1 -> floatN`) but does not append missing vector components (`float2 -> float3`). Invalid casts emit `Cannot cast from ... to ...`.

`ForceCast` is broader: it uses flags allowing truncation and append-zeroes, conditionally replicates scalar values, handles numeric and static-bool-to-float cases, and emits `Cannot force a cast between non-numeric types` for unsupported nonnumeric casts.

## Masks and swizzles

Masks are handled at two levels. Static output metadata (`FExpressionOutput`) declares masked outputs for constants, and the base output-type path counts selected channels. Compile-time inputs are also corrected by `FExpressionInput::Compile`, which applies the effective `FConnectionMask` through `Compiler->ComponentMask`. `FHLSLMaterialTranslator::ComponentMask` validates that the source has enough components and maps one/two/three/four selected channels to float/float2/float3/float4, with LWC internal variants when appropriate.

## Legacy translator versus new HLSL generator

For the priority classes in `material_expression_rules.json`, no `GenerateHLSLExpression` overrides were found in the material expression source files searched. Therefore the JSON records legacy `Compile`/`FHLSLMaterialTranslator` evidence. Where the legacy translator has multiple paths, the rule records them explicitly: for example `Sine` and `Cosine` return `MCT_Float` on uniform-expression paths but preserve `GetParameterType(X)` on the non-uniform non-analytic path.

## Classes impossible to describe without compile context

The JSON lists context-dependent classes. The main causes are caller-supplied function inputs, callee graphs stored in assets, static/preview/default function input handling, shader frequency and previous-frame compilation, scene texture id/output index, texture sampler/resource selection, derivative/uniform translator paths, and optional connections such as `Desaturation.Fraction`.

## Material Functions whose concrete types cannot be obtained here

Concrete types for `/Engine/Functions/Engine_MaterialFunctions02/Math/Pi.Pi`, `/Engine/Functions/Engine_MaterialFunctions02/Utility/MakeFloat3.MakeFloat3`, `/Engine/Functions/Engine_MaterialFunctions02/Texturing/ScreenAlignedPixelToPixelUVs.ScreenAlignedPixelToPixelUVs`, and all other Engine Content material functions cannot be obtained from text source alone. Their graphs live in `.uasset` packages, and this task forbids binary asset analysis or editor loading. Source text proves only the mechanism: `FunctionOutput` derives its type from connected input `A`, and `MaterialFunctionCall` delegates output typing to the callee's output expression in the current compile/caller context.
