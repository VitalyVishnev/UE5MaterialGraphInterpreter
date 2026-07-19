# Documentation Log

## 2026-07-19 - V1 version and public test mode established

Marked the application and maintained wiki as V1/1.0.0. Sample-dependent tests now run locally when the private corpus exists and are explicitly skipped in clean public checkouts, preserving both green CI and the full local regression suite.

## 2026-07-19 - Public V1 licensing and sample policy fixed

Added the MIT license, excluded the private `samples/` corpus from Git, recorded the agreed README content, and exposed the resulting clean-clone test-fixture requirement before first push.

## 2026-07-19 - UE 5.8 procedural Noise registry added

Preserved the complete scalar/vector Noise mode clipboard and Scalar Blue Noise source, added mode-aware input, setting, and output contracts, and documented the `float3`/`float4` Vector Noise channel meanings and screen-space Scalar Blue Noise limitation.

## 2026-07-13 - Complex formula spacing controls added

Recorded optional top-level wrapping for long nested formulas and independent blank-line separation for complex declarations.

## 2026-07-13 - Redundant Reroute aliases removed

Recorded that unnamed passthrough Reroutes reuse an existing identifier directly while authored and Named Reroute semantic anchors remain preserved.

## 2026-07-13 - DDX and DDY semantics integrated

Recorded same-dimension float derivative semantics, pixel-shader scope, and verified `float3` output for the `HeightToNormalSmooth` fixture.

## 2026-07-13 - Automatic analysis and explicit function returns

Recorded immediate clipboard analysis, explicit focused Material Function returns, active single-choice selectors, copy confirmation, and the deferred experiment for pasted external-function definitions.

## 2026-07-13 - UE 5.8 clipboard source corpora preserved

Stored the exact 128,634-byte constant/input-data and 331,890-byte advanced-expression clipboard exports under `docs/raw/`, recorded SHA-256 hashes, linked their maintained registries, and removed the resolved missing-source limitations.

## 2026-07-13 - Advanced UE 5.8 expression registry completed

Integrated all 64 supplied parameter, Material Attributes, texture/RVT, Substrate, atmosphere, distance-field, volumetric, and switch classes plus five documented sampler variants. Recorded dynamic MIP/DDX/DDY and attribute-pin contracts, terminal sinks, asset-derived texture-object types, official evidence, and the 155-output live validation.

## 2026-07-13 - UE 5.8 constant and input-data registry completed

Integrated all 45 unique supplied constant/input-data classes and 85 outputs, added ten documented base sources found by the gap audit, and live-verified the complete temporary clipboard in the Codex browser.

## 2026-07-13 - Wiki synchronized after Math registry work

Removed stale pre-implementation text, corrected the registry architecture description and navigation, documented the missing raw Math clipboard as a validation gap, clarified the external-function override workflow, and repaired corrupted operating-rule text.

## 2026-07-13 - Graph comment sections and multiline calls added

Mapped Unreal comment rectangles to node declarations, hoisted input aliases into a preamble to avoid repeated sections, and expanded standalone calls with three or more arguments into indented multiline form.

## 2026-07-13 - Bounded scrolling and DPI-aware scaling added

Fixed all long content surfaces inside equal scroll regions, retained a `705px` desktop baseline, and added fluid logical-unit scaling for large, standard, and narrow viewports.

## 2026-07-13 - Named Reroute data flow reconstructed

Added declaration/GUID resolution for Named Reroute usages, transparent handling for named and ordinary reroutes plus intermediate Function Outputs, and correct pin-default fallback. Verified all five outputs of the large biplanar fixture without opaque reroute calls or artificial external values.

## 2026-07-13 - External function output type controls added

Added grouped, sorted external Material Function output controls with inferred/unknown states and session-local user overrides; one selection updates every duplicate call. Removed clipboard line numbers and duplicate external-function warnings from the Diagnostics UI.

## 2026-07-13 - Unnamed Function Output fallback corrected

Stopped exposing the Function Output node's technical `Input` pin as a result name; explicit `OutputName` values remain authoritative and unnamed outputs now render as `Result`.

## 2026-07-13 - Complete Function Input types and minimum channel widths added

Recorded Unreal's omitted-Vector3 clipboard contract, added explicit mappings for every observed Function Input enum, and introduced `?floatN+` for channel-derived minimum widths; Gerstner `Direction` now renders as confirmed `float3`.

## 2026-07-13 - Bidirectional Type Facts and Unreal-style code palette added

