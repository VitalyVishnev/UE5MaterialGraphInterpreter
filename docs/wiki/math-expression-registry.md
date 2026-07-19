# UE 5.8 Math Expression Registry

Status: Complete for the supplied UE 5.8 Math palette clipboard

Validation: all 51 unique classes are enforced by automated tests; all 53 copied nodes passed live-browser validation. The raw 158 KB clipboard remains external to the repository, as recorded in [Known Bugs](known-bugs.md#limitation-the-complete-ue-58-math-clipboard-is-not-stored-in-the-repository).

This registry covers all 51 unique `MaterialExpression` classes in the supplied clipboard. `T` means the output preserves the relevant input's numeric family and channel count. `promote(A, B)` means equal types are preserved and a scalar may promote to the other operand's vector width. A disconnected input can still leave a type unresolved; that is missing graph evidence, not an unsupported expression.

| Unreal expression | Pseudo-HLSL | Output type rule |
|---|---|---|
| `Abs` | `abs(Input)` | `T(Input)` |
| `Add` | `A + B` | `promote(A, B)` |
| `AppendVector` | `Append(A, B)` / `floatN(A, B)` | combined channel count |
| `Arccosine` | `acos(Input)` | `T(Input)` |
| `ArccosineFast` | `AcosFast(Input)` | `T(Input)`; UE approximation |
| `Arcsine` | `asin(Input)` | `T(Input)` |
| `ArcsineFast` | `AsinFast(Input)` | `T(Input)`; UE approximation |
| `Arctangent` | `atan(Input)` | `T(Input)` |
| `Arctangent2` | `atan2(Y, X)` | `promote(Y, X)` |
| `Arctangent2Fast` | `Atan2Fast(Y, X)` | `promote(Y, X)`; UE approximation |
| `ArctangentFast` | `AtanFast(Input)` | `T(Input)`; UE approximation |
| `Ceil` | `ceil(Input)` | `T(Input)` |
| `Clamp` | `clamp(Input, Min, Max)` | `T(Input)`; ClampMin/ClampMax become `max`/`min` |
| `ComponentMask` | `Input.rgba-mask` | float width equals selected channel count |
| `Cosine` | `cos(Input / Period)` | `T(Input)`; `/ Period` omitted when Period is 1 |
| `CrossProduct` | `cross(A, B)` | `float3` |
| `Divide` | `A / B` | `promote(A, B)` |
| `DotProduct` | `dot(A, B)` | `float` |
| `Exponential` | `exp(Input)` | `T(Input)` |
| `Exponential2` | `exp2(Input)` | `T(Input)` |
| `FloatToUInt` | `FloatToUInt(Input[, Mode])` | `uint`; input is `float` |
| `Floor` | `floor(Input)` | `T(Input)` |
| `Fmod` | `fmod(A, B)` | `promote(A, B)` in float domain |
| `Frac` | `frac(Input)` | `T(Input)` |
| `HsvToRgb` | `HsvToRgb(Input)` | `float3` |
| `If` | `If(A, B, Greater, Equal, Less, Threshold)` | common branch type; A and B are float |
| `InverseLinearInterpolate` | `inverseLerp(A, B, Value)` | `T(Value)` |
| `LinearInterpolate` | `lerp(A, B, Alpha)` | `promote(A, B)` |
| `Logarithm` | `log(Input)` | `T(Input)` |
| `Logarithm10` | `log10(X)` | `T(X)` |
| `Logarithm2` | `log2(X)` | `T(X)` |
| `Max` | `max(A, B)` | `promote(A, B)` |
| `Min` | `min(A, B)` | `promote(A, B)` |
| `Modulo` | `A % B` | `uint`; inputs are uint |
| `Multiply` | `A * B` | `promote(A, B)` |
| `Normalize` | `normalize(VectorInput)` | `T(VectorInput)` |
| `OneMinus` | `1.0 - Input` | `T(Input)` |
| `Power` | `pow(Base, Exp)` | `T(Base)` |
| `RgbToHsv` | `RgbToHsv(Input)` | `float3` |
| `Round` | `round(Input)` | `T(Input)` |
| `Saturate` | `saturate(Input)` | `T(Input)` |
| `Sign` | `sign(Input)` | `T(Input)` |
| `Sine` | `sin(Input / Period)` | `T(Input)`; `/ Period` omitted when Period is 1 |
| `SmoothStep` | `smoothstep(Min, Max, Value)` | `T(Value)` |
| `SquareRoot` | `sqrt(Input)` | `T(Input)` |
| `Step` | `step(Y, X)` | `T(X)` |
| `Subtract` | `A - B` | `promote(A, B)` |
| `Switch` | `Switch(SwitchValue, Default, Inputs...)` | common branch type |
| `Tangent` | `tan(Input / Period)` | `T(Input)`; `/ Period` omitted when Period is 1 |
| `Truncate` | `trunc(Input)` | `T(Input)` |
| `UIntToFloat` | `UIntToFloat(Input)` | `float`; input is `uint` |

Implementation contract:

- every class above must have one entry in `mathExpressionSemantics`;
- none may emit `unsupported-node` or `UE_Unsupported`;
- terminal selections use structural labels such as `Abs`, `Clamp`, and `ComponentMask.RG`, never 53 indistinguishable `Output` labels;
- HLSL reserved words are not legal generated variable names;
- missing upstream values remain explicit `external_*` symbols and may legitimately preserve `?type`.

Evidence:

- [Epic: Math Material Expressions](https://dev.epicgames.com/documentation/unreal-engine/math-material-expressions-in-unreal-engine)
- [Epic: Material Data Types](https://dev.epicgames.com/documentation/unreal-engine/material-data-types-in-unreal-engine)
- [Epic: Material Data Manipulation and Arithmetic](https://dev.epicgames.com/documentation/unreal-engine/material-data-manipulation-and-arithmetic-in-unreal-engine)
- [Epic API: FloatToUInt](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/UMaterialExpressionFloatToUInt)
- [Epic API: UIntToFloat](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/UMaterialExpressionUIntToFloat)
- [Epic API: Modulo](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/UMaterialExpressionModulo)
- [Epic API: Switch](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/UMaterialExpressionSwitch)
