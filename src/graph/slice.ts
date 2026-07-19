import type { Diagnostic } from "../clipboard/raw-types";
import type { GraphNode, GraphPin, MaterialGraph } from "./types";

export interface ExternalInput {
  id: string;
  nodeId: string;
  pinId: string;
  name: string;
}

export interface GraphSlice {
  outputId: string;
  outputIds: string[];
  nodeIds: ReadonlySet<string>;
  orderedNodeIds: string[];
  externalInputs: ExternalInput[];
  staticSwitches: StaticSwitchControl[];
  staticSwitchSelections: ReadonlyMap<string, boolean>;
  diagnostics: Diagnostic[];
}

export interface StaticSwitchControl {
  id: string;
  label: string;
  value: boolean;
  resolved: boolean;
  trueSource: string;
  falseSource: string;
  feeds: string[];
  switchNodeIds: string[];
}

export type StaticSwitchOverrides = ReadonlyMap<string, boolean>;

const staticSwitchClasses = new Set([
  "MaterialExpressionStaticSwitch",
  "MaterialExpressionStaticSwitchParameter",
]);

function pin(node: GraphNode, name: string): GraphPin | undefined {
  return node.pins.find((candidate) =>
    candidate.direction === "input" && candidate.name.toLowerCase() === name.toLowerCase(),
  );
}

function bool(value: string | undefined): boolean | undefined {
  if (value?.toLowerCase() === "true") return true;
  if (value?.toLowerCase() === "false") return false;
  return undefined;
}

function expressionName(node: GraphNode | undefined): string {
  if (!node) return "Missing input";
  return node.displayName ?? node.expressionClass.replace(/^MaterialExpression/, "") ?? node.id;
}

