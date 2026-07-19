# Baseline Implementation Plan

## Status

Implemented and verified locally.

## Objective

Build a static browser application that accepts Unreal Engine Material or Material Function clipboard text and produces concise, stable pseudo-HLSL for the connected graph.

The result is a semantic reading aid. It is not Unreal's generated HLSL, an Unreal compiler replacement, or a graph editor.

## V0 Boundary

### In scope

- Vite + TypeScript single-page application.
- Static deployment suitable for GitHub Pages; no backend, accounts, or persistent server storage.
- Paste UE clipboard text directly into the application.
- Structural parsing of clipboard object records and properties across the observed UE 4.22–5.8 formats.
- Intermediate graph representation: nodes, pins, links, graph roots, diagnostics, and disconnected nodes.
- Backward traversal from selected Material outputs or Material Function outputs.
- Pseudo-HLSL generation for a deliberately small node subset.
- Visible diagnostics for unsupported nodes, missing dependencies, invalid links, valid partial selections, and physically truncated clipboard text.
- Separate display of detached reference nodes, including the documented Custom HLSL oracle in `MF_Noise_InterleavedGradientGolden_1d`.
- Local fixtures and automated tests.

### Explicitly out of scope

- Graph canvas, graph editing, or clipboard export back to Unreal.
- Exact Unreal shader-compiler output or shader equivalence certification.
- Material asset settings not included in the clipboard, such as blend mode, shading model, or material domain.
- Loading external `.uasset` files or resolving external Material Function assets.
- Semantic expansion or rewriting of Custom-node HLSL.
- All UE material expressions, Substrate support, Material Layers, Virtual Textures, or Landscape-specific semantics.
- Cloud storage, sharing links, authentication, or AI API calls.

## Product Behaviour

### Main interaction

1. The user pastes a full or partial UE clipboard text.
2. The parser creates a structural representation even if the text is incomplete where possible.
3. The application lists detected terminal outputs and lets the user choose one when multiple outputs exist.
4. The generator walks only the connected upstream slice for that output.
5. The page renders pseudo-HLSL and diagnostics side by side.
6. Disconnected nodes remain outside the generated expression; documented reference nodes may appear in a dedicated reference section.

### Failure behaviour

- A physically truncated input must return actionable parse diagnostics and never crash the page.
- A valid partial selection must preserve its available subgraph. Missing upstream links become explicit external inputs, not guessed values.
- An unsupported connected node becomes an explicit opaque expression and warning. It must not disappear or be silently approximated.
- A Custom node or unresolved Material Function call is represented as opaque/external unless fixture documentation declares it a detached reference.

## Technical Shape

```text
clipboard text
  -> lexer/parser
  -> raw object records
  -> graph resolver
  -> typed Graph IR + diagnostics
  -> selected-output backward slice
  -> node translator registry
  -> pseudo-HLSL program model
  -> stable renderer
  -> browser UI
```

### Proposed project structure

```text
src/
  main.ts                    # bootstraps the page and application state
  app.ts                     # coordinates parse, output selection, and rendering
  clipboard/
    parser.ts                # structural UE text parser
    raw-types.ts             # object/property syntax model
  graph/
    resolve.ts               # turns raw records into Graph IR
    types.ts                 # nodes, pins, links, roots, diagnostics
    slice.ts                 # backward traversal and cycle detection
  pseudo-hlsl/
    program.ts               # expressions, declarations, external inputs
    translate.ts             # translator registry and shared conversion rules
    render.ts                # deterministic text formatting
  ui/
    view.ts                  # DOM rendering and event wiring
    styles.css               # approved utility-first visual language
tests/
  clipboard-parser.test.ts
  graph-resolve.test.ts
  pseudo-hlsl.test.ts
  fixtures.test.ts
samples/                     # source fixtures; never modified by tests
```

The final layout can be flatter if that keeps ownership clearer. Do not add adapters or state layers without a second consumer.

## Data Contracts

### Raw object records

The parser must preserve enough information to diagnose rather than discard unfamiliar syntax:

- object class, name, and export path when present;
- nested object boundaries;
- scalar properties;
- quoted values with escaped newlines and quotes;
- `CustomProperties Pin (...)` records;
- source span or line range for diagnostics;
- incomplete object state at end of input.

Do not model UE clipboard as a fixed sequence of lines. Object records vary between fixtures and engine versions.

### Graph IR

Each resolved node must carry:

- stable source identifier and expression class;
- display name/comment when present;
- input and output pins with IDs, names, types when available, defaults, and links;
- connected, disconnected, and unresolved-link state;
- source location;
- classification: root, expression, function input/output, custom, external call, or unknown.

The resolver may produce a partial Graph IR with diagnostics. Parsing success is not equivalent to semantic graph completeness.

### Pseudo-HLSL program model

Generate a program model before formatting text. It must distinguish:

- literals;
- named external inputs;
- expressions;
- reusable declarations;
- opaque expressions;
- outputs;
- warnings associated with a source node.

