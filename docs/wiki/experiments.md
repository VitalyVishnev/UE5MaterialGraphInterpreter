# Experiments

This page stores rejected, superseded, or otherwise non-current approaches that still matter because they explain the current contract.

## Experiment: Paste external Material Function definitions

Status: Superseded

Context:
Allow an unresolved external Material Function card to accept the full Unreal clipboard of that function's internal graph. Match it by full asset identity and validate its serialized inputs and outputs against the call signature. Reject mismatched definitions explicitly; if compatible, use the internal graph for output-type inference and optional expansion. Nested external functions remain unresolved until their definitions are also supplied.

Outcome:
Implemented as the session-local Function Definition Library. Exact stable-ID validation, recursive dependencies, shared definitions, cycle handling, definition-derived types, helper declarations, and Graph IR inlining now live behind `AnalysisWorkspace`.

Keep:
The clipboard already provides enough structure to make this a deterministic, user-supplied source of evidence; no LLM inference is required for signature validation.

Related files:

- `src/graph/resolve.ts`
- `src/graph/infer-types.ts`
- `src/main.ts`

Use this form:

## Experiment: <short name>

Status: Rejected | Superseded | Unverified

Context:

Outcome:

Keep:

Related files:

- `<path>`
