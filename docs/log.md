# Documentation Log

## 2026-07-26 - Readable If statements and conservative expression compaction

Added an optional conventional `if / else if / else` rendering mode for Material `If`, improved exclusive ordinary/Named Reroute name back-propagation, stopped repeated Comment Region labels on dependency-forced re-entry, and reused only strictly matching pure Math expressions inside the same section.

## 2026-07-26 - Explicit Material If and safe helper output rendering

Replaced opaque six-argument Material `If` calls with a documented three-way conditional that preserves `Equals Threshold`; collapse repeated equal branches into range chains; protected generated identifiers from HLSL intrinsic collisions; and made readable multi-output helpers assign to existing `out` parameters even when the source expression spans multiple lines.

## 2026-07-19 - Product README drafted

Added the English V1 landing README with a live demo, problem statement, workflow, real pseudo-HLSL example, supported feature families, type-certainty notation, variable-naming hierarchy, privacy contract, limitations, and reserved paired-screenshot placement.

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

## 2026-07-19 - README type-certainty legend

- Added local SVG badges that mirror the interpreter's confirmed, inferred, minimum-width, and unresolved type colors.
- Kept textual meanings and accessible image descriptions so certainty is not communicated by color alone.

## 2026-07-19 - Prose descriptions excluded from identifiers

- Limited `Description`, `Desc`, and `NodeComment` naming evidence to concise label-like text.
- Preserved long explanatory text in Graph IR properties while falling back to semantic operation names in pseudo-HLSL.

## 2026-07-19 - README graph-to-code composite prepared

- Combined the supplied Unreal Material Graph and interpreter screenshots into one non-generative README asset.
- Preserved both source images proportionally and placed inferred-type-colored label blocks without covering the interpreted code.
- Added the approved composite to the README's `From graph math to readable code` section.

## 2026-07-19 - Static site discovery metadata

- Added an indexable title, description, canonical URL, and `WebApplication` JSON-LD to the deployed document.
- Added public `robots.txt` and sitemap files, a compact explanatory site footer, and a GitHub repository link beside the analysis status.
- Added the owner-supplied Google Search Console verification tag.

## 2026-07-19 - Social preview connected

- Promoted the approved non-generative graph-to-code card to `public/social-preview.png`.
- Added Open Graph and Twitter Card metadata with the deployed absolute image URL.

## 2026-07-19 - Inline pseudo-HLSL presentation overrides

- Added direct declaration-name and unresolved external-output type editing in the generated code.
- Keyed Name Overrides by Unreal `NodeGuid + Output PinId` and retained them only in the active browser session.
- Kept the existing Type Override contract and avoided editing Unreal clipboard text.

## 2026-07-20 - Landscape Grass Output support

- Generalized expression-declaration discovery to preserve Material Expressions supplied by engine modules other than `/Script/Engine`.
- Added confirmed `float` semantics for `LandscapeLayerSample` and terminal output handling for each connected `LandscapeGrassOutput` input.
- Added a self-contained regression that renders a Landscape Layer Sample into a Grass Output without an unsupported-node fallback.
- Added the default `All outputs` union view for several inputs of one terminal expression, including Landscape Grass Output; terminal bundles render as `GraphOutputs` rather than a misleading Function signature.

## 2026-07-20 - Unreal-style code-token contrast

- Restricted blue syntax coloring to types, keywords, and invoked functions.
- Rendered identifiers, fields, strings, and numeric literals in the warmer yellow code color so dense pseudo-HLSL remains scannable.
- Added a Formatting checkbox that disables all syntax colors for a neutral white-code view without reanalyzing the graph.

## 2026-07-25 - Session-local Material Function Definition Library

- Added reusable `AnalysisWorkspace` parsing for one root graph and user-supplied function definitions.
- Added exact stable-ID signature validation, recursive dependency trees, shared/cycle states, session storage, and non-destructive invalid replacement handling.
- Added `Types only`, dependency-first `Helper functions`, and Graph IR `Inline functions` modes with per-asset overrides.
- Added definition-derived type facts, call-site Static Bool configuration controls, Material Root `All outputs`, and a 10,000-node inline preflight.
- Added self-contained coverage for validation, nesting, sharing, cycles, multi-output helper formats, inline isolation, Material Root bundles, call-site switch overrides, invalid session payloads, and storage quota failures.

## 2026-07-25 - Native-paste fallback for function definitions

- Added one empty compact textarea to every Material Function card.
- Routed `Ctrl+V` through native `ClipboardEvent.clipboardData` and the same exact definition-validation path as the Clipboard API button.
- Documented the embedded Codex browser's reproducible asynchronous Clipboard Read denial.

## 2026-07-25 - Unified function-definition paste control

- Joined the native-paste field and Clipboard API button into one compact horizontal control.
- Added a muted `Begin Object ...` placeholder so the expected Unreal clipboard format is visible.

## 2026-07-25 - Function-library polish

- Removed unused definition-source state and repeated pin filtering.
- Centralized function-scoped Static Switch override projection without changing analysis behavior.
- Replaced serialized object comparison in definition inference with direct Type Fact comparison.

## 2026-07-25 - Scoped helper and inline code overrides

- Made every unresolved or inferred declaration type directly editable in generated pseudo-HLSL, including internal helper and inline values.
- Preserved helper-local editable symbols and applied Name Overrides while rendering helper definitions.
- Scoped code-panel metadata by generated line range so identical identifiers in separate functions cannot steal each other's type or rename controls.
- Added regression coverage for generic inline type overrides and helper-local renaming.

## 2026-07-25 - Component-aware Convert expressions

