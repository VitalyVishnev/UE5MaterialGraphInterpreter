# Known Bugs

This page stores current bugs, limitations, and validation gaps. Keep it focused on dangerous or still-open issues.

## Limitation: Codex browser can crash while selecting a sample directory

Status: Unverified

Symptoms:
Selecting a directory through `sample-capture.html` crashed the embedded Codex browser.

Likely cause:
Unknown. The helper invokes the browser's native File System Access directory picker.

Current workaround:
Open `sample-capture.html` in a standalone Chrome or Edge window and select the destination there.

Do not repeat:
Do not use the embedded Codex browser for directory selection until the host-browser interaction is verified.

Related files:

- `sample-capture.html`
- `samples/SceneColor/`

## Limitation: Some external Material Function result types remain unresolved

Status: Open

Symptoms:
Generated declarations may use `?type` when the selected Graph Slice does not provide enough constraints for one numeric type.

Likely cause:
Unreal documents explicit FunctionInput types but no equivalent declared FunctionOutput type; the result is derived from the hidden internal function graph and compile context.

Current workaround:
The type-inference pass resolves call-site types when consumers, pin annotations, surrounding operations, or a valid pasted definition provide evidence. The graph author can load the function definition, select its output type in Diagnostics, or click any displayed `?type`/inferred declaration in the code panel and supply the known type. Keep `?type` when several types remain possible and the author has not provided stronger evidence.

Do not repeat:
Do not assign return types from asset names alone.

Related files:

- `src/pseudo-hlsl/generate.ts`
- `src/graph/infer-types.ts`
- `src/functions/library.ts`
- `docs/raw/unreal-material-semantics-official-research.md`

## Limitation: The complete UE 5.8 Math clipboard is not stored in the repository

Status: Open

Symptoms:
The maintained registry and automated tests preserve all 51 unique Math expression classes, but a future agent cannot replay the exact 53-node, 158 KB clipboard without obtaining the original input again.

Likely cause:
The clipboard arrived as a temporary Codex attachment and was used for live validation, not added to `samples/`.

Current workaround:
Use `tests/expression-semantics.test.ts` for class coverage and [UE 5.8 Math Expression Registry](math-expression-registry.md) for the verified contract.

Do not repeat:
Do not claim that the raw Math palette fixture is repository-backed until it is explicitly saved under `samples/`.

Related files:

- `tests/expression-semantics.test.ts`
- `docs/wiki/math-expression-registry.md`

## Limitation: Disconnected polymorphic nodes cannot prove an output type

Status: Workaround

Symptoms:
Standalone switch expressions and texture-object nodes with `Texture=None` render `?type` in palette captures.

Likely cause:
Switch output type comes from connected result branches; texture-object type comes from the serialized asset class. The palette capture supplies neither.

Current workaround:
Analyze the node in a connected graph or supply the missing texture asset. Keep `?type` in disconnected captures.

Do not repeat:
Do not assign a type from a switch class name or treat every TextureObject as Texture2D.

Related files:

- `src/graph/expression-semantics.ts`
- `src/graph/infer-types.ts`

## Limitation: Partial selections can omit Named Reroute declarations

Status: Workaround

Symptoms:
A partial clipboard containing a Named Reroute usage but not its declaration reports `unresolved-named-reroute`; its value remains external to the selected graph.

Likely cause:
The usage stores declaration identity, but the declaration and its upstream source are physically absent from the clipboard selection.

Current workaround:
Copy the Named Reroute declaration with the selection or paste the full function graph. Do not match by editable display name.

Related files:

- `src/graph/resolve-named-reroutes.ts`
- `samples/MF_ResolveCoordinateFrame_Biplanar_Dither/`

## Limitation: Name Overrides without a serialized NodeGuid are temporary

Status: Workaround

Symptoms:
An inline pseudo-HLSL rename may not apply when the same value is pasted later from a fragment whose node identifier changed.

Likely cause:
Most Unreal clipboard nodes serialize `NodeGuid`, but an incomplete or hand-edited fragment can omit it. The interpreter then has only the transient graph-node name as a key.

Current workaround:
Use the original full clipboard or a selection that includes `NodeGuid`. The current tab retains the fallback override only while that temporary node name remains the same.

Do not repeat:
Do not identify a node by generated pseudo-HLSL text or by mathematical equivalence.

Related files:

- `src/graph/resolve.ts`
- `src/pseudo-hlsl/generate.ts`
- `src/main.ts`

## Limitation: Equivalent pure nodes are not globally deduplicated

Status: Open

Symptoms:
Pseudo-HLSL may contain repeated calls such as two identical `LocalPosition()` expressions or separately serialized parameters with `_2` suffixes.

Likely cause:
The generator compacts aliases and one-use expressions but intentionally preserves distinct Unreal nodes. A global common-subexpression pass would require a proven purity and property-equivalence contract for each expression class.

Current workaround:
Read the repeated expressions as equivalent when their complete serialized settings match. Named aliases and final-output copies are already collapsed safely.

Do not repeat:
Do not deduplicate arbitrary engine expressions or Custom/Material Function calls solely because their rendered strings match.

Related files:

- `src/pseudo-hlsl/generate.ts`
- `samples/MF_ResolveCoordinateFrame_Biplanar_Dither/`

