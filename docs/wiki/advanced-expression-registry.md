# UE 5.8 Advanced Material Expression Registry

Status: Implemented and live-verified on 2026-07-19

Raw sources: [advanced-material-expressions.clipboard.txt](../raw/ue5.8-clipboard-captures/advanced-material-expressions.clipboard.txt), [substrate-expressions.clipboard.txt](../raw/ue5.8-clipboard-captures/substrate-expressions.clipboard.txt), [noise-expression-modes.clipboard.txt](../raw/ue5.8-clipboard-captures/noise-expression-modes.clipboard.txt), and [scalar-blue-noise.clipboard.txt](../raw/ue5.8-clipboard-captures/scalar-blue-noise.clipboard.txt)

This registry covers the supplied UE 5.8 palette batch for parameters, Material Attributes, texture and virtual-texture sampling, Substrate, atmosphere, distance fields, volumetrics, and runtime switches. The temporary clipboard contained 71 nodes, 64 unique classes, 331,890 characters, and 155 selectable outputs.

The implementation also includes five documented variants absent from the clipboard: `TextureSampleParameter2DArray`, `TextureSampleParameterCube`, `TextureSampleParameterCubeArray`, `TextureSampleParameterSubUV`, and non-parameter `SparseVolumeTextureSample`.

The additional Substrate capture contains 15 classes and 19 outputs. Eleven classes were new to the registry; the other four verified existing contracts against UE 5.8 clipboard pins.

## Rendering and type contract

| Family | Expressions | Output contract |
| --- | --- | --- |
| Parameters | `ScalarParameter`, `VectorParameter`, `StaticBool`, `StaticBoolParameter` | `float`; RGBA channels; `static bool` |
| Instance data | `PerInstanceCustomData`, `PerInstanceCustomData3Vector` | `float`; `float3` |
| Texture objects | `TextureObject`, `TextureObjectParameter` | Asset-dependent object type; unresolved when `Texture=None` |
| Texture samples | `ParticleSubUV`, `TextureSample`, `TextureSampleParameter2D`, `TextureSampleParameter2DArray`, `TextureSampleParameterCube`, `TextureSampleParameterCubeArray`, `TextureSampleParameterSubUV`, `TextureSampleParameterVolume` | `RGB=float3`, `R/G/B/A=float`, `RGBA=float4` |
| Sparse volume | `SparseVolumeTextureObject`, `SparseVolumeTextureObjectParameter`, `SparseVolumeTextureSample`, `SparseVolumeTextureSampleParameter` | object type or two `float4` attribute outputs |
| Runtime virtual texture | `RuntimeVirtualTextureSample`, `RuntimeVirtualTextureSampleParameter`, `RuntimeVirtualTextureCustomData`, `RuntimeVirtualTextureReplace`, `RuntimeVirtualTextureOutput`, `VirtualTextureFeatureSwitch` | named sampled channels; branch-preserved polymorphic output; connected output-node inputs become graph results |
| Material Attributes | `MakeMaterialAttributes`, `BreakMaterialAttributes`, `GetMaterialAttributes`, `SetMaterialAttributes`, `BlendMaterialAttributes`, `LayerStack`, `ShadingModel` | `MaterialAttributes`, pin-specific attribute type, or `ShadingModel` |
| Static/runtime branches | `StaticSwitch`, `StaticSwitchParameter`, `QualitySwitch`, `PathTracingRayTypeSwitch`, `RayTracingQualitySwitch`, `FeatureLevelSwitch`, `ShadingPathSwitch`, `PreviousFrameSwitch`, `ShadowReplace` | promoted type of the connected result branches; `?type` if copied without branch evidence |
| Utility and collection data | `CollectionParameter`, `ConstantBiasScale`, `Distance`, `SphereMask`, `RotateAboutAxis` | context-derived collection value; same numeric type; `float`; `float`; `float3` |
| Distance fields | `DistanceFieldApproxAO`, `DistanceFieldGradient`, `DistanceToNearestSurface` | `float`, `float3`, `float` |
| Atmosphere and light | `AtmosphericFogColor`, `AtmosphericLightColor`, `AtmosphericLightVector`, `MainDirectionalLight`, all supplied `SkyAtmosphere*`, `SkyLightEnvMapSample`, `LightVector` | scalar/vector outputs fixed by expression contract; `AtmosphericFogColor` is deprecated |
| Volumetric | `VolumetricAdvancedMaterialInput/Output`, `VolumetricCloudEmptySpaceSkippingInput/Output` | named float/vector inputs; connected output-node inputs become graph results |
| Substrate BSDF/wrappers | `SubstrateConvertMaterialAttributes`, `SubstrateConvertToDecal`, `SubstrateEyeBSDF`, `SubstrateHairBSDF`, `SubstrateLightFunction`, `SubstratePostProcess`, `SubstrateShadingModels`, `SubstrateSimpleClearCoatBSDF`, `SubstrateSingleLayerWaterBSDF`, `SubstrateSlabBSDF`, `SubstrateToonBSDF`, `SubstrateUI`, `SubstrateUnlitBSDF`, `SubstrateVolumetricFogCloudBSDF` | `Substrate` |
| Substrate operators | `SubstrateAdd`, `SubstrateHorizontalMixing`, `SubstrateSelect`, `SubstrateVerticalLayering`, `SubstrateWeight` | `Substrate`; numeric weights/selectors remain `float` inputs |
| Substrate helpers | `SubstrateHazinessToSecondaryRoughness`, `SubstrateMetalnessToDiffuseAlbedoF0`, `SubstrateThinFilm`, `SubstrateTransmittanceToMFP` | named `float`, `float3`, or mixed outputs according to serialized pins |
| Procedural noise | `Noise`, `VectorNoise`, `ScalarBlueNoise` | scalar Noise and Scalar Blue Noise return `float`; Vector Noise returns `float3` or `float4` according to its mode |

