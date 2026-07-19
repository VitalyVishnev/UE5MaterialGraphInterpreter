# Architecture

Status: V1 implemented

The application exposes one deep analysis Interface, `analyzeClipboard(source, request?)`. The named request contains optional output selection, Type Overrides, Static Switch Overrides, and formatting. This Seam hides parsing, Graph IR resolution, slicing, type inference, translation, and deterministic rendering from the UI.

Current supporting surface:

- `sample-capture.html` - dependency-free local browser helper for writing clipboard samples and their metadata. It uses the browser File System Access API; no clipboard data is sent to a server.
- `src/analyze.ts` - application-facing analysis interface.
- `src/clipboard/` - structural UE clipboard parser and raw records.
- `src/graph/` - Graph IR resolution and cycle-safe, Static-Switch-aware output slicing.
- `src/graph/resolve-named-reroutes.ts` - reconstructs hidden Named Reroute dependencies from declaration references and GUIDs before slicing.
- `src/graph/resolve-comment-regions.ts` - maps node editor coordinates into every containing Unreal comment rectangle and preserves the hierarchy from outermost to innermost.
- `src/graph/infer-types.ts` - deep numeric type-inference Module; propagates Registry rules and consumer constraints forward and backward to a fixed point.
- `src/graph/expression-semantics.ts` - evidence-backed Registry that keeps pseudo-HLSL tokens, input names/aliases/default properties, fixed and pin-specific outputs, arithmetic/branch/conversion rules, same-as-input relations, and mode-dependent procedural-noise contracts together.
- `docs/wiki/math-expression-registry.md` - maintained human-readable contract for every Math expression class captured from UE 5.8.
- `docs/wiki/input-data-expression-registry.md` - maintained contract for the supplied constant/input-data palette and documented missing base sources.
- `docs/wiki/advanced-expression-registry.md` - maintained contract for advanced UE 5.8 expression families, dynamic pins, terminal sinks, and texture sampling modes.
- `src/graph/material-types.ts` - numeric and material-domain type Module. It owns internal float/uint construction, family, width, promotion, family casts, Function Input declarations, and the narrower user-selectable override list.
- `src/pseudo-hlsl/generate.ts` - supported-node translation, opaque fallback, diagnostics, and stable text rendering behind one interface.
- `src/main.ts` and `src/styles.css` - dependency-free DOM Adapter in the approved visual language. `main.ts` depends only on the application analysis Seam and has one reanalysis path for every output, override, and formatting change.
- `tests/` - public-interface, fixture-corpus, invariant, and stable-output tests.

Parser-relevant evidence from the current fixtures:

- UE clipboard text varies materially between UE 4.22 and 5.8; parse object records and properties structurally, not with a fixed line layout.
- Connected `Custom` nodes can contain HLSL and engine-view references. Compact formatting preserves them as opaque calls; optional expansion renders the decoded `Code` body inside a scoped `CustomHLSL` block with bindings for serialized `Inputs(n)`. Ignore disconnected Custom nodes. The generic empty editor pin is not a semantic input. The main Custom output uses its serialized `OutputType`, or Unreal's `float3` default when the property is omitted; additional outputs use their individual serialized records and scalar default. Custom outputs are therefore not manual Type Override targets. Only declared Custom inputs whose source type remains unresolved or minimum-width appear beside external Material Function outputs in the shared Type Overrides panel.
- Material Function calls can reference external assets. Render them as readable calls named from the asset path while retaining an explicit warning that their implementation was not expanded.
- Function Input types use Unreal's clipboard serialization contract: absent `InputType` means `FunctionInput_Vector3`; every other supported input kind is written explicitly. The centralized mapping includes scalar/vector, texture, bool/static-bool, Material Attributes, and Substrate inputs.
- A Function Output's connected pin is technically named `Input`; this is never a semantic result name. Use serialized `OutputName` when present and `Result` when it is absent.
- Named Reroute usages have no ordinary input-pin link. Resolve their `Declaration` path first, fall back to `DeclarationGuid`/`VariableGuid`, and add an internal dependency on the declaration output. Named declarations, usages, ordinary reroutes, and Function Outputs are transparent data-flow nodes; declaration `Name` values remain semantic anchors.
- Comment Region geometry remains Graph IR evidence; presentation is decided only after declaration planning. Regions producing multiple statements become section headers, regions collapsed to one statement become local `//` annotations, and a valid identifier around exactly one graph node is the lowest-priority authored name. Nested regions remain available simultaneously.
- Valid partial selections and physically truncated text are distinct inputs and require different diagnostics. A missing consumer referenced by an output pin is a normal selection boundary, not a warning; only a missing source referenced by an input pin represents unavailable data. When a partial selection has no explicit graph sink, prefer output pins crossing the selection boundary and do not expose unused secondary channels from a node whose primary output is consumed inside the selection.
- Dynamic expressions use the actual serialized pin list. Get/Set Material Attributes, dropdown-driven nodes, texture MIP modes, derivatives, and terminal output expressions are resolved from clipboard structure rather than fixed positional signatures.
- Procedural Noise expressions read their serialized mode rather than their display label. Scalar Noise is always `float`; Vector Noise selects its `float3` or `float4` contract by mode; Scalar Blue Noise is a parameterless `float` screen-pixel source.
- Static Switches resolve serialized `StaticBool`, `StaticBoolParameter`, and preview-default `FunctionInput_StaticBool` values through Named Reroutes and the default Shading Path. The Graph Slice contains only the selected branch. Controls sharing one static source share one override, preventing configurations Unreal could not compile.
- Other switch families infer their result forward from connected branches. Numeric branches use Unreal-style scalar/vector promotion; the solver does not force the promoted result width back onto every branch because a scalar branch can broadcast.
- A scalar connected to a multi-channel Component Mask is a valid splat source, not a type conflict.

Official Epic documentation confirms that Function Inputs declare accepted types, while Function Outputs expose names and descriptions without an equivalent selectable output-type property. Type recovery therefore belongs in expression rules and Graph IR constraint propagation; external function names alone are not type evidence. Custom expressions are an exception when their serialized `OutputType` is present. See [official semantics research](../raw/unreal-material-semantics-official-research.md).

Main flow:

1. `parseClipboard` preserves UE object records and bounded structural diagnostics.
2. `resolveGraph` resolves expression nodes, pins, links, roots, outputs, and unresolved references.
3. `sliceOutput` walks one selected output upstream; `sliceOutputs` builds one union slice for a Function's complete output signature. Both specialize relevant Static Switches before traversal, terminate cycles, identify external inputs, and return ordered switch metadata for the UI.
4. `inferTypes` combines built-in expression semantics with graph constraints to derive confirmed, context-inferred, and minimum-width float/uint Type Facts without assigning global signatures to arbitrary Material Function assets.
5. `generatePseudoHlsl` translates one output; `generateAllPseudoHlsl` translates all real Function Outputs from one union slice so shared work is emitted once. Both apply optional user Type and Static Switch Overrides, inline disposable one-use expressions, preserve semantic anchors and shared values as declarations, keep unsupported semantics explicit, and return grouped Type Override and switch metadata. Static Switch nodes become their selected values rather than opaque calls. Multi-output external calls are evaluated once: readable mode unpacks used pins into independent `out` variables, while strict mode keeps a structural result bundle. Formatting options control comment sections, Custom HLSL expansion, multiline standalone calls, and readable versus strict bundles.
6. `analyzeClipboard` presents the complete result through the single application seam.

Runtime side effects are limited to DOM updates and explicit clipboard copying. Analysis is synchronous, deterministic, and makes no network requests. Hot traversals preserve one resolved node order per analysis, comment-region selection avoids per-node sorting, and the DOM Adapter batches generated code and diagnostic updates through document fragments.

Keep detailed historical material in `docs/raw/`; this page is the concise current model.
