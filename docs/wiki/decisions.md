# Decisions

This page stores active project contracts. Rejected or superseded approaches belong in [experiments.md](experiments.md); current limitations and bugs belong in [known-bugs.md](known-bugs.md).

## Decision: Sample-capture visual language is the initial UI baseline

Status: Active

Context:
The first local helper, `sample-capture.html`, established a practical visual direction that the project owner approved.

Decision:
Use its restrained, utility-first form design as the initial visual baseline for the application: system theme support, compact readable controls, clear section grouping, responsive single-page layout, and no decorative noise or required UI dependencies.

Reasoning:
The tool is for inspecting technical graph data. The interface should make input, warnings, and generated code legible rather than compete with them.

Consequences:
New UI surfaces should follow this direction unless a concrete workflow requires a different interaction. This is a visual baseline, not a requirement to preserve the helper's HTML implementation or all of its controls.

The generated-code panel uses the approved dark sample-capture style and an Unreal-inspired syntax palette: green comments, blue types/functions, muted yellow literals, and warm uncertainty markers.

Related files:

- `sample-capture.html`
- `ui reference/Image.png`

## Decision: V1 is a static TypeScript application without a graph canvas

Status: Active

Context:
The first release must establish reliable semantic parsing and readable pseudo-HLSL before visual graph reconstruction or sharing features.

Decision:
Ship V1 as a Vite + TypeScript static application. It accepts clipboard text and renders pseudo-HLSL, output selection, and diagnostics. Do not add a graph canvas, backend, or a UI framework in V1.

Reasoning:
The core risk is semantic recovery from UE clipboard text. A static browser application makes that risk testable with local fixtures while keeping deployment and privacy simple.

Consequences:
The implementation follows [Baseline Implementation Plan](../baseline-implementation-plan.md). Future canvas or sharing work must consume the Graph IR rather than bypassing it.

Related files:

- `docs/baseline-implementation-plan.md`

## Decision: Preserve opaque custom code and external function calls

Status: Active

Context:
The Bayer Dither and Interleaved Gradient Noise fixtures contain `Custom` HLSL nodes and engine-view references; the fixture corpus also contains external Material Function calls.

Decision:
Represent Custom HLSL and unresolved external function calls explicitly in the intermediate graph and pseudo-HLSL output. Render an external asset as `AssetName(inputs...)`. By default, render a connected Custom Node as a compact `Custom_Name(inputs...)` call with its warning retained above the code. When `Expand Custom nodes` is enabled, decode and display its complete serialized `Code` inside a scoped `CustomHLSL` block, bind only declared `Inputs(n)`, and suppress the opaque-call warning. Deduplicate identical displayed warnings. Do not rewrite the stored HLSL body.

Reasoning:
The copied graph does not provide sufficient evidence to safely reconstruct every external dependency or engine-specific symbol.

Consequences:
The generator emits readable calls such as `Pi(2.0)` and `MakeFloat3(x, y, z)` while identifying their full asset paths in warnings. Known standard operations such as Unreal `Cosine` and `Sine` map directly to `cos` and `sin` without unsupported-node warnings. A Custom output is always obtained from its serialized `OutputType` or Unreal's omitted-property default (`float3` for the main output, scalar for an additional output), so it is not user-editable. Only Custom inputs without an exact graph-derived type appear in Type Overrides; a known upstream value, including another Custom output, propagates automatically. Disconnected Custom Nodes remain ignored.

Related files:

- `samples/Bayer_Matrix_Dither_-_Material_Function/`
- `samples/MF_Noise_InterleavedGradientGolden_1d/`
- `samples/MF_GerstnerWaves/`

## Decision: Ignore disconnected Custom nodes

Status: Active

Context:
Disconnected Custom nodes are inspectable in the source Unreal graph and do not contribute to the selected output's data flow.

Decision:
Do not search for, collect, return, or display disconnected Custom nodes. Preserve a connected Custom node as an opaque call in pseudo-HLSL because it participates in the selected Graph Slice.

Reasoning:
The application explains connected graph data flow. A separate reference-code surface duplicates information already available in Unreal and distracts from generated pseudo-HLSL.

