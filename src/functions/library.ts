import type { Diagnostic } from "../clipboard/raw-types";
import { parseClipboard } from "../clipboard/parser";
import { inferTypes, type InferredType } from "../graph/infer-types";
import { declaredFunctionInputType, type MaterialType } from "../graph/material-types";
import { resolveGraph } from "../graph/resolve";
import { sliceOutputs, type StaticSwitchControl } from "../graph/slice";
import type { GraphLink, GraphNode, GraphOutput, GraphPin, MaterialGraph } from "../graph/types";
import { functionOutputId, materialFunctionName, type FunctionGenerationKnowledge } from "../pseudo-hlsl/generate";

export type FunctionExpansionMode = "types" | "helpers" | "inline";

export interface FunctionValueSummary {
  id: string;
  name: string;
  type?: MaterialType;
  confidence?: InferredType["confidence"];
}

export interface FunctionDependencyNode {
  target: string;
  name: string;
  status: "missing" | "defined" | "invalid";
  callCount: number;
  shared: boolean;
  cycle: boolean;
  error?: string;
  outputs: FunctionValueSummary[];
  staticSwitches: StaticSwitchControl[];
  children: FunctionDependencyNode[];
}

export interface FunctionExpansion {
  graph: MaterialGraph;
  estimatedInlineNodes: number;
  blocked: boolean;
  diagnostics: Diagnostic[];
}

interface SignatureValue {
  id: string;
  name: string;
  index: number;
}

export interface FunctionSignature {
  inputs: SignatureValue[];
  outputs: SignatureValue[];
}

interface Definition {
  target: string;
  graph: MaterialGraph;
  signature: FunctionSignature;
  expectedSignature: FunctionSignature;
  valid: boolean;
  error?: string;
}

export interface FunctionLibrary {
  readonly knowledge: FunctionGenerationKnowledge;
  readonly definitions: ReadonlyMap<string, string>;
  tree(): FunctionDependencyNode[];
  graph(target: string): MaterialGraph | undefined;
  signature(target: string): FunctionSignature | undefined;
  mode(target: string, globalMode: FunctionExpansionMode, overrides: ReadonlyMap<string, FunctionExpansionMode>): FunctionExpansionMode;
  resolveStaticSwitchOverrides(overrides: ReadonlyMap<string, boolean>): ReadonlyMap<string, boolean>;
  expand(
    graph: MaterialGraph,
    globalMode: FunctionExpansionMode,
    overrides: ReadonlyMap<string, FunctionExpansionMode>,
    staticSwitchOverrides?: ReadonlyMap<string, boolean>,
    allowLargeInline?: boolean,
  ): FunctionExpansion;
}

interface CallOccurrence {
  node: GraphNode;
  graph: MaterialGraph;
}

const INLINE_NODE_WARNING = 10_000;
const inputPins = (node: GraphNode): GraphPin[] => node.pins.filter((pin) => pin.direction === "input");
const outputPins = (node: GraphNode): GraphPin[] => node.pins.filter((pin) => pin.direction === "output");
const valueKey = (nodeId: string, pinId: string): string => `${nodeId}:${pinId}`;

function indexedProperties(node: GraphNode, prefix: string): string[] {
  return [...node.properties]
    .flatMap(([key, value]) => {
      const index = key.match(new RegExp(`^${prefix}\\((\\d+)\\)$`))?.[1];
      return index === undefined ? [] : [{ index: Number(index), value }];
    })
    .sort((a, b) => a.index - b.index)
    .map(({ value }) => value);
}

function serializedName(value: string, key: string, fallback: string): string {
  return value.match(new RegExp(`${key}="([^"]*)"`))?.[1]
    ?? value.match(new RegExp(`${key}=([^,)]+)`))?.[1]
    ?? fallback;
}

function callSignature(node: GraphNode): FunctionSignature {
  const inputsPins = inputPins(node);
  const outputsPins = outputPins(node);
  const inputs = indexedProperties(node, "FunctionInputs").map((value, index) => ({
    id: value.match(/ExpressionInputId=([A-Fa-f0-9]{32})/)?.[1].toUpperCase() ?? "",
    name: serializedName(value, "InputName", inputsPins[index]?.name ?? `Input ${index + 1}`),
    index,
  }));
  const outputs = indexedProperties(node, "FunctionOutputs").map((value, index) => ({
    id: value.match(/ExpressionOutputId=([A-Fa-f0-9]{32})/)?.[1].toUpperCase() ?? "",
    name: serializedName(value, "OutputName", outputsPins[index]?.name ?? `Output ${index + 1}`),
    index,
  }));
  return { inputs, outputs };
}

