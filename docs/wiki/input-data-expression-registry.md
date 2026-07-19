# UE 5.8 Constant and Input-Data Registry

Raw source: [constants-and-input-data.clipboard.txt](../raw/ue5.8-clipboard-captures/constants-and-input-data.clipboard.txt)

Status: Implemented and live-verified

## Scope

`inputDataExpressionSemantics` is the maintained contract for deterministic constants and engine-provided material inputs. It covers all 45 unique classes in the supplied 85-output UE 5.8 clipboard, plus ten documented base nodes absent from that capture.

The registry stores the readable pseudo-HLSL token, ordered inputs, ordered output types, and output projections together. Ordered outputs are required because Unreal sometimes serializes visible channels as generic `Output2`, `Output3`, and similar names.

## Captured palette

| Family | Expressions | Output contract |
|---|---|---|
| Constants | `Constant2Vector`, `Constant3Vector`, `Constant4Vector`, `ConstantDouble` | `float2`, `float3`, `float4`, `float`; component pins are scalar |
| View and screen | `CameraPositionWS`, `IsFirstPerson`, `IsOrthographic`, `PixelDepth`, `SceneDepth`, `SceneTexelSize`, `ScreenPosition`, `ViewProperty`, `ViewSize` | positions `float3`; depth/flags `float`; screen UV/size `float2`; `ViewProperty` depends on selected property |
| Object and coordinates | `ActorPositionWS`, `LightmapUVs`, `LocalPosition`, `ObjectOrientation`, `ObjectPositionWS`, `ObjectRadius`, `Panner`, `Rotator`, `TextureCoordinate`, `TruncateLWC`, `WorldPosition` | spatial vectors and UVs use their natural widths; `XYZ/XY/Z` are `float3/float2/float` |
| Mesh and instance | `DistanceCullFade`, `PerInstanceFadeAmount`, `PerInstanceRandom`, `PrecomputedAOMask`, `TwoSidedSign`, `VertexColor`, `VertexNormalWS`, `VertexTangentWS` | scalar controls, RGB/RGBA colors, and `float3` vectors |
| Particle | `ParticleColor`, `ParticleDirection`, `ParticleMotionBlurFade`, `ParticlePositionWS`, `ParticleRadius`, `ParticleRandom`, `ParticleRelativeTime`, `ParticleSize`, `ParticleSpeed`, `ParticleSpriteRotation`, `ParticleSubUVProperties` | named scalar/vector outputs preserved |
| Font | `FontSignedDistance` | four named scalar outputs |
| Time | `Time` | `float` |

## Official-reference additions

The gap audit added these stable base expressions even though they were absent from the supplied clipboard:

- `CameraVectorWS`, `LightVector`, `ObjectBounds`, `PixelNormalWS`, `PreSkinnedNormal`, `PreSkinnedPosition`, `ReflectionVectorWS` -> `float3`;
- `ParticleMacroUV` -> `float2`;
- `DynamicParameter` -> four scalar channels;
- `SphericalParticleOpacity` -> scalar.

## Evidence

- Epic's [Constant Material Expressions](https://dev.epicgames.com/documentation/en-us/unreal-engine/constant-material-expressions-in-unreal-engine) defines the scalar and vector widths and documents `VertexColor` and `ViewProperty`.
- Epic's [Coordinates Material Expressions](https://dev.epicgames.com/documentation/unreal-engine/coordinates-material-expressions-in-unreal-engine?lang=en-US) defines world/object/camera positions, UV nodes, normals, view size, and coordinate operations.
- Epic's [Particle Expressions](https://dev.epicgames.com/documentation/en-us/unreal-engine/particle-expressions?application_version=4.27) defines particle channel meanings and widths. The page is older, so the supplied UE 5.8 pin serialization remains the stronger source for newer outputs such as `ParticleSubUVProperties`.
- Epic's [Depth Material Expressions](https://dev.epicgames.com/documentation/unreal-engine/depth-material-expressions-in-unreal-engine?lang=en-US) defines `PixelDepth` and `SceneDepth` as scalar depth values.
- Epic's [Large World Coordinates Rendering](https://dev.epicgames.com/documentation/unreal-engine/large-world-coordinates-rendering-in-unreal-engine-5?lang=en-US) confirms which world-space sources carry LWC values. Pseudo-HLSL intentionally displays their logical channel width rather than Unreal's internal DoubleFloat representation.
- Epic's [Material Expressions Reference](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-material-expressions-reference) was used for the missing-node audit.

## Verification

- every supplied class has an automated registry coverage check;
- every registered expression has a synthetic no-unsupported-fallback test;
- all 85 terminal outputs in the 128,634-character clipboard were selected in the live Codex browser: none produced `unsupported-node` or `?type`;
- production TypeScript/Vite build passes.

The raw clipboard is a temporary attachment, not a repository fixture. Do not describe this validation as replayable from the repository until the source is saved under `samples/`.

## Next registry boundaries

Do not fold every Material Editor palette class into this registry. The next useful deep registries are:

1. texture objects, texture sampling, scene textures, virtual textures, and SubUV sampling;
2. parameters and instance/custom primitive data, including dynamic pin naming;
3. material attributes, static switches, quality/feature/shading-path switches;
4. geometry, distance-field, atmosphere, lighting, and specialized shading-model inputs.

These families have distinct type and rendering rules and need representative clipboard fixtures before implementation.