Consequences:
The analysis result has no detached-reference collection. Existing fixture text remains unchanged as raw test input.

Related files:

- `samples/MF_Noise_InterleavedGradientGolden_1d/MF_Noise_InterleavedGradientGolden_1d_full_clipboard.txt`

## Decision: Compact pseudo-HLSL by graph structure and author intent

Status: Active

Context:
One declaration per Unreal node produced mechanically correct but tiring `node_7`, `node_8`, and `node_9` chains.

Decision:
Inline one-use expressions. Retain function inputs, parameters, shared values, opaque operations, authored short node comments, and expressions that exceed the readability limit as stable declarations. Do not emit an unnamed Reroute declaration when it only aliases an existing identifier; preserve authored and Named Reroute names as semantic anchors. Name generated declarations by operation, never by Unreal's transient node number. Preserve vector output-channel semantics such as `.rg` and `.b`.

For a single-output external Material Function call, prefer a meaningful serialized output pin name such as `Selected Vector -> selectedVector`. Keep the asset-derived name only for generic pins such as `Result`, `Output`, or `Return Value`, where the pin contributes no semantic information.

If an expression result flows exclusively through one or more Named Reroute renames or directly into a graph output, name the computation with the final authored name and remove the alias chain. Function Outputs return or bundle the existing value instead of declaring `output = value`. Preserve intermediate declarations when the value branches before a rename. Never rename Function Inputs or Parameters because those names are external contracts.

Reasoning:
Graph connectivity, reuse, pin metadata, and author comments are deterministic evidence. They improve readability without pretending to infer domain meaning from mathematics.

Consequences:
Equivalent connected graphs produce compact code such as the `ign` and `gr` stages in the noise fixture. `HeightToNormalSmooth` uses its Function Input names directly instead of introducing `reroute` aliases. Declaration placement remains a readability heuristic rather than semantic inference.

Related files:

- `src/pseudo-hlsl/generate.ts`
- `samples/MF_Noise_InterleavedGradientGolden_1d/`

## Decision: Keep a live Codex-browser preview during code changes

Status: Active

Context:
The project owner tests changes interactively while implementation is in progress.

Decision:
For every code-editing task, keep the Vite development server running and the printed localhost URL open in the Codex browser. Reuse an existing server when possible and verify that the URL still responds after changes. Keep one project tab: refresh or navigate the existing localhost tab instead of opening additional tabs, unless the owner explicitly requests another tab or the original is unavailable.

Reasoning:
A continuously available preview makes the current implementation immediately inspectable without a separate handoff step.

Consequences:
Start the server with `npm.cmd run dev -- --host 127.0.0.1`; the actual port may differ when 5173 is occupied. Do not use `file://`.

Related files:

- `AGENTS.md`
- `package.json`

## Decision: Infer numeric types from graph constraints and expose certainty

Status: Active

Context:
Material Function outputs do not carry a universal declared return type, and a complete registry of Engine Content functions is neither bounded nor version-independent. The word `unknown` also looked like an error without explaining whether a type was inferred or unresolved.

Decision:
Run bidirectional numeric constraint propagation per Graph Slice. Combine explicit node properties, FunctionInput types, call-pin abbreviations, swizzles, expression rules, and typed consumers. Do not assign a global return type to arbitrary Material Function assets.

For switch-shaped external calls, a serialized `Selected Vector` output plus at least two consistently annotated vector inputs such as `(V3)` is sufficient local evidence for an inferred `?float3`. This rule uses the copied call signature, not the asset name. A grouped external-function output is only presented as inferred when every included call site proves the same type; partial evidence remains user-editable `unknown`.

Render type certainty in copied pseudo-HLSL:

- `float` - confirmed by explicit graph metadata or a deterministic expression rule;
- `?float` - one concrete type inferred from surrounding constraints;
- `?float2+` - only a lower bound is proven; the value has at least two channels but may be `float3` or `float4`;
- `?type` - insufficient evidence for one concrete type.

Color is supplementary; textual markers must remain meaningful after copying. Contradictory constraints produce a diagnostic rather than an arbitrary type.

Reasoning:
The same external function may be resolved differently at different call sites. Local constraint solving uses actual graph evidence and scales without an unbounded function registry.