Added call-site numeric constraint propagation, replaced `unknown` with copied-code certainty markers (`float`, `?float`, `?type`), and introduced a compact legend and Unreal-inspired syntax colors in the approved sample-capture visual style.

## 2026-07-13 - Official Unreal material semantics researched

Recorded Epic documentation for Function Input/Output asymmetry, compiler types, cast constraints, Custom output declarations, deterministic expression rules, and unresolved gaps for Engine Content functions.

## 2026-07-13 - Function-shaped graph nodes made readable

Rendered Gerstner `Cosine` and `Sine` as `cos` and `sin`, external Material Functions by asset name and inputs, and deduplicated identical displayed warnings while preserving unknown implementation paths.

## 2026-07-13 - Complete UE 5.8 Math registry implemented

Catalogued all 51 unique Math expression classes from the supplied UE 5.8 clipboard, implemented their pseudo-HLSL and type contracts, added uint conversion/modulo semantics, fixed reserved and colliding generated identifiers, introduced structural terminal-output labels, and verified all 53 copied nodes in the live application.

## 2026-07-13 - Built-in Material Expression type registry added

Researched the built-in expressions used by the coordinate-frame fixture, added pin-aware and same-type semantic rules, read dynamic Convert output types from clipboard metadata, and replaced their opaque warnings with readable pseudo-HLSL operations.

## 2026-07-13 - All-output Function rendering added

Added default `All outputs` generation from one union Graph Slice, retained focused output views, collapsed multi-output external calls, and exposed readable/strict bundles plus optional comment sections and multiline calls.

## 2026-07-13 - Live Codex-browser preview required

Recorded that every code-editing task must keep the Vite site available in the Codex browser for immediate owner testing.

## 2026-07-13 - Compact pseudo-HLSL rendering adopted

Replaced transient node-number declarations with deterministic inlining and Semantic Anchors, corrected vector output swizzles, and documented the Codex browser launch command.

## 2026-07-13 - V0 implementation completed locally

Implemented the Vite + TypeScript clipboard parser, Graph IR and slicing, pseudo-HLSL generator, responsive browser workflow, fixture tests, stable output snapshots, production build, and GitHub Pages workflow.

## 2026-07-13 - Baseline implementation approved

Recorded the static Vite + TypeScript V0 scope and its fixture-driven implementation plan.

## 2026-07-13 - Detached Custom HLSL marked as a semantic oracle

Recorded that the Interleaved Gradient Noise fixture's disconnected Custom node is a reference implementation for validating generated pseudo-HLSL, not a graph dependency.

## 2026-07-13 - Fixture corpus expanded

Added Bayer Dither, Interleaved Gradient Noise, and Texture Adjustments fixtures; recorded parser-relevant handling for version variation, Custom HLSL, external function calls, partial selections, and truncation.

## 2026-07-13 - Initial UI baseline accepted

Recorded the approved sample-capture visual language as the initial application UI baseline.

## 2026-07-13 - SceneColor sample and browser limitation recorded

Added the UE 5.7 SceneColor clipboard fixture; recorded the unverified Codex embedded-browser crash when selecting a directory.

## 2026-07-13 - Sample capture helper added

Added a local single-file browser helper that records full, partial, and intentionally broken Unreal clipboard fixtures.

## 2026-07-12 - LLM Wiki initialized

Created the maintained wiki structure and neutral project-memory rules.
## 2026-07-13 - Pseudo-HLSL-centered workspace adopted

Rebalanced the interface around a full-height pseudo-HLSL panel, compacted clipboard input, combined diagnostics and detached references in the left column, and added native one-click clipboard paste with immediate analysis.
## 2026-07-13 - Detached Custom references removed

Removed disconnected Custom-node collection from the generator, analysis contract, and UI; connected Custom nodes remain opaque calls. Added stable blank-line separation before output declarations and returns.
## 2026-07-13 - Optional safe algebra simplification added

Added an off-by-default formatting option that folds finite local scalar arithmetic and removes safe neutral operations while preserving exact graph rendering and unsafe floating-point edge cases.
## 2026-07-13 - Single Codex-browser tab required

Recorded that live verification must reuse the existing project tab rather than opening additional hidden or competing previews.
## 2026-07-13 - Core semantic modules deepened

Centralized numeric type algebra in `material-types`, moved common Math rendering inputs/defaults and output fallbacks into the Expression Semantics Registry, removed redundant generator/inference cases, and replaced UI knowledge of generator internals with one named-request analysis Seam and one reanalysis path.

## 2026-07-13 - Behaviour-preserving source polish completed