function definitionSignature(graph: MaterialGraph): FunctionSignature {
  const values = (kind: "function-input" | "function-output"): SignatureValue[] =>
    [...graph.nodes.values()]
      .filter((node) => node.kind === kind)
      .map((node, index) => ({
        id: (node.properties.get("Id") ?? "").toUpperCase(),
        name: node.displayName ?? (kind === "function-input" ? `Input ${index + 1}` : `Output ${index + 1}`),
        index,
      }));
  return { inputs: values("function-input"), outputs: values("function-output") };
}

function externalCalls(graph: MaterialGraph): GraphNode[] {
  return [...graph.nodes.values()].filter((node) => node.kind === "external-call");
}

function targetOf(node: GraphNode): string {
  return node.properties.get("MaterialFunction") ?? "UnresolvedMaterialFunction";
}

function callInputOverrideId(target: string, call: GraphNode, inputId: string): string {
  return `${target}::call:${call.nodeGuid ?? call.id}::function-input:${inputId}`;
}

function serializedBool(value: string | undefined): boolean | undefined {
  if (value?.toLowerCase() === "true") return true;
  if (value?.toLowerCase() === "false") return false;
  return undefined;
}

function pin(node: GraphNode, name: string): GraphPin | undefined {
  return inputPins(node).find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
}

function resolveStaticBool(
  graph: MaterialGraph,
  link: GraphLink | undefined,
  visiting = new Set<string>(),
): boolean | undefined {
  if (!link || visiting.has(link.nodeId)) return undefined;
  const node = graph.nodes.get(link.nodeId);
  if (!node) return undefined;
  visiting.add(node.id);
  let value: boolean | undefined;
  if (node.expressionClass === "MaterialExpressionStaticBool") {
    value = serializedBool(pin(node, "Value")?.defaultValue);
  } else if (node.expressionClass === "MaterialExpressionStaticBoolParameter") {
    value = serializedBool(node.properties.get("DefaultValue") ?? pin(node, "Default Value")?.defaultValue);
  } else if (node.kind === "function-input" && node.properties.get("InputType") === "FunctionInput_StaticBool") {
    value = resolveStaticBool(graph, pin(node, "Preview")?.links[0], visiting);
  } else if (/MaterialExpression(?:Named)?Reroute(?:Declaration|Usage)?$/.test(node.expressionClass)) {
    value = resolveStaticBool(graph, (pin(node, "Input") ?? pin(node, "InputPin"))?.links[0], visiting);
  }
  visiting.delete(node.id);
  return value;
}

function compareIds(label: string, expected: SignatureValue[], actual: SignatureValue[]): string | undefined {
  const expectedIds = new Set(expected.map(({ id }) => id).filter(Boolean));
  const actualIds = new Set(actual.map(({ id }) => id).filter(Boolean));
  if (expectedIds.size !== expected.length || actualIds.size !== actual.length) {
    return `${label} cannot be verified because stable Unreal IDs are missing.`;
  }
  const missing = expected.filter(({ id }) => !actualIds.has(id));
  const extra = actual.filter(({ id }) => !expectedIds.has(id));
  if (!missing.length && !extra.length) return undefined;
  const parts = [
    missing.length ? `missing ${missing.map(({ name }) => name).join(", ")}` : "",
    extra.length ? `extra ${extra.map(({ name }) => name).join(", ")}` : "",
  ].filter(Boolean);
  return `${label}: ${parts.join("; ")}.`;
}

function validateDefinition(definition: Definition, calls: GraphNode[]): string | undefined {
  if (!definition.signature.outputs.length) return "The pasted clipboard has no Material Function Outputs.";
  const connectedOutputIds = new Set(definition.graph.outputs.flatMap((output) => {
    const owner = definition.graph.nodes.get(output.ownerNodeId);
    const id = owner?.kind === "function-output" ? owner.properties.get("Id") : undefined;
    return id ? [id.toUpperCase()] : [];
  }));
  if (definition.signature.outputs.some(({ id }) => !connectedOutputIds.has(id))) {
    return "Every Material Function Output must be connected in the pasted definition.";
  }
  for (const call of calls) {
    const expected = callSignature(call);
    const inputError = compareIds("Inputs", expected.inputs, definition.signature.inputs);
    const outputError = compareIds("Outputs", expected.outputs, definition.signature.outputs);
    if (inputError || outputError) return [inputError, outputError].filter(Boolean).join(" ");
  }
  return undefined;
}