Consequences:
`Pi` can become `?float` through scalar sinks, and `ScreenAlignedPixelToPixelUVs` can become `?float2` when connected to Texture Sample UVs. For Function Inputs, an absent serialized `InputType` confirms `float3`; explicit enum values map to their scalar/vector, texture, bool, Material Attributes, or Substrate pseudo-HLSL types. Channel access alone records a minimum width (`G` implies `?float2+`, `B` implies `?float3+`) rather than inventing an exact type. Ambiguous values remain `?type`. A structurally recognizable `MakeFloatN` with exactly N scalar inputs may yield an inferred `?floatN`, never a confirmed type.

Related files:

- `src/graph/infer-types.ts`
- `src/graph/material-types.ts`
- `src/pseudo-hlsl/generate.ts`
- `src/main.ts`
- `samples/MF_GerstnerWaves/`
- `samples/Bayer_Matrix_Dither_-_Material_Function/`

## Decision: Name unnamed Function Outputs `Result`

Status: Active

Context:
The connected input pin of `MaterialExpressionFunctionOutput` is serialized with `PinName="Input"`. Using that technical pin name produced misleading pseudo-HLSL such as `Input = makeFloat3`.

Decision:
Use the explicit `OutputName` property when present. Otherwise render the selected Function Output as `Result`. Never treat the node's input-pin name as an output name.

Reasoning:
`Input` describes data entering the Function Output node, not the function's externally visible result. `Result` is a neutral pseudo-HLSL fallback and does not invent domain meaning.

Related files:

- `src/graph/resolve.ts`
- `samples/MF_GerstnerWaves/`

## Decision: Let users resolve external-function output types

Status: Active

Context:
The graph often provides only an inferred type, or no type, for an external Material Function output. The graph author usually knows the function's actual signature.

Decision:
Show one editable entry per unique Material Function path, never one per call node. List its outputs with an automatic inferred/minimum/unknown state and a dropdown containing the supported material type vocabulary. A manual selection is authoritative for the current clipboard and applies to every call with the same function path and output index. Re-run analysis immediately after each selection.

Sort functions with unknown outputs first, inferred/minimum outputs second, and overridden functions last; sort alphabetically within each group. Keep parser line numbers internally but do not display them in the Diagnostics UI because clipboard text is not a user-facing source listing. Group repeated orphan text, unresolved links, and unresolved Named Reroutes by diagnostic kind and show their occurrence count instead of flooding the panel with per-pin messages.

Reasoning:
Function signatures belong to the function asset rather than individual call nodes. Grouping avoids duplicate `Pi` entries and makes one user correction update the entire generated program.

Consequences:
Overrides are intentionally session-local and reset when a new clipboard is accepted. They are not yet a persistent global registry.

Related files:

- `src/analyze.ts`
- `src/graph/infer-types.ts`
- `src/graph/material-types.ts`
- `src/pseudo-hlsl/generate.ts`
- `src/main.ts`

## Decision: Reconstruct Named Reroutes in Graph IR

Status: Active

Context:
`MaterialExpressionNamedRerouteUsage` serializes a declaration reference and GUID but no ordinary input connection. Treating it as a normal expression stopped output slicing and produced opaque `NamedRerouteUsage()` calls.

Decision:
During Graph IR resolution, match each usage to a local declaration by referenced MaterialGraphNode id, then by `DeclarationGuid == VariableGuid`. Add one internal input edge from the usage to the declaration output. Treat Named Reroute declaration/usage, ordinary `MaterialExpressionReroute`, and intermediate Function Output nodes as transparent data flow. Preserve the declaration's `Name` as a semantic variable anchor.

If a partial clipboard omits the declaration, emit `unresolved-named-reroute`; never guess a declaration by display name.

Reasoning:
GUID identity is stable graph evidence; names are editable and non-unique. Reconstructing the hidden edge once in Graph IR keeps slicing, type inference, and pseudo-HLSL generation consistent.