export function sliceOutputs(
  graph: MaterialGraph,
  outputIds: string[],
  staticSwitchOverrides: StaticSwitchOverrides = new Map(),
): GraphSlice {
  const outputs = outputIds.map((outputId) => {
    const output = graph.outputs.find((candidate) => candidate.id === outputId);
    if (!output) throw new Error(`Unknown graph output: ${outputId}`);
    return output;
  });

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const orderedNodeIds: string[] = [];
  const externalInputs: ExternalInput[] = [];
  const externalInputIds = new Set<string>();
  const diagnostics: Diagnostic[] = [];
  const staticSwitches = new Map<string, StaticSwitchControl>();
  const staticSwitchSelections = new Map<string, boolean>();

  const linkedNode = (input: GraphPin | undefined): GraphNode | undefined => {
    const link = input?.links[0];
    return link ? graph.nodes.get(link.nodeId) : undefined;
  };

  const sourceName = (input: GraphPin | undefined): string => {
    const link = input?.links[0];
    const source = linkedNode(input);
    if (!source) return input?.defaultValue ?? "Missing input";
    const output = source.pins.find((candidate) => candidate.id === link?.pinId);
    const suffix = output && source.pins.filter((candidate) => candidate.direction === "output").length > 1
      ? `.${output.name}`
      : "";
    return `${expressionName(source)}${suffix}`;
  };

  const conditionIdentity = (input: GraphPin | undefined): { id: string; label: string } => {
    const link = input?.links[0];
    const source = linkedNode(input);
    if (!source || !link) return { id: `pin:${input?.id ?? "missing"}`, label: "Static Switch" };
    if (source.expressionClass === "MaterialExpressionNamedRerouteUsage") {
      const declaration = linkedNode(pin(source, "Input"));
      if (declaration) {
        return {
          id: `reroute:${declaration.id}`,
          label: declaration.displayName ?? expressionName(declaration),
        };
      }
    }
    if (source.kind === "function-input") {
      return {
        id: `function-input:${source.properties.get("Id") ?? source.id}`,
        label: source.displayName ?? "Function Static Bool",
      };
    }
    if (source.expressionClass === "MaterialExpressionStaticBoolParameter") {
      return {
        id: `parameter:${source.properties.get("ExpressionGUID") ?? source.displayName ?? source.id}`,
        label: source.displayName ?? "Static Bool Parameter",
      };
    }
    return { id: `value:${source.id}:${link.pinId}`, label: expressionName(source) };
  };

  const controlFor = (node: GraphNode): StaticSwitchControl => {
    const valuePin = pin(node, "Value");
    const identity = node.expressionClass === "MaterialExpressionStaticSwitchParameter"
      ? {
          id: `parameter:${node.properties.get("ExpressionGUID") ?? node.displayName ?? node.id}`,
          label: node.displayName ?? "Static Switch Parameter",
        }
      : conditionIdentity(valuePin);
    const existing = staticSwitches.get(identity.id);
    if (existing) {
      if (!existing.switchNodeIds.includes(node.id)) existing.switchNodeIds.push(node.id);
      const merge = (current: string, next: string): string =>
        [...new Set([...current.split(", "), next])].join(", ");
      existing.trueSource = merge(existing.trueSource, sourceName(pin(node, "True")));
      existing.falseSource = merge(existing.falseSource, sourceName(pin(node, "False")));
      const output = node.pins.find((candidate) => candidate.direction === "output");
      existing.feeds = [...new Set([
        ...existing.feeds,
        ...(output?.links ?? []).map((link) => expressionName(graph.nodes.get(link.nodeId))),
      ])];
      return existing;
    }
    const output = node.pins.find((candidate) => candidate.direction === "output");
    const feeds = [...new Set((output?.links ?? []).map((link) => expressionName(graph.nodes.get(link.nodeId))))];
    const control: StaticSwitchControl = {
      ...identity,
      value: false,
      resolved: false,
      trueSource: sourceName(pin(node, "True")),
      falseSource: sourceName(pin(node, "False")),
      feeds,
      switchNodeIds: [node.id],
    };
    staticSwitches.set(control.id, control);
    return control;
  };

  const resolvingValues = new Set<string>();
  const resolveStaticValue = (node: GraphNode | undefined): boolean | undefined => {
    if (!node || resolvingValues.has(node.id)) return undefined;
    resolvingValues.add(node.id);
    let value: boolean | undefined;
    if (node.expressionClass === "MaterialExpressionStaticBool") {
      value = bool(pin(node, "Value")?.defaultValue);
    } else if (node.expressionClass === "MaterialExpressionStaticBoolParameter") {
      value = bool(node.properties.get("DefaultValue") ?? pin(node, "Default Value")?.defaultValue);
    } else if (node.kind === "function-input"
      && node.properties.get("InputType") === "FunctionInput_StaticBool"
      && node.properties.get("bUsePreviewValueAsDefault") === "True") {
      value = resolveStaticValue(linkedNode(pin(node, "Preview")));
    } else if (/MaterialExpression(?:Named)?Reroute(?:Declaration|Usage)?$/.test(node.expressionClass)) {
      value = resolveStaticValue(linkedNode(pin(node, "Input") ?? pin(node, "InputPin")));
    } else if (node.expressionClass === "MaterialExpressionShadingPathSwitch") {
      value = resolveStaticValue(linkedNode(pin(node, "Default")));
    } else if (staticSwitchClasses.has(node.expressionClass)) {
      const control = controlFor(node);
      const serialized = node.expressionClass === "MaterialExpressionStaticSwitchParameter"
        ? bool(node.properties.get("DefaultValue") ?? pin(node, "Default Value")?.defaultValue)
        : resolveStaticValue(linkedNode(pin(node, "Value")));
      control.resolved = serialized !== undefined;
      control.value = staticSwitchOverrides.get(control.id) ?? serialized ?? false;
      staticSwitchSelections.set(node.id, control.value);
      value = resolveStaticValue(linkedNode(pin(node, control.value ? "True" : "False")));
    }
    resolvingValues.delete(node.id);
    return value;
  };

  const selectStaticBranch = (node: GraphNode): GraphPin | undefined => {
    const control = controlFor(node);
    const serialized = node.expressionClass === "MaterialExpressionStaticSwitchParameter"
      ? bool(node.properties.get("DefaultValue") ?? pin(node, "Default Value")?.defaultValue)
      : resolveStaticValue(linkedNode(pin(node, "Value")));
    control.resolved = serialized !== undefined;
    control.value = staticSwitchOverrides.get(control.id) ?? serialized ?? false;
    staticSwitchSelections.set(node.id, control.value);
    if (!control.resolved && !staticSwitchOverrides.has(control.id)) {
      diagnostics.push({
        code: "unresolved-static-switch",
        severity: "warning",
        message: `${control.label} has no serialized value; False is shown until changed.`,
        line: node.startLine,
        nodeId: node.id,
      });
    }
    return pin(node, control.value ? "True" : "False");
  };

  const addExternal = (nodeId: string, pinId: string, name: string): void => {
    const id = `${nodeId}:${pinId}`;
    if (externalInputIds.has(id)) return;
    externalInputIds.add(id);
    externalInputs.push({ id, nodeId, pinId, name });
  };

  const visit = (nodeId: string): void => {
    if (visited.has(nodeId)) return;
    const node = graph.nodes.get(nodeId);
    if (!node) return;
    if (visiting.has(nodeId)) {
      diagnostics.push({
        code: "graph-cycle",
        severity: "error",
        message: `Cycle detected at ${nodeId}.`,
        line: node.startLine,
        nodeId,
      });
      return;
    }

    visiting.add(nodeId);
    if (node.kind !== "function-input") {
      const selectedStaticBranch = staticSwitchClasses.has(node.expressionClass)
        ? selectStaticBranch(node)
        : undefined;
      const inputs = selectedStaticBranch
        ? [selectedStaticBranch]
        : node.pins.filter((candidate) => candidate.direction === "input");
      for (const input of inputs) {
        const link = input.links[0];
        if (link && graph.nodes.has(link.nodeId)) visit(link.nodeId);
        else if (link || (input.category === "required" && input.defaultValue === undefined)) {
          addExternal(node.id, input.id, input.name);
        }
      }
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    orderedNodeIds.push(nodeId);
  };

  for (const output of outputs) {
    if (output.sourceNodeId) visit(output.sourceNodeId);
  }

  const order = new Map(orderedNodeIds.map((nodeId, index) => [nodeId, index]));
  const orderedStaticSwitches = [...staticSwitches.values()].sort((a, b) =>
    Math.min(...a.switchNodeIds.map((nodeId) => order.get(nodeId) ?? Number.MAX_SAFE_INTEGER))
    - Math.min(...b.switchNodeIds.map((nodeId) => order.get(nodeId) ?? Number.MAX_SAFE_INTEGER)),
  );

  return {
    outputId: outputIds.join(","),
    outputIds,
    nodeIds: visited,
    orderedNodeIds,
    externalInputs,
    staticSwitches: orderedStaticSwitches,
    staticSwitchSelections,
    diagnostics,
  };
}

export function sliceOutput(
  graph: MaterialGraph,
  outputId: string,
  staticSwitchOverrides: StaticSwitchOverrides = new Map(),
): GraphSlice {
  return sliceOutputs(graph, [outputId], staticSwitchOverrides);
}