function definitionOutput(
  definition: Definition,
  outputId: string,
): GraphOutput | undefined {
  return definition.graph.outputs.find((output) => {
    const owner = definition.graph.nodes.get(output.ownerNodeId);
    return owner?.kind === "function-output"
      && owner.properties.get("Id")?.toUpperCase() === outputId.toUpperCase();
  });
}

function seedFacts(
  graph: MaterialGraph,
  facts: ReadonlyMap<string, InferredType>,
): Map<string, InferredType> {
  const seeds = new Map<string, InferredType>();
  for (const node of externalCalls(graph)) {
    outputPins(node).forEach((pin, index) => {
      const fact = facts.get(functionOutputId(targetOf(node), index));
      if (fact) seeds.set(valueKey(node.id, pin.id), fact);
    });
  }
  return seeds;
}

function inferDefinitionFacts(definitions: ReadonlyMap<string, Definition>): Map<string, InferredType> {
  const result = new Map<string, InferredType>();
  for (let pass = 0; pass < Math.max(1, definitions.size * 2); pass += 1) {
    let changed = false;
    for (const definition of definitions.values()) {
      if (!definition.valid || !definition.graph.outputs.length) continue;
      const slice = sliceOutputs(definition.graph, definition.graph.outputs.map(({ id }) => id));
      const inferred = inferTypes(definition.graph, slice, new Map(), seedFacts(definition.graph, result));
      for (const [index, signatureOutput] of definition.expectedSignature.outputs.entries()) {
        const output = definitionOutput(definition, signatureOutput.id);
        const fact = output?.sourceNodeId && output.sourcePinId
          ? inferred.facts.get(valueKey(output.sourceNodeId, output.sourcePinId))
          : undefined;
        const id = functionOutputId(definition.target, index);
        const previous = result.get(id);
        if (fact && (previous?.type !== fact.type || previous.confidence !== fact.confidence)) {
          result.set(id, fact);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return result;
}

function inlineLiteral(
  id: string,
  code: string | undefined,
  type: MaterialType | undefined,
): GraphNode {
  return {
    id,
    expressionClass: "MaterialExpressionInlineLiteral",
    kind: "expression",
    properties: new Map([
      ["Code", code ?? "0.0"],
      ["Type", type ?? "float"],
    ]),
    pins: [{ id: `${id}_Output`, name: "Output", direction: "output", links: [] }],
    startLine: 0,
  };
}

function inlineStaticBool(id: string, value: boolean): GraphNode {
  return {
    id,
    expressionClass: "MaterialExpressionStaticBool",
    kind: "expression",
    properties: new Map(),
    pins: [
      { id: `${id}_Value`, name: "Value", direction: "input", defaultValue: String(value), links: [] },
      { id: `${id}_Output`, name: "Output", direction: "output", links: [] },
    ],
    startLine: 0,
  };
}

function mappedLink(link: GraphLink, ids: ReadonlyMap<string, string>): GraphLink {
  return { nodeId: ids.get(link.nodeId) ?? link.nodeId, pinId: link.pinId };
}

function inlineCall(
  nodes: Map<string, GraphNode>,
  call: GraphNode,
  definition: Definition,
  expandedDefinition: MaterialGraph,
  staticSwitchOverrides: ReadonlyMap<string, boolean>,
): void {
  const prefix = `${call.id}__`;
  const excluded = new Set(
    [...expandedDefinition.nodes.values()]
      .filter((node) => node.kind === "function-input" || node.kind === "function-output")
      .map(({ id }) => id),
  );
  const ids = new Map(
    [...expandedDefinition.nodes.values()]
      .filter((node) => !excluded.has(node.id))
      .map((node) => [node.id, `${prefix}${node.id}`]),
  );
  const callInputs = callSignature(call).inputs;
  const inputSources = new Map<string, GraphLink>();

  for (const inputNode of expandedDefinition.nodes.values()) {
    if (inputNode.kind !== "function-input") continue;
    const signatureId = inputNode.properties.get("Id") ?? "";
    const signature = callInputs.find(({ id }) => id === signatureId);
    const callPin = signature
      ? inputPins(call)[signature.index]
      : inputPins(call).find((pin) => pin.name === inputNode.displayName);
    const override = signature
      ? staticSwitchOverrides.get(callInputOverrideId(definition.target, call, signature.id))
      : undefined;
    let source: GraphLink | undefined;
    if (override !== undefined) {
      const boolId = `${prefix}${inputNode.id}__override`;
      const boolNode = inlineStaticBool(boolId, override);
      nodes.set(boolNode.id, boolNode);
      source = { nodeId: boolNode.id, pinId: boolNode.pins[1].id };
    } else {
      source = callPin?.links[0];
    }
    if (!source) {
      const preview = inputPins(inputNode).find((pin) => pin.name === "Preview")?.links[0];
      if (preview) source = mappedLink(preview, ids);
    }
    if (!source) {
      const literalId = `${prefix}${inputNode.id}__default`;
      const type = declaredFunctionInputType(inputNode.properties.get("InputType"));
      const literal = inlineLiteral(literalId, callPin?.defaultValue, type);
      nodes.set(literal.id, literal);
      source = { nodeId: literal.id, pinId: literal.pins[0].id };
    }
    for (const output of outputPins(inputNode)) {
      inputSources.set(valueKey(inputNode.id, output.id), source);
    }
  }

  for (const node of expandedDefinition.nodes.values()) {
    if (excluded.has(node.id)) continue;
    const clonedId = ids.get(node.id)!;
    const cloned: GraphNode = {
      ...node,
      id: clonedId,
      nodeGuid: node.nodeGuid ? `${call.nodeGuid ?? call.id}:${node.nodeGuid}` : undefined,
      properties: new Map(node.properties),
      commentRegions: node.commentRegions?.map((region) => ({ ...region, id: `${prefix}${region.id}` })),
      pins: node.pins.map((pin) => ({
        ...pin,
        links: pin.links.flatMap((link) => {
          const inputSource = inputSources.get(valueKey(link.nodeId, link.pinId));
          return [inputSource ?? mappedLink(link, ids)];
        }),
      })),
    };
    nodes.set(clonedId, cloned);
  }

  const proxyInputs: GraphPin[] = [];
  const signature = callSignature(call);
  for (const [index, outputPin] of outputPins(call).entries()) {
    const signatureOutput = signature.outputs[index];
    const graphOutput = signatureOutput
      ? definitionOutput(definition, signatureOutput.id)
      : expandedDefinition.outputs[index];
    if (!graphOutput?.sourceNodeId || !graphOutput.sourcePinId) continue;
    const inputSource = inputSources.get(valueKey(graphOutput.sourceNodeId, graphOutput.sourcePinId))
      ?? { nodeId: ids.get(graphOutput.sourceNodeId) ?? graphOutput.sourceNodeId, pinId: graphOutput.sourcePinId };
    proxyInputs.push({
      id: `${outputPin.id}__InlineInput`,
      name: `InlineOutput:${outputPin.id}`,
      direction: "input",
      links: [inputSource],
    });
  }
  nodes.set(call.id, {
    ...call,
    expressionClass: "MaterialExpressionInlinedFunctionCall",
    kind: "expression",
    pins: [
      ...outputPins(call).map((pin) => ({ ...pin, links: [...pin.links] })),
      ...proxyInputs,
    ],
  });
}

export function compileFunctionLibrary(
  root: MaterialGraph,
  sources: ReadonlyMap<string, string> = new Map(),
): FunctionLibrary {
  const callsByTarget = new Map<string, GraphNode[]>();
  const occurrencesByTarget = new Map<string, CallOccurrence[]>();
  const parsedDefinitions = new Map<string, Definition>();
  const queuedGraphs: MaterialGraph[] = [root];
  const queuedTargets = new Set<string>();

  for (let index = 0; index < queuedGraphs.length; index += 1) {
    const graph = queuedGraphs[index];
    for (const call of externalCalls(graph)) {
      const target = targetOf(call);
      callsByTarget.set(target, [...(callsByTarget.get(target) ?? []), call]);
      occurrencesByTarget.set(target, [...(occurrencesByTarget.get(target) ?? []), { node: call, graph }]);
      const source = sources.get(target);
      if (source === undefined || queuedTargets.has(target)) continue;
      queuedTargets.add(target);
      const definitionGraph = resolveGraph(parseClipboard(source));
      const definition: Definition = {
        target,
        graph: definitionGraph,
        signature: definitionSignature(definitionGraph),
        expectedSignature: callSignature(call),
        valid: false,
      };
      parsedDefinitions.set(target, definition);
      const error = validateDefinition(definition, callsByTarget.get(target) ?? []);
      definition.valid = !error;
      definition.error = error;
      if (definition.valid) queuedGraphs.push(definitionGraph);
    }
  }

  for (const definition of parsedDefinitions.values()) {
    const firstCall = callsByTarget.get(definition.target)?.[0];
    if (firstCall) definition.expectedSignature = callSignature(firstCall);
    const error = validateDefinition(definition, callsByTarget.get(definition.target) ?? []);
    definition.valid = !error;
    definition.error = error;
  }

  const validDefinitions = new Map(
    [...parsedDefinitions].filter(([, definition]) => definition.valid),
  );
  const outputFacts = inferDefinitionFacts(validDefinitions);
  const loadedTargets = new Set(validDefinitions.keys());
  const knowledge: FunctionGenerationKnowledge = { outputFacts, loadedTargets };
  const groupedSwitchAliases = new Map<string, string[]>();
  const switchesByTarget = new Map<string, StaticSwitchControl[]>();

  const definitionSwitches = (
    target: string,
    definition: Definition,
  ): StaticSwitchControl[] => {
    const cached = switchesByTarget.get(target);
    if (cached) return cached;
    const controls = sliceOutputs(
      definition.graph,
      definition.graph.outputs.map(({ id }) => id),
    ).staticSwitches;
    const inputControls = controls.flatMap((control) => {
      const inputId = control.id.match(/^function-input:(.+)$/)?.[1];
      return inputId ? [{ control, inputId }] : [];
    });
    const intrinsic = controls
      .filter((control) => !control.id.startsWith("function-input:"))
      .map((control) => ({ ...control, id: `${target}::${control.id}` }));
    if (!inputControls.length) {
      switchesByTarget.set(target, intrinsic);
      return intrinsic;
    }

    const occurrences = occurrencesByTarget.get(target) ?? [];
    const groups = new Map<string, CallOccurrence[]>();
    for (const occurrence of occurrences) {
      const signature = callSignature(occurrence.node);
      const configuration = inputControls.map(({ inputId }) => {
        const input = signature.inputs.find((candidate) => candidate.id === inputId);
        const inputPin = input ? inputPins(occurrence.node)[input.index] : undefined;
        return serializedBool(inputPin?.defaultValue)
          ?? resolveStaticBool(occurrence.graph, inputPin?.links[0])
          ?? "?";
      }).join("|");
      groups.set(configuration, [...(groups.get(configuration) ?? []), occurrence]);
    }

    const grouped = [...groups.values()].flatMap((group, groupIndex) =>
      inputControls.map(({ control, inputId }) => {
        const directIds = group.map(({ node }) => callInputOverrideId(target, node, inputId));
        const id = `${target}::group:${groupIndex + 1}::function-input:${inputId}`;
        groupedSwitchAliases.set(id, directIds);
        const first = group[0];
        const signature = first ? callSignature(first.node).inputs.find((input) => input.id === inputId) : undefined;
        const inputPin = first && signature ? inputPins(first.node)[signature.index] : undefined;
        const value = first
          ? serializedBool(inputPin?.defaultValue) ?? resolveStaticBool(first.graph, inputPin?.links[0])
          : undefined;
        return {
          ...control,
          id,
          label: group.length > 1 ? `${control.label} · ${group.length} calls` : control.label,
          value: value ?? control.value,
          resolved: value !== undefined,
        };
      }));
    const result = [...intrinsic, ...grouped];
    switchesByTarget.set(target, result);
    return result;
  };

  const tree = (): FunctionDependencyNode[] => {
    const seen = new Set<string>();
    const build = (graph: MaterialGraph, ancestors: ReadonlySet<string>): FunctionDependencyNode[] => {
      const targets = [...new Set(externalCalls(graph).map(targetOf))];
      return targets.map((target) => {
        const definition = parsedDefinitions.get(target);
        const valid = definition?.valid === true;
        const cycle = ancestors.has(target);
        const shared = seen.has(target);
        seen.add(target);
        const expected = callSignature((callsByTarget.get(target) ?? [])[0] ?? externalCalls(graph)[0]);
        let staticSwitches: StaticSwitchControl[] = [];
        if (valid && definition.graph.outputs.length) {
          staticSwitches = definitionSwitches(target, definition);
        }
        return {
          target,
          name: materialFunctionName(target),
          status: !sources.has(target) ? "missing" : valid ? "defined" : "invalid",
          callCount: callsByTarget.get(target)?.length ?? 0,
          shared,
          cycle,
          error: definition?.error,
          outputs: expected.outputs.map((output, index) => {
            const fact = outputFacts.get(functionOutputId(target, index));
            return {
              id: functionOutputId(target, index),
              name: output.name,
              type: fact?.type,
              confidence: fact?.confidence,
            };
          }),
          staticSwitches,
          children: valid && !cycle
            ? build(definition.graph, new Set([...ancestors, target]))
            : [],
        };
      });
    };
    return build(root, new Set());
  };

  const mode = (
    target: string,
    globalMode: FunctionExpansionMode,
    overrides: ReadonlyMap<string, FunctionExpansionMode>,
  ): FunctionExpansionMode => overrides.get(target) ?? globalMode;

  const estimate = (
    graph: MaterialGraph,
    globalMode: FunctionExpansionMode,
    overrides: ReadonlyMap<string, FunctionExpansionMode>,
    stack: ReadonlySet<string>,
  ): number => externalCalls(graph).reduce((total, call) => {
    const target = targetOf(call);
    const definition = validDefinitions.get(target);
    if (!definition || mode(target, globalMode, overrides) !== "inline" || stack.has(target)) return total;
    return total + definition.graph.nodes.size + estimate(
      definition.graph,
      globalMode,
      overrides,
      new Set([...stack, target]),
    );
  }, 0);

  const expandInternal = (
    graph: MaterialGraph,
    globalMode: FunctionExpansionMode,
    overrides: ReadonlyMap<string, FunctionExpansionMode>,
    staticSwitchOverrides: ReadonlyMap<string, boolean>,
    stack: ReadonlySet<string>,
    diagnostics: Diagnostic[],
  ): MaterialGraph => {
    const nodes = new Map(graph.nodes);
    for (const call of externalCalls(graph)) {
      const target = targetOf(call);
      const definition = validDefinitions.get(target);
      if (!definition || mode(target, globalMode, overrides) !== "inline") continue;
      if (stack.has(target)) {
        diagnostics.push({
          code: "function-definition-cycle",
          severity: "warning",
          message: `Material Function cycle reaches ${materialFunctionName(target)}; this call remains opaque.`,
          line: call.startLine,
          nodeId: call.id,
        });
        continue;
      }
      const expandedDefinition = expandInternal(
        definition.graph,
        globalMode,
        overrides,
        staticSwitchOverrides,
        new Set([...stack, target]),
        diagnostics,
      );
      inlineCall(nodes, call, definition, expandedDefinition, staticSwitchOverrides);
    }
    return { ...graph, nodes, diagnostics: [...graph.diagnostics, ...diagnostics] };
  };

  const expand = (
    graph: MaterialGraph,
    globalMode: FunctionExpansionMode,
    overrides: ReadonlyMap<string, FunctionExpansionMode>,
    staticSwitchOverrides: ReadonlyMap<string, boolean> = new Map(),
    allowLargeInline = false,
  ): FunctionExpansion => {
    const estimatedInlineNodes = estimate(graph, globalMode, overrides, new Set());
    if (estimatedInlineNodes > INLINE_NODE_WARNING && !allowLargeInline) {
      return { graph, estimatedInlineNodes, blocked: true, diagnostics: [] };
    }
    const diagnostics: Diagnostic[] = [];
    return {
      graph: expandInternal(graph, globalMode, overrides, staticSwitchOverrides, new Set(), diagnostics),
      estimatedInlineNodes,
      blocked: false,
      diagnostics,
    };
  };

  return {
    knowledge,
    definitions: new Map(sources),
    tree,
    graph: (target) => validDefinitions.get(target)?.graph,
    signature: (target) => validDefinitions.get(target)?.signature,
    mode,
    resolveStaticSwitchOverrides: (overrides) => {
      for (const [target, definition] of validDefinitions) definitionSwitches(target, definition);
      const resolved = new Map(overrides);
      for (const [groupId, callIds] of groupedSwitchAliases) {
        const value = overrides.get(groupId);
        if (value === undefined) continue;
        for (const callId of callIds) resolved.set(callId, value);
      }
      return resolved;
    },
    expand,
  };
}