Consequences:
The full `MF_ResolveCoordinateFrame_Biplanar_Dither` fixture resolves all five outputs without Named Reroute calls, reroute warnings, or artificial `external_` values. Ordinary reroute pins use Unreal's `InputPin` name. Pin `DefaultValue` remains a fallback when a corresponding expression property such as `ConstA` is absent.

Related files:

- `src/graph/resolve-named-reroutes.ts`
- `src/graph/resolve.ts`
- `src/graph/infer-types.ts`
- `src/pseudo-hlsl/generate.ts`
- `samples/MF_ResolveCoordinateFrame_Biplanar_Dither/`

## Decision: Center the workspace around pseudo-HLSL

Status: Active

Context:
The Unreal clipboard is machine input, not a useful reading surface. Giving it equal visual weight to generated pseudo-HLSL made the primary review workflow harder to scan.

Decision:
Use a centered, bounded two-column workspace. The compact Clipboard input sits above a combined Diagnostics and external-function panel in the narrow left column. The pseudo-HLSL panel spans the full workspace height in the wider right column. Each content area scrolls internally. On narrow screens, stack Clipboard, pseudo-HLSL, then Diagnostics. Offer a native `Paste clipboard` action in addition to ordinary paste; analyze either path immediately.

Use CSS logical units (`rem`, CSS pixels, `clamp()`, `dvh`) rather than reading physical device pixels in JavaScript. Scale root typography modestly with viewport width and preserve quiet side margins on large displays.

Reasoning:
Browsers already map OS DPI scaling to CSS logical pixels. Manual device-pixel calculations would double-apply scaling and behave inconsistently with browser zoom.

Validation:
Verified the centered two-column hierarchy in the active desktop browser. The stacked reading order is defined below the `820px` breakpoint and remains covered by the production CSS build.

Related files:

- `index.html`
- `src/styles.css`

## Decision: Preserve graph comment regions in readable pseudo-HLSL

Status: Active

Context:
Large graphs became a flat declaration stream even when the Unreal author had already divided the graph into named comment boxes. Long standalone function calls also hid their argument structure.

Decision:
Resolve each node's editor coordinates against serialized comment `Text`, position, and size. Preserve every containing rectangle from outermost to innermost instead of discarding the outer hierarchy.

Classify Comment Regions after declaration planning, when inlined expressions and surviving statements are known:

- a region spanning multiple emitted declarations is a large section rendered as:

```hlsl
//---------------------------------------------------
// Comment Name
//---------------------------------------------------
```

- a region represented by one emitted declaration is a local `// Comment` directly above it;
- when a region contains exactly one graph node and its short text is a valid identifier, use it as that result's name instead of duplicating the text as a comment.

Local Comment Region naming has lower priority than Function Input and Parameter contracts, final Named Reroutes, `Description`, `Desc`, and `NodeComment`. It has higher priority only than generated operation names. Disabling `Graph comment sections` disables section rendering, local annotations, and Comment Region naming together.

Hoist Function Inputs and direct aliases of Function Inputs into one preamble so data-flow transitions do not repeat large section headers. Preserve dependency order for all computed declarations.

Keep structured call and top-level operator metadata through translation. The `Wrap complex calls and formulas` option renders standalone calls with at least three arguments one argument per line and splits long nested binary formulas at their top-level operator. The independent `Space out complex operations` option adds blank-line separation around those declarations and expanded Custom HLSL blocks. Simple arithmetic stays compact. Calls embedded inside arithmetic remain inline.

Keep `Simplify algebra` disabled by default so pseudo-HLSL mirrors authored graph operations. When enabled, fold finite local scalar `+`, `-`, `*`, and `/` constants and remove only neutral `x + 0`, `0 + x`, `x - 0`, `x * 1`, `1 * x`, and `x / 1` operations. Do not collapse `x * 0`, `0 / x`, `x / x`, or division by zero because `NaN`, infinity, signed zero, and domain behaviour can make them observably different.

Reasoning:
Serialized graph layout is explicit author intent and stronger naming evidence than mathematical guessing. Structured call metadata avoids fragile reparsing of generated text.