- Replaced opaque `Convert(...)` rendering with one shared sparse-layout decoder for input/output types, defaults, and component mappings.
- Added direct identity, swizzle, scalar, and vector-constructor rendering for every selected output of a Convert node.
- Added regressions for Vector2 channel swapping and a four-input, three-output Convert with disconnected serialized defaults.

## 2026-07-25 - Trivial component projections stay inline

- Stopped repeated scalar Convert projections such as `workingNorm.g` from creating generated `convert_N` aliases.
- Preserved declarations when graph-authored naming or a manual Name Override gives the projected value independent meaning.

## 2026-07-25 - Definition type propagation and TransformPosition

- Made finite unconnected Math defaults participate in the shared type solver, fixing scalar output facts lost only when a graph was loaded as a Material Function definition.
- Added `TransformPosition` input/output contracts and readable position-space rendering, including Periodic World Tile Size when connected.
- Verified the supplied `Unsigned` output as `float` and `Max Axis Period` as `float3`.

## 2026-07-25 - Stable multi-output function mapping

- Matched loaded Material Function outputs to call pins by stable `FunctionOutput.Id` instead of Function Output node order.
- Removed the invalid same-width constraint from Dot Product operands; scalar broadcast now preserves vector inputs and downstream vector results.
- Verified the supplied `MF_Coordinate_Biplanar.Blend` as confirmed `float2` in the parent workspace.
- Made readable helper outputs assign directly to their `out` parameters without shadow declarations or `Blend = Blend`-style copies.

## 2026-07-25 - Stable function inputs and honest branch merging

- Centralized Material Function signatures and ordered helper parameters, call arguments, validation, and inline bindings by stable Unreal IDs.
- Removed order-dependent branch typing that silently selected the first incompatible vector width.
- Confirmed Epic's scalar-broadcast and unequal-vector incompatibility rules; incomplete runtime branches now remain inferred.
- Kept compile-time platform/quality permutations honest when their branch widths differ, while selected Static Switches use only the active branch.

## 2026-07-26 - Auxiliary Material Function sample capture

- Extended the local sample-capture helper with an unlimited flat list of auxiliary Material Function clipboard definitions, each with an optional identity and description.
- Save definitions under `functions/<ordered-name>/` beside the root sample and write `function-definitions.txt` as a readable index; clipboard asset paths retain the actual dependency tree.

## 2026-07-26 - Implicit `If` equality branch

- Recorded and implemented Unreal's `A == B` fallback to `A > B` when the optional equality branch is unconnected.
- This keeps complete `If` outputs confirmed and prevents fabricated `external_*_A_Equal_B` values in loaded `MF_Switch4_Vec3` and `MF_Blend_RGBToIndex` definitions.
## 2026-07-26 - Dependency-safe Comment Region ordering

- Made Unreal Comment Regions dependency-safe presentation blocks: ready declarations from the same innermost large region stay contiguous, while unavoidable re-entry uses a compact continuation label instead of repeating the full section header.

## 2026-07-26 - Output-specific missing Function guidance

- Material Function output cards now identify the exact missing or invalid nested function needed to resolve that output's type, instead of implying that every unresolved type has the same cause.

## 2026-07-26 - Resizable three-column workspace

- Moved Output, Copy, and Formatting controls into a dedicated right Code Settings panel while keeping the type-confidence legend above pseudo-HLSL.
- Renamed the mixed Diagnostics surface to Graph Inspector.
- Added constrained column and row separators with default snapping, keyboard control, double-click reset, refresh persistence, and a non-resizable stacked narrow-screen layout.
- Polished the implementation by making JavaScript use the same viewport breakpoint as CSS and removing obsolete layout selectors.

## 2026-07-26 - Unreal periodic trigonometry

- Corrected `Sine`, `Cosine`, and `Tangent`: Unreal supplies cycle-domain input, so generated pseudo-HLSL now converts it to radians with `2 * PI * Input / Period` before calling the HLSL intrinsic.
- Added one concise code-header note whenever an analyzed slice contains one of those nodes.

## 2026-07-26 - Stable output identities and Static Bool function specializations

- Replaced positional Material Function output identities with stable Unreal `FunctionOutput.Id` keys throughout inference, helper rendering, and manual Type Overrides.
- Derived output facts independently for every resolved Static Bool Function Input configuration; the inspector now groups equal configurations and exposes scoped overrides.
- Helper mode emits one uniquely named specialized helper per configuration and removes fixed Static Bool inputs from its runtime signature and calls.

## 2026-07-26 - Type Fact precedence and Registry consolidation

- Confirmed Type Facts now outrank incompatible inferred constraints; equal-strength contradictions remain explicit type conflicts.
- Moved SceneTexture output dimensions and Desaturation's same-as-input rule into the Expression Semantics Registry so Function Definition Library inference shares the same contracts as pseudo-HLSL generation.

## 2026-07-26 - Public synthetic clipboard corpus

- Added tracked, hand-authored clipboard fixtures for parser errors, Material Root outputs, Function Library validation, Static Switches, Named Reroutes, Convert, and Custom type propagation.
- Kept the ignored real-graph samples as a broader local integration suite; public CI now has representative fixture coverage without publishing private graph content.

## 2026-07-26 - Code-panel navigation and symmetric resizing

- Constrained both workspace side panes from one width budget so dragging Code Settings wide cannot collapse Clipboard/Graph Inspector or distort resize handles.
- Added optional logical line numbers and an always-visible compact pseudo-HLSL search field with `Ctrl+F`, match count, highlights, and previous/next navigation.