Reviewed every application source file and the sample-capture helper, removed repeated expression and pin lookups, replaced per-node comment sorting with a minimum-region scan, deduplicated slice inputs with a set, reused resolved node order across inference and generation, and batched DOM rendering. Stable output snapshots and all 243 tests remain unchanged; an attempted pin-index cache was rejected after the real-fixture benchmark showed it was slower.

## 2026-07-13 - External result names and partial type aggregation corrected

Single-output Material Function calls now name declarations from meaningful serialized output pins, so `MF_Switch4_Vec3` emits `selectedVector` rather than a function-named variable. Consistent `(V3)` branch annotations plus `Selected Vector` infer `?float3` locally. External signature aggregation no longer hides unresolved call sites behind facts from other calls; partial evidence remains an editable unknown type.

## 2026-07-13 - Multi-output external calls unpacked

Readable pseudo-HLSL now evaluates each multi-output Material Function once and exposes every used output as its own `out` variable, preferring direct Named Reroute names. Strict formatting uses a named result-bundle type instead of `?type`. Per-call symbol allocation keeps repeated invocations isolated; regression coverage verifies matching output names become `a/b` and `a_2/b_2` rather than sharing values.

## 2026-07-13 - Exclusive external result aliases collapsed

A single-output external call now adopts the final name from an exclusive chain of Named Reroutes, collapsing both case-only and semantic aliases such as `selectedVector -> RefNorm`. Intermediate names remain when the source branches, and regression coverage includes a two-stage rename chain.

## 2026-07-13 - Full sample-corpus readability audit fixes applied

Removed phantom Custom arguments, filtered unused secondary outputs from partial selections, generalized exclusive alias collapse through final graph outputs, added verified signatures for `MakeFloat3`, `BreakOutFloat3Components`, and `ScreenAlignedPixelToPixelUVs`, normalized texture swizzles, and grouped noisy broken-clipboard diagnostics. Permanent fixture coverage now includes all seven full samples and every stored physically truncated variant.
## 2026-07-14

- Added eight complex UE 5.8 sample families to automatic full/broken corpus coverage.
- Added built-in semantics for utility, collection, platform-switch, and Substrate expressions exposed by the new samples.
- Preserved and verified the 15-class Substrate clipboard under `docs/raw/ue5.8-clipboard-captures/`.
- Corrected switch inference to use forward scalar/vector promotion and accepted scalar splats through Component Mask.
- Documented the unresolved conditional static-switch cycle in `DLWE_Snow`.
- Added branch-aware Static Switch specialization, shared binary overrides, ordered Diagnostics controls, and `DLWE_Snow` regression coverage; disabling its clipboard-default Parallax branch now removes the conditional cycle.
- Made Static Switch and external-function Diagnostics sections natively collapsible and removed unreadable asset paths from function cards.
- Removed internal `uint*` families from manual Function Output type dropdowns while preserving integer-domain inference and pseudo-HLSL semantics.

## 2026-07-19 - Partial-selection link diagnostics corrected

- Stopped warning about output consumers omitted from a clipboard selection.
- Kept missing input sources explicit with human-readable messages that do not expose transient `MaterialGraphNode_*` identifiers.
- Added regression coverage and verified the originally reported clipboard in the browser.

## 2026-07-19 - Optional connected Custom HLSL expansion

- Added an `Expand Custom nodes` formatting option; compact calls remain the default.
- Expanded mode preserves the decoded Custom `Code` body and binds only serialized Custom inputs.
- Added connected Custom outputs to the existing editable type-override panel.

## 2026-07-19 - Custom input Type Overrides replace output overrides

- Made Custom HLSL outputs deterministic from Unreal metadata and serialization defaults instead of exposing them as manual output overrides.
- Unified manual Type Overrides: external Material Function outputs remain editable, while Custom Nodes expose only inputs whose type cannot be determined exactly from the connected graph.
- Added public-interface tests for omitted Custom `OutputType`, chained Custom type propagation, and unresolved Custom input overrides.

## 2026-07-19 - Formatting and type-control tooltips completed

- Made `Space out complex operations` visually separate expanded Custom HLSL blocks.
- Added native tooltips to every formatting checkbox, the all-output bundle selector, Static Switch overrides, and manual type selectors.

## 2026-07-19 - Adaptive nested Comment Regions

- Preserved all containing Comment Boxes in Graph IR instead of retaining only the smallest rectangle.
- Classified comments after declaration planning: multiple statements use section separators, one statement uses `//`, and a valid single-node comment can name its result at the lowest authored priority.
- Added regressions for nested region order, naming priority, collapsed multi-node regions, and disabled comment formatting.