Consequences:
The Tangent output of `MF_ResolveCoordinateFrame_Biplanar_Dither` retains its three logical sections and multiline `MF_Switch4_Vec3`, `MF_Coordinate_Biplanar`, `Transform`, `Convert`, and `lerp` declarations where applicable. Small boxes no longer receive oversized separators, and nested local annotations no longer erase their outer section. `HeightToNormalSmooth` splits its nested derivative subtraction across the top-level `-` and visually separates that stage from adjacent declarations.

Related files:

- `src/graph/resolve-comment-regions.ts`
- `src/graph/resolve.ts`
- `src/pseudo-hlsl/generate.ts`
- `samples/MF_ResolveCoordinateFrame_Biplanar_Dither/`

## Decision: Generate complete Function signatures from one union slice

Status: Active

Context:
A Material Function can expose several outputs. Reviewing each output as a separate generated program duplicates shared mathematics and makes whole-function review unnecessarily fragmented.

Decision:
When every detected root is a real `MaterialExpressionFunctionOutput` and there is more than one, prepend `All outputs` and select it by default. Generate it from one union Graph Slice, emit every shared declaration once, and retain individual outputs as focused views. Do not offer this synthetic mode for unrelated terminal roots in partial graph selections.

An external multi-output Material Function call is likewise emitted once. Readable mode declares only the outputs used by the selected Graph Slice and passes them as explicit pseudo-HLSL `out` results. A directly connected Named Reroute supplies the variable name; otherwise use the serialized output pin. Strict mode retains one structurally typed result bundle and field projections. Repeated calls allocate independent output symbols, so matching pin names from different call instances cannot alias or mix.

The default bundle is a readable pseudo-HLSL record:

```hlsl
return FunctionOutputs
{
    Tangent: Tangent,
    UV: UV
};
```

An optional strict HLSL-like mode emits a `struct FunctionOutputs`, assigns a `result`, and returns it. Graph comment sections and multiline formatting for standalone calls with at least three inputs are independent session-local options.

Reasoning:
The union slice represents the actual shared dependency graph. Concatenating separately generated outputs would be longer, obscure reuse, and misrepresent evaluation cost. The readable default is easier to inspect, while the strict form helps readers who prefer conventional HLSL structure.

Consequences:
`MF_ResolveCoordinateFrame_Biplanar_Dither` opens as one five-output program, but `Tangent`, `Bitangent`, `UV`, `DXY`, and `Rotation (Turns)` remain individually selectable. Formatting settings affect presentation only, not graph semantics or inferred types.

Related files:

- `src/graph/slice.ts`
- `src/pseudo-hlsl/generate.ts`
- `src/analyze.ts`
- `src/main.ts`
- `samples/MF_ResolveCoordinateFrame_Biplanar_Dither/`

## Decision: Keep built-in Material Expression semantics separate from function overrides

Status: Active

Context:
Built-in expressions such as `PreSkinnedNormal` have engine-defined output types but are not external Material Function assets, so they correctly do not appear in the user-editable function signature panel. Leaving their types unresolved nevertheless produced avoidable `?type` values.

Decision:
Maintain one evidence-backed registry for built-in expression semantics. It supports:

- fixed outputs: `Length -> float`, `PreSkinnedNormal -> float3`, `VertexNormalWS -> float3`, `Transform -> float3`;
- pin-specific outputs: `LocalPosition.XYZ -> float3`, `.XY -> float2`, `.Z -> float`;
- serialized outputs: `MaterialExpressionConvert` reads each `ConvertOutputs(n).Type` value from the clipboard;
- same-type relations: `Saturate`, `VertexInterpolator`, and `ShaderStageSwitch` propagate compatible numeric types between their inputs and output.
- screen-space derivatives: `DDX` and `DDY` preserve the input's scalar or vector width and render as HLSL `ddx` and `ddy`.

Render these expressions directly as readable pseudo-HLSL operations and do not emit unsupported-node warnings for them. Keep user overrides restricted to unresolved external Material Functions.

Reasoning:
The two categories have different evidence and identity. Built-in nodes are stable engine classes whose public semantics are documented or serialized in the copied graph; external functions are arbitrary assets whose internal output graph may be absent.

Evidence:

- Epic's [Vector Material Expressions](https://dev.epicgames.com/documentation/unreal-engine/vector-material-expressions-in-unreal-engine) documents Pre-Skinned Local Normal as a three-channel vector and VertexNormalWS as a world-space normal.
- Epic's [VertexInterpolator emitter API](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/FEmitter/VertexInterpolator) states that it interpolates and returns the supplied value across shader stages.
- Epic's [Math Material Expressions](https://dev.epicgames.com/documentation/unreal-engine/math-material-expressions-in-unreal-engine) documents per-value `Saturate` behaviour.
- Epic's [UMaterialExpressionConvert API](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/UMaterialExpressionConvert) exposes dynamic `ConvertOutputs` and explicit component mappings.
- Microsoft's [ddx](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-ddx) and [ddy](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-ddy) contracts specify a float result with the same dimensions as the input and pixel-shader-only availability; Epic exposes these operations as Material Expressions.
- The supplied UE 5.8 coordinate-frame clipboard serializes `LocalPosition` pins as `XYZ`, `XY`, and `Z`, and serializes the sample Convert output as `ConvertOutputs(0)=(Type=Vector3)`.

Consequences:
The coordinate-frame fixture now confirms `LocalPosition`, `Length`, `Convert`, `PreSkinnedNormal`, `VertexInterpolator`, `ShaderStageSwitch`, `VertexNormalWS`, and `Transform` types without manual UI entries. Truly unconstrained external function outputs remain explicit `?type` values.

The same registry now covers all 51 unique Math expression classes in the supplied UE 5.8 palette clipboard. It stores rendering and type rules together, includes scalar `uint` semantics for `FloatToUInt`, `Modulo`, and `UIntToFloat`, preserves Period and Clamp modes, and gives detached terminal outputs structural labels instead of repeated `Output` labels. The maintained table is [UE 5.8 Math Expression Registry](math-expression-registry.md).

The registry also covers all 45 unique constant and input-data classes (85 outputs) in the supplied UE 5.8 clipboard. Ordered output contracts handle generic serialized names such as `Output2`; this is necessary for `VertexColor` and vector constants. Ten stable base sources found by auditing Epic's reference were added without creating a second inference path. See [UE 5.8 Constant and Input-Data Registry](input-data-expression-registry.md).

The advanced registry covers all 64 unique classes and 155 outputs in the supplied parameter/attributes/texture/Substrate/environment clipboard, plus five documented sampler variants absent from it. Dynamic Material Attribute and texture-sample signatures follow actual serialized pins. Texture objects derive their domain type from the asset class and remain unresolved when `Texture=None`. See [UE 5.8 Advanced Material Expression Registry](advanced-expression-registry.md).

The procedural-noise extension reads the serialized enum instead of guessing from the common node class. Scalar Noise is always `float`; Vector Noise is `float3` for Cell Noise, Perlin 3D, and Perlin Curl, and `float4` for Perlin Gradient and Voronoi. Scalar Blue Noise is a parameterless `float`. Rendering preserves captured controls but does not invent omitted defaults.

A second repository-backed UE 5.8 capture adds complete contracts for 15 Substrate helpers, wrappers, and operators with 19 outputs. New complex samples also verify `CollectionParameter`, `ConstantBiasScale`, `Distance`, `SphereMask`, `RotateAboutAxis`, and feature/shading/previous-frame/shadow switch families. Numeric switch branches promote forward; their result type is not propagated backward as an exact branch requirement. Scalar values remain valid splat sources for multi-channel Component Masks.

The same Registry stores the verified output signatures of the Engine Material Functions `MakeFloat3`, `BreakOutFloat2Components`, `BreakOutFloat3Components`, and `ScreenAlignedPixelToPixelUVs`. These exact contracts remove false `?type` results without treating arbitrary asset names as type evidence; their implementations remain opaque and still produce an unexpanded-function warning in generated code.

`HeightToNormalSmooth` now preserves `float3` through all four derivative operations without unsupported-node warnings.

Related files:

- `src/graph/expression-semantics.ts`
- `src/graph/infer-types.ts`
- `src/pseudo-hlsl/generate.ts`
- `tests/expression-semantics.test.ts`
- `samples/MF_ResolveCoordinateFrame_Biplanar_Dither/`
- `samples/HeightToNormalSmooth/`
- `docs/wiki/math-expression-registry.md`
- `docs/wiki/input-data-expression-registry.md`
- `docs/wiki/advanced-expression-registry.md`

