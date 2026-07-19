# AGENTS.md

## Read Order

For meaningful work, read the maintained documentation in this order:

1. `docs/wiki/index.md`
2. `docs/wiki/project-overview.md`
3. `docs/wiki/architecture.md`
4. `docs/wiki/decisions.md`
5. `docs/wiki/known-bugs.md`
6. `docs/wiki/experiments.md`
7. `docs/wiki/glossary.md`

If the documentation conflicts with the working code or verified behaviour, investigate and update the maintained wiki; do not silently follow stale documentation.

## Source of Truth

When evidence conflicts, prefer:

1. Verified behaviour in the target environment
2. Executable code, formal schemas, and explicit contracts
3. Official primary documentation
4. Real project inputs and reproducible examples
5. Community sources, as leads rather than proof

Do not let an attractive theory override verified behaviour.

## Project Memory / LLM Wiki

This repository uses an LLM Wiki-style documentation system.

Documentation roles:

- `docs/raw/` contains original or historical source material. Do not edit it unless explicitly asked.
- `docs/wiki/` contains maintained project memory. Keep it concise, current, and useful for future agents.
- `docs/log.md` records meaningful documentation updates.

After meaningful project changes:

- update the relevant page in `docs/wiki/`
- add important new decisions to `docs/wiki/decisions.md`
- add new bugs, limitations, or failed approaches to `docs/wiki/known-bugs.md`
- add experiments or uncertain ideas to `docs/wiki/experiments.md`
- append a short entry to `docs/log.md`

Rules:

- Do not invent facts.
- Mark uncertain claims as `Unverified`.
- Prefer compact summaries over duplicated text.
- Preserve rejected approaches when they explain the current solution.
- Keep raw sources separate from maintained wiki pages.
- Use ponytail skill by default.
- Use the `improve-codebase-architecture` skill when creating or changing deep module boundaries.

## Core Rules

- If required structural, architectural, or contract decisions are unresolved, stop and ask before coding.
- Keep side effects at the edges. Keep core logic deterministic and inspectable where the domain permits it.
- Minimize hidden mutable state.
- Do not use unnecessary words; communicate briefly and professionally.
- Build the proper system rather than a workaround that will need rework.
- Reuse suitable existing project solutions; do not reinvent them without a concrete reason.

## Simplicity and Architecture Requirements

1. Prefer the simplest working solution. Use the least necessary complexity. After each change, do one simplification pass. Do not add abstraction, configuration, indirection, or generic systems unless they solve a real current need.
2. Aim for deep modules, not shallow ones. Keep interfaces small and meaningful. Avoid layers, wrappers, and concepts that do not remove complexity. Prefer fewer strong boundaries over many weak ones.
3. Track postponed issues explicitly. If a known problem, limitation, incomplete edge case, technical-debt item, or "fix later" item remains after a change, record it in `docs/wiki/known-bugs.md` with the issue, location, reason for deferral, and likely next step. Use `docs/wiki/decisions.md` for current contracts and `docs/wiki/experiments.md` for rejected or superseded approaches.

## Additional Rules

### Rule 1 - Think Before Coding

State assumptions explicitly. Ask rather than guess. Push back when a simpler approach exists. Stop when confused.

### Rule 2 - Simplicity First

Write the minimum code that solves the problem. Nothing speculative. No abstractions for single-use code.

### Rule 3 - Surgical Changes

Touch only what is necessary. Do not improve adjacent code. Match existing style. Do not refactor what is not broken.

### Rule 4 - Goal-Driven Execution

Define success criteria. Iterate until verified.

### Rule 5 - Surface Conflicts, Do Not Average Them

If two patterns contradict, choose one based on stronger evidence (for example, newer or better tested). Explain why, flag the other for cleanup, and do not blend conflicting patterns.

### Rule 6 - Read Before You Write

Before adding code, read exports, immediate callers, and shared utilities. If the reason for existing structure is unclear, ask.

### Rule 7 - Tests Verify Intent, Not Just Behaviour

Tests must encode why behaviour matters, not merely what happens. Do not test every implementation detail or intermediate experiment. Add the smallest useful test when a stable feature, public contract, or important invariant could regress; otherwise run relevant existing checks.

### Rule 8 - Match the Codebase's Conventions

Conformance is more important than personal taste within a codebase. If a convention is harmful, surface it; do not fork it silently.

## Codex Browser

Run `npm.cmd run dev -- --host 127.0.0.1`, then open the printed localhost URL in the Codex browser. Do not use `file://`.

For every code-editing task, keep this Vite server running and the site open in the Codex browser throughout the work so the project owner can inspect and test the current state. Reuse the existing server when available; after code changes, verify that its URL still responds.

Use one Codex-browser tab for this project. Reuse, navigate, or refresh the existing localhost tab for every verification; do not open additional tabs unless the project owner explicitly asks for one or the existing tab is no longer available.