This prevents formatting decisions from changing graph semantics and makes snapshot tests stable.

## Initial Translator Set

Implement only after the Graph IR is tested:

| Category | Initial support |
| --- | --- |
| literals and inputs | Constant, Constant3Vector, ScalarParameter, VectorParameter, FunctionInput |
| scalar/vector math | Add, Multiply, Divide, Power, OneMinus, Frac, SquareRoot |
| shaping and composition | LinearInterpolate, ComponentMask, AppendVector, Normalize, DotProduct, Desaturation |
| coordinate/time sources | Time, ScreenPosition, WorldPosition |
| sampling | TextureSample, SceneTexture as semantic calls, not Unreal boilerplate |
| outputs | Material root outputs and FunctionOutput |
| explicit opaque forms | Custom, MaterialFunctionCall, unknown nodes, Substrate nodes |

For any item not in this table, generate an opaque call such as:

```hlsl
float4 node_12 = UE_Unsupported_MaterialExpressionFoo(input_0, input_1);
```

The placeholder must retain the original class and all available input expressions. It must be accompanied by a warning.

## Naming and Rendering Rules

- Prefer explicit parameter, input, output, and node-comment names after identifier sanitisation.
- Otherwise use stable source-order names such as `node_12`; never use random IDs.
- Inline simple one-use literals and expressions only when that improves readability.
- Declare reused, long, or named expressions once.
- Render component masks as `.r`, `.xy`, and similar swizzles when the mask maps unambiguously.
- Render vector assembly as `float2(...)`, `float3(...)`, or `float4(...)` where dimensions are known.
- Preserve unknown types rather than inventing dimensions.
- Emit a preamble that states the output is pseudo-HLSL and lists diagnostics.
- Ensure the same clipboard and selected output produce byte-stable output.

## Fixture-Driven Milestones

### Milestone 1 - Project and parser foundation

Create the Vite/TypeScript project, test runner, fixture loader, and structural parser.

Acceptance:

- all full fixtures parse into raw object records;
- broken fixtures produce bounded diagnostics with source locations;
- no fixture causes an uncaught exception;
- quoted Custom HLSL remains intact as a property value.

### Milestone 2 - Graph resolver

Resolve raw records into nodes, pins, links, roots, disconnected nodes, and unresolved links.

Acceptance:

- `SceneColor` discovers its material output and upstream nodes;
- Material Function fixtures discover `FunctionInput` and `FunctionOutput` contracts;
- valid partial samples expose missing dependencies as unresolved/external inputs;
- disconnected Custom nodes are not included in the connected output slice.

### Milestone 3 - Pseudo-HLSL core

Implement the initial translator set and deterministic renderer.

Acceptance:

- full `SceneColor` renders a readable semantic chain using scene sampling, masking, and lerp;
- `SceneColor` partial renders its available chain and explicit external placeholders;
- `MF_Noise_InterleavedGradientGolden_1d` renders the connected node math without treating its detached Custom code as an input dependency;
- opaque nodes remain visible and warned.

### Milestone 4 - Browser workflow

Build the paste, output-selection, code, diagnostics, and detached-reference UI using the approved visual language.

Acceptance:

- paste, parse, output selection, and copy-code work without a backend;
- a malformed clipboard leaves the previous successful result intact until a new successful parse is available, while showing the new diagnostics;
- long code and diagnostics remain legible at desktop and narrow widths;
- the application makes no network request while analysing a clipboard.

### Milestone 5 - Hardening and static release

Add regression snapshots, production build, and GitHub Pages configuration.

Acceptance:

- `npm test` passes against the complete fixture corpus;
- `npm run build` produces a static deployable bundle;
- output snapshots cover supported, partial, opaque, and broken cases;
- no fixture data is embedded in the production application unless intentionally selected as an example.

## Test Strategy

Tests encode the following invariants:

- object nesting never underflows and incomplete nesting is reported;
- every resolved link points to an existing pin or becomes a diagnostic;
- graph slicing terminates even when a malformed graph contains a cycle;
- disconnected objects never affect selected-output code;
- missing inputs become named external inputs rather than literals;
- generated output is deterministic;
- opaque nodes preserve their type and connected inputs;
- detached Custom HLSL is accessible as reference data but absent from the expression slice;
- valid partial and physically truncated fixtures produce different diagnostic categories.

Do not freeze every whitespace choice or incidental intermediate variable in snapshots. Snapshot stable program output and diagnostics where they express user-visible intent.

## Deferred Work

Record these as future work, not V0 commitments:

- visual graph reconstruction with source-to-code highlighting;
- export to a compact AI-analysis document;
- shareable links;
- broader translator coverage based on observed fixture frequency;
- optional semantic comparison tooling for detached reference HLSL;
- direct Unreal clipboard output/import.

## Completion Definition

V0 is complete when a user can paste a supported full or partial clipboard into a static browser page, choose an output, receive deterministic readable pseudo-HLSL plus honest diagnostics, and verify that the Interleaved Gradient Noise node graph is semantically comparable with its detached Custom-code oracle.