## Decision: Treat serialized dynamic pins as the expression signature

Status: Active

Context:
Get/Set Material Attributes, texture MIP modes, Shading Model selectors, Substrate conversion, and terminal material outputs do not have one useful fixed clipboard signature.

Decision:
Use the actual serialized input/output pins as the call signature. Preserve dropdown defaults. For texture samples, preserve MipValueMode and only the MipValue or derivative pins that exist; validate enum defaults by their Unreal enum domain. Treat output expressions as graph sinks. Do not render inherited sampler controls on texture-object expressions.

Reasoning:
The pin list is direct evidence of the configured node. A class-name-only signature either loses configured outputs or invents inactive inputs.

Consequences:
Derivative sampling exposes DDX/DDY; MipLevel and MipBias expose MipValue; Material Attribute plus-button selections become named fields; texture parameters retain instance identity; disconnected polymorphic switches and texture objects without an asset remain explicit `?type`.

Related files:

- `src/graph/expression-semantics.ts`
- `src/graph/resolve.ts`
- `src/pseudo-hlsl/generate.ts`
- `docs/wiki/advanced-expression-registry.md`

## Decision: Render explicit Material Function returns and analyze clipboard changes immediately

Status: Active

Context:
A focused single-output Material Function previously ended at a named assignment, which looked incomplete. Manual analysis also added an unnecessary UI step.

Decision:
End focused Material Function output code with `return <output>;`. Do not add returns to material-root or detached terminal-expression views. Reanalyze on clipboard input, keep output and formatting selects available whenever they contain a valid choice, and show direct visual confirmation after copying code.

Separate the final output declaration block from preceding calculations with one blank line. Separate every emitted `return` from output declarations with one blank line. Collapse repeated blank lines so formatting options cannot accumulate larger gaps.

Reasoning:
The Function Output node is direct structural evidence of function termination. The local parser is fast enough that a separate Analyze action has no useful role.

Consequences:
Single-output function code is self-contained and the UI has no explicit Analyze button. Structurally incomplete edits continue to preserve the last successful result.

Related files:

- `src/main.ts`
- `src/pseudo-hlsl/generate.ts`
- `tests/pseudo-hlsl.test.ts`

## Decision: Deepen existing semantic modules instead of splitting the generator

Status: Active

Context:
Numeric promotion existed separately in inference and pseudo-HLSL generation. Math input aliases, serialized default properties, rendering, and type relations were divided between the Expression Semantics Registry and special-case switches. The DOM Adapter also imported generator internals and repeated the same analysis call for every control.

Decision:
Make `material-types` the only Module for numeric family/width algebra. Make the Expression Semantics Registry own common Math rendering metadata, input aliases/default properties, output fallbacks, and type relations; retain special generator cases only where clipboard properties change actual semantics. Expose one named-request application Seam through `analyzeClipboard(source, request?)`, and keep reanalysis in one UI function.

Do not split `generate.ts` merely because it is large. Its public Interface remains small, and its translation, declaration planning, and rendering state have high Locality inside one output-slice operation.

Reasoning:
The existing modules already had multiple real callers. Deepening them removes duplicated domain knowledge without introducing hypothetical seams or pass-through files.

Consequences:
Numeric promotion cannot silently differ between inference and rendering. Adding a general Math expression usually changes one Registry entry rather than three switches. The DOM Adapter no longer imports generator or Graph IR implementation types. Behaviour remains verified at the application Interface and fixture corpus.

Related files:

- `src/graph/material-types.ts`
- `src/graph/expression-semantics.ts`
- `src/graph/infer-types.ts`
- `src/pseudo-hlsl/generate.ts`
- `src/analyze.ts`
- `src/main.ts`
- `tests/material-types.test.ts`

## Decision: Specialize Static Switches from clipboard state with direct overrides

Status: Active

Context:
Static Switch branches are mutually exclusive shader permutations. Traversing both branches produced false dependencies and made a conditional `DLWE_Snow` cycle impossible to inspect or dismiss.

