# Glossary

This page defines project-specific terms, workflows, and abbreviations. Use precise terms consistently in code and documentation.

- `Sample-capture visual language` - the approved initial UI baseline: restrained utility-first layout, system theme support, compact readable controls, clear sections, responsive behavior, and no decorative noise.
- `Graph IR` - the resolved in-memory model of copied UE nodes, pins, links, roots, outputs, and diagnostics.
- `Graph Slice` - the cycle-safe connected upstream subset for one or more selected outputs; an all-output slice is the union of their dependencies.
- `Pseudo-HLSL` - deterministic human-readable code that describes graph semantics without claiming to be Unreal compiler output.
- `Semantic Anchor` - a stable pseudo-HLSL declaration justified by author naming, graph reuse, opacity, or expression size; it prevents both node-by-node noise and unreadable single-line expansion.
- `Type Fact` - the numeric type and certainty currently established for one Graph IR output pin.
- `Confirmed Type` - a type proven by explicit graph metadata or deterministic expression semantics; rendered as `float`, `float2`, and so on.
- `Inferred Type` - a single type derived from surrounding graph constraints rather than declared on the value itself; rendered with a `?` prefix such as `?float2`.
- `Minimum-width Type` - a lower bound proven by channel use without enough evidence for one exact vector size; rendered with a suffix such as `?float2+`.
- `Unresolved Type` - a value for which the graph permits multiple types or provides no numeric evidence; rendered as `?type`.
- `Type Override` - a user-confirmed type for an unresolved external Material Function output or Custom HLSL input. Function-output overrides are keyed by asset path and output index and apply to every matching call; Custom-input overrides are scoped to that Custom node and pin.
- `Name Override` - a user-authored replacement for one generated pseudo-HLSL declaration name. It is keyed by the serialized Unreal node GUID and output pin ID, with a temporary node-ID fallback for incomplete clipboard text, and retained only in the active browser session.
- `Editable Symbol` - generator metadata connecting a rendered pseudo-HLSL declaration to its stable Name Override key and, where applicable, its Type Override target.
- `Static Switch Override` - a user-selected compile-time boolean keyed by the serialized static source; every relevant Static Switch sharing that source uses the same specialization.
- `Named Reroute` - Unreal's declaration/usage pair for routing one value without a visible wire; usages are linked to declarations by node reference or GUID during Graph IR resolution.
- `Comment Region` - a serialized Unreal comment rectangle preserved in an outer-to-inner hierarchy. After declaration planning it becomes a large section, a local `//` annotation, or the lowest-priority authored result name according to how much code survives inside it.
- `Preamble` - hoisted Function Inputs and their direct named aliases, shown before graph comment sections.
- `Function Outputs Bundle` - the synthetic `All outputs` result that presents every real Material Function output from one union Graph Slice, either as a readable record or a strict HLSL-like struct.
- `Expression Semantics Registry` - the evidence-backed built-in-node rules that keep pseudo-HLSL rendering and fixed, pin-specific, arithmetic, branch, conversion, serialized, and same-as-input type contracts together; unlike Type Overrides, these rules are not user-editable asset signatures.