## Limitation: Static-switch specialization may still expose an external-function cycle

Status: Workaround

Symptoms:
`DLWE_Snow` reports a graph cycle through `DLWE_Parallax`, Named Reroutes, and one branch of a `StaticSwitch`.

Likely cause:
The copied graph contains the structural loop in one mutually exclusive static branch. Unreal can prune an inactive branch at compile time, but the clipboard does not provide the final material-instance value needed to prove which branch survives.

Current workaround:
The Graph Slice now follows only the clipboard-selected branch and Diagnostics exposes relevant Static Switch controls. In `DLWE_Snow`, disabling `Parallax Depth Effect` removes the cycle. If it remains enabled, keep the cycle explicit because the hidden internal dependencies of `DLWE_Parallax` are unavailable.

Do not repeat:
Do not traverse both branches or delete a cycle that remains in the selected specialization.

Related files:

- `samples/DLWE_Snow/`
- `src/graph/slice.ts`

## Limitation: Missing static values and non-default Shading Paths are not fully configurable

Status: Open

Symptoms:
A Static Switch whose controlling value is absent from a partial clipboard is shown as `False` with an explicit warning. Static conditions passing through `ShadingPathSwitch` currently use its serialized `Default` path.

Likely cause:
The copied function graph does not contain the final material-instance override or target shader platform.

Current workaround:
Set the exposed Static Switch checkbox manually. Use Unreal to confirm platform-specific behavior when Deferred, Forward, or Mobile differs from Default.

Do not repeat:
Do not claim that a missing value or target Shading Path was recovered from clipboard evidence.

Related files:

- `src/graph/slice.ts`
- `src/main.ts`

## Limitation: Complete regression coverage requires the private sample corpus

Status: Workaround

Symptoms:
A clean Git checkout without `samples/` runs the self-contained suite and explicitly skips fixture-dependent scenarios. A local checkout with `samples/` runs the complete regression corpus.

Likely cause:
The original regression suite intentionally grew around real project graphs, while those graphs are now excluded from public distribution due to unverified provenance.

Current workaround:
Each fixture-dependent test uses `sampleIt`, which becomes `it.skip` only when `samples/` is absent. Public CI remains green without claiming that skipped private-fixture scenarios ran; local development retains the full suite. A future redistributable synthetic corpus can replace the skipped coverage.

Do not repeat:
Do not delete the local regression scenarios or silently report the public subset as complete fixture coverage.

Related files:

- `.gitignore`
- `.github/workflows/deploy-pages.yml`
- `tests/`
- `samples/`

## Limitation: Material Function definitions are tab-local evidence

Status: Workaround

Symptoms:
Loaded Material Function definitions survive a refresh but disappear after the browser tab is closed. Very large definition libraries can exceed the browser's `sessionStorage` quota; the current in-memory definition still works, but the UI warns that refresh will lose it.

Likely cause:
V1 intentionally remains a private static application without a backend, file format, or access to Unreal assets. Browser storage quotas vary by browser and environment.

Current workaround:
Keep the Unreal functions available for repasting. When the quota warning appears, do not refresh until the current analysis is complete.

Do not repeat:
Do not silently fall back from failed storage writes or claim that a definition library is portable between tabs, browsers, or machines.

Related files:

- `src/main.ts`
- `src/functions/library.ts`

## Limitation: Codex browser can deny asynchronous clipboard reads

Status: Workaround

Symptoms:
The embedded Codex browser can return `Read permission denied` from `navigator.clipboard.readText()` even after its Clipboard permission is reset to Ask or Allowed. Both the root `Paste clipboard` button and Material Function `Paste definition` button are affected.

Likely cause:
The refusal occurs in the embedded browser permission broker before clipboard text reaches application code. The local Vite response does not restrict Clipboard through CSP or `Permissions-Policy`, and the same refusal occurs on `127.0.0.1` and `localhost`.

Current workaround:
For a Material Function, focus the compact `Begin Object ...` field beside `Paste definition` and press `Ctrl+V`. The native paste event supplies text through `ClipboardEvent.clipboardData` without the asynchronous Clipboard Read permission.

Do not repeat:
Do not weaken definition validation or repeatedly request the same denied Clipboard API permission.

Related files:

- `src/main.ts`
- `src/styles.css`

## Limitation: Loaded definitions do not make pseudo-HLSL compiler-equivalent

Status: Workaround

Symptoms:
Helpers and inline blocks can still contain opaque engine expressions, missing nested definitions, or compile-time branches whose final platform/material-instance value is unavailable.

Likely cause:
The clipboard describes editor graph structure, not Unreal's complete compilation environment, shader platform, generated includes, or material-instance overrides.

Current workaround:
Treat expanded output as a readable semantic model. Use Diagnostics and the Function Dependency Tree to identify opaque edges, and verify compiler-sensitive behavior in Unreal.

Do not repeat:
Do not present helper or inline output as code emitted by Unreal's material compiler.

Related files:

- `src/analyze.ts`
- `src/functions/library.ts`
- `src/pseudo-hlsl/generate.ts`

Use this form:

## <Bug or limitation: short name>

Status: Open | Workaround | Unverified

Symptoms:

Likely cause:

Current workaround:

Do not repeat:

Related files:

- `<path>`