Every expression renders as its semantic class name with actual serialized inputs. It is not reported as an unsupported opaque node. This is deliberately a semantic pseudo-HLSL registry, not a claim that these editor expressions are literal HLSL functions.

## Procedural noise modes

`Noise` reads `World Position: float3` and `Filter Width: float`. It always returns `float`. Its serialized `NoiseFunction` is rendered as `SimplexTexture`, `GradientTexture`, `FastGradient3DTexture`, `GradientALU`, `ValueALU`, or `VoronoiALU`. Explicitly serialized Scale, Quality, Levels, output range, level scale, turbulence, tiling, repeat size, and origin controls become named arguments; omitted defaults are not invented.

`VectorNoise` reads `World Position: float3`. Its mode determines both meaning and type:

| Mode | Output |
| --- | --- |
| Cell Noise | `float3` color |
| Perlin 3D | `float3` color |
| Perlin Gradient | `float4`: RGB gradient, A scalar noise |
| Perlin Curl | `float3` curl vector |
| Voronoi | `float4`: RGB closest-seed position, A distance |

Quality, tiling, and tile size are preserved from the node's serialized properties or editor-pin defaults. `ScalarBlueNoise()` is a parameterless `float` source in `[0,1]` for the current screen pixel. Its screen-space dependency makes it unsuitable as a stable secondary-ray sample when a ray has no meaningful pixel position.

## Dynamic Material Attributes

`GetMaterialAttributes` and `SetMaterialAttributes` do not have one fixed signature. Their `AttributeGetTypes(n)` / `AttributeSetTypes(n)` arrays and, more importantly, the actual serialized pin list define the selected attributes.

Current pin type rules:

- `BaseColor`, `EmissiveColor`, `Normal`, `Tangent`, `WorldPositionOffset`, `SubsurfaceColor` -> `float3`;
- `CustomizedUV0..7` -> `float2`;
- `ShadingModel` -> `ShadingModel`;
- metallic/specular/roughness/anisotropy/opacity/masks/coat/AO/refraction/depth offset/displacement attributes -> `float`;
- the aggregate input/output -> `MaterialAttributes`.

`ShadingModel` and `SubstrateConvertMaterialAttributes` dropdown values are read from pin defaults and rendered as identifiers such as `Default_Lit`. No hard-coded default is substituted when clipboard evidence exists.

## Texture sample modes

The actual pin list is authoritative because Unreal changes the texture sample signature with `MipValueMode`:

- `None` uses the hardware-computed mip level;
- `MipLevel` and `MipBias` use the serialized `MipValue` input;
- `Derivative` uses the serialized X/Y derivative inputs (`CoordinatesDX` / `CoordinatesDY`, displayed as `DDX(UVs)` / `DDY(UVs)` in the editor).

The generator preserves `MipValueMode`, `MipValue`, DDX/DDY, sampler source, sampler type, texture identity, and any linked texture-object override that appears in the clipboard. Empty inactive optional pins are omitted. `TextureSampleParameter*` has the same sampling semantics as `TextureSample`, but keeps `ParameterName` because the asset can be overridden in a Material Instance.

The supplied `TextureSampleParameter2D` record contains enum defaults under incompatible neighboring pin names. The renderer validates these values by enum domain, restores the unambiguous MIP/source values, and does not invent a missing sampler type.

`TextureObject` and `TextureObjectParameter` are not samples. They render only object identity and derive `Texture2D`, `TextureCube`, `TextureCubeArray`, `Texture2DArray`, `Texture3D`, or `TextureExternal` from the serialized asset class. `Texture=None` remains `?type`.

## Terminal expressions

`RuntimeVirtualTextureOutput`, `VolumetricAdvancedMaterialOutput`, and `VolumetricCloudEmptySpaceSkippingOutput` are sinks. A connected input is exposed as a named graph output rather than rendered as a value-returning call. A disconnected sink has no result value to analyze.

## Validation

The complete temporary clipboard was replayed through the live application after implementation:

- 71 nodes and 155 outputs detected;
- all 155 output views generated;
- zero `unsupported-node` fallbacks;
- seven standalone polymorphic switch outputs remained `?type`, as expected without connected branches;
- two texture-object outputs with `Texture=None` remained `?type`, as required by missing asset-type evidence.

Automated coverage checks every supplied class, the five documented supplements, dynamic Material Attribute types, texture derivative controls, texture enum normalization, terminal sink handling, and asset-derived texture-object types.

The additional Substrate clipboard is repository-backed and replayed across all 19 output views. All 15 classes render without `unsupported-node` fallbacks.

## Primary evidence

- Epic: [UMaterialExpressionTextureSample](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/UMaterialExpressionTextureSample) documents `MipValue`, `CoordinatesDX`, `CoordinatesDY`, `MipValueMode`, sampler source, and texture-object override.
- Epic: [ETextureMipValueMode](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/ETextureMipValueMode) defines None, MipLevel, MipBias, and Derivative.
- Epic: [Texture expressions](https://dev.epicgames.com/documentation/unreal-engine/texture-expressions?application_version=4.27) documents output channels and parameter/sample equivalence. The API pages above are authoritative for UE 5.8 class members.
- Epic: [Material Attributes expressions](https://dev.epicgames.com/documentation/unreal-engine/material-attributes-expressions-in-unreal-engine) documents dynamic Get/Set attribute arrays and recommends Set over Make for compact graphs.
- Epic: [Runtime Virtual Texturing](https://dev.epicgames.com/documentation/en-us/unreal-engine/runtime-virtual-texturing-in-unreal-engine) documents sample/parameter behavior and virtual-texture output workflows.
- Epic: [Substrate overview](https://dev.epicgames.com/documentation/en-us/unreal-engine/overview-of-substrate-materials-in-unreal-engine) documents Substrate BSDF composition and Material Attributes conversion.
- Epic: [Utility Material Expressions](https://dev.epicgames.com/documentation/en-us/unreal-engine/utility-material-expressions-in-unreal-engine) documents `Distance`, `SphereMask`, and the `float3` delta returned by `RotateAboutAxis`.
- Epic: [Atmosphere Material Expressions](https://dev.epicgames.com/documentation/en-us/unreal-engine/atmosphere-material-expressions-in-unreal-engine) documents the supplied atmosphere sources and the deprecated fog expression.

## Next registry priorities

The next useful batch should target classes whose signatures are still absent from project fixtures:

1. remaining texture families: cube/array object fixtures with real assets, font sampling, sprite sampling, antialiased masks, texture collections, and texture-object-from-collection;
2. remaining platform/render-path switches: Nanite, distance-fields rendering, and required samplers;
3. landscape, virtual-height-field, decal, scene-buffer, and specialized material-output expressions.

Do not assign contracts to these classes from names alone; collect clipboard pins or a primary API/source contract first.