Decision:
Resolve each relevant Static Switch to `True` or `False` from serialized static literals, parameter defaults, or preview-default Function Inputs. Traverse and render only the selected branch. Present ordered switch controls with branch-source and consumer summaries; changing a checkbox reanalyzes immediately. Group switches that share one static source under one override.

Reasoning:
The tool explains one useful local specialization, not every possible Unreal shader permutation. A binary control matches the serialized clipboard state and lets the graph author select the configuration they intend to inspect.

Consequences:
Inactive branches no longer create dependencies or pseudo-HLSL calls. A cycle remains visible when the selected branch genuinely contains it. `DLWE_Snow` initially preserves `Parallax Depth Effect = True`; changing it to `False` removes that cycle.

Related files:

- `src/graph/slice.ts`
- `src/pseudo-hlsl/generate.ts`
- `src/analyze.ts`
- `src/main.ts`
- `tests/graph-resolve.test.ts`
- `tests/pseudo-hlsl.test.ts`

## Decision: Keep uint internal to material analysis

Status: Active

Context:
Unreal's material compiler has integer-domain expressions such as `FloatToUInt`, `Modulo`, and `UIntToFloat`, but ordinary Material Graph values and user-visible Function Output inspection are float-oriented. Exposing `uint`, `uint2`, `uint3`, and `uint4` beside normal manual Type Overrides leaked compiler detail into the UI.

Decision:
Retain uint families in Type Facts, inference, and pseudo-HLSL when graph evidence proves them. Exclude every uint family from the manual external-function output dropdown.

Reasoning:
Automatic analysis needs the semantic distinction; graph authors generally cannot observe or select it as an ordinary Function Output type in Unreal. A manual override should contain only useful choices the user can verify.

Consequences:
Known integer expressions still render and propagate `uint*`. Arbitrary external function outputs cannot be manually forced to uint without future direct clipboard evidence.

Related files:

- `src/graph/material-types.ts`
- `tests/material-types.test.ts`

## Decision: Diagnose only missing sources at clipboard boundaries

Status: Active

Context:
An Unreal output pin retains every consumer in `LinkedTo`, including nodes outside a copied selection. Reporting those absent consumers exposed transient names such as `MaterialGraphNode_4` even though the selected computation remained complete.

Decision:
Treat an absent consumer referenced by an output pin as a normal clipboard boundary. Emit `unresolved-link` only when an input pin references an absent source, and describe that dependency using the consumer expression and input name rather than Unreal's transient node IDs.

Reasoning:
Downstream consumers are unnecessary for evaluating a selected value; an absent upstream source is necessary data and must remain explicit.

Consequences:
Partial selections no longer produce false warnings for values also used outside the selection. Genuine external inputs still render as `external_*` values and retain one human-readable warning.

Related files:

- `src/graph/resolve.ts`
- `tests/graph-resolve.test.ts`
- `tests/output-snapshots.test.ts`

## Decision: Publish V1 under MIT without the private sample corpus

Status: Active

Context:
The project owner intends to share the personal tool publicly while the collected Unreal and BlueprintUE sample corpus has mixed or unverified provenance.

Decision:
License the project under MIT and exclude the complete `samples/` directory from Git. Before the first public release, create a README that explains the graph-to-pseudo-HLSL workflow, AI-assisted graph review use case, technical-artist readability use case, type-certainty notation, variable-naming priority, supported node families, limitations, local-only clipboard handling, and non-affiliation with Epic Games. Illustrate it with an Unreal graph screenshot paired with the resulting pseudo-HLSL screenshot.

Reasoning:
MIT is a short permissive license suitable for a freely shared personal tool. Excluding samples avoids publishing third-party graphs without established redistribution rights.

Consequences:
The repository can publish the application and maintained technical documentation, but fixture-dependent tests need a separate redistributable test corpus before clean-clone CI can run the complete suite.

Related files:

- `LICENSE`
- `.gitignore`
- `README.md`
- `tests/`

Use this form for durable choices:

## Decision: <short name>

Status: Active

Context:

Decision:

Reasoning:

Consequences:

Related files:

- `<path>`
