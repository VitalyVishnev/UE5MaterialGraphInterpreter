import type { ClipboardParseResult, Diagnostic, RawObject } from "../clipboard/raw-types";
import { inputDataOutputLabel, isTerminalExpression } from "./expression-semantics";
import { assignCommentRegions } from "./resolve-comment-regions";
import { connectNamedReroutes } from "./resolve-named-reroutes";
import type {
  GraphLink,
  GraphNode,
  GraphNodeKind,
  GraphOutput,
  GraphPin,
  MaterialGraph,
} from "./types";

function decodeValue(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  return value;
}

function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === quote && value[index - 1] !== "\\") quote = "";
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
    } else if (character === "," && depth === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}

function parsePin(raw: string): GraphPin | undefined {
  const match = raw.match(/^CustomProperties\s+Pin\s*\((.*)\)\s*$/);
  if (!match) return undefined;

  const fields = new Map<string, string>();
  for (const item of splitTopLevel(match[1])) {
    const separator = item.indexOf("=");
    if (separator > 0) fields.set(item.slice(0, separator).trim(), item.slice(separator + 1).trim());
  }

  const id = fields.get("PinId");
  if (!id) return undefined;
  const defaultValue = fields.get("DefaultValue");
  const links: GraphLink[] = [];
  const linkedTo = fields.get("LinkedTo") ?? "";
  for (const linked of linkedTo.matchAll(/([A-Za-z0-9_]+)\s+([A-Fa-f0-9]{32})/g)) {
    links.push({ nodeId: linked[1], pinId: linked[2] });
  }

  return {
    id,
    name: decodeValue(fields.get("PinName") ?? '"Unnamed"'),
    direction: fields.get("Direction")?.includes("EGPD_Output") ? "output" : "input",
    category: decodeValue(fields.get("PinType.PinCategory") ?? "") || undefined,
    subcategory: decodeValue(fields.get("PinType.PinSubCategory") ?? "") || undefined,
    defaultValue: defaultValue ? decodeValue(defaultValue) : undefined,
    links,
  };
}

function expressionDeclaration(object: RawObject): RawObject | undefined {
  return object.children.find((child) =>
    child.className?.startsWith("/Script/Engine.MaterialExpression"),
  );
}

function expressionClass(object: RawObject, declaration: RawObject | undefined): string {
  if (object.className?.includes("MaterialGraphNode_Root")) return "MaterialRoot";
  return declaration?.className?.split(".").at(-1) ?? "UnknownExpression";
}

function expressionProperties(object: RawObject, declaration: RawObject | undefined): Map<string, string> {
  const values = object.children.find(
    (child) => child !== declaration && child.name && child.name === declaration?.name,
  );
  const properties = new Map<string, string>();
  for (const property of values?.propertyList ?? declaration?.propertyList ?? []) {
    properties.set(property.key, decodeValue(property.value));
  }
  return properties;
}

function nodeKind(className: string): GraphNodeKind {
  if (className === "MaterialRoot") return "root";
  if (className === "MaterialExpressionFunctionInput") return "function-input";
  if (className === "MaterialExpressionFunctionOutput") return "function-output";
  if (className === "MaterialExpressionCustom") return "custom";
  if (className === "MaterialExpressionMaterialFunctionCall") return "external-call";
  if (className === "UnknownExpression") return "unknown";
  return "expression";
}

function conciseDescription(value: string | undefined): string | undefined {
  const text = value?.trim();
  if (!text || text.length > 48 || text.split(/\s+/).length > 6 || /[.!?;\r\n]/.test(text)) {
    return undefined;
  }
  return text;
}

function resolveNode(object: RawObject): GraphNode | undefined {
  if (!object.name || !object.className?.includes("MaterialGraphNode")) return undefined;
  const declaration = expressionDeclaration(object);
  const className = expressionClass(object, declaration);
  const properties = expressionProperties(object, declaration);
  const nodeComment = object.properties.get("NodeComment");
  const descriptiveName =
    conciseDescription(properties.get("Description")) ??
    conciseDescription(properties.get("Desc")) ??
    conciseDescription(nodeComment ? decodeValue(nodeComment.value) : undefined);
  const pins: GraphPin[] = [];
  for (const property of object.propertyList) {
    const pin = parsePin(property.raw);
    if (pin) pins.push(pin);
  }
  return {
    id: object.name,
    nodeGuid: object.properties.get("NodeGuid")?.value,
    expressionClass: className,
    kind: nodeKind(className),
    properties,
    pins,
    startLine: object.startLine,
    displayName:
      properties.get("InputName") ??
      properties.get("OutputName") ??
      properties.get("ParameterName") ??
      descriptiveName,
  };
}

function connectedOutputs(nodes: ReadonlyMap<string, GraphNode>): GraphOutput[] {
  const outputs: GraphOutput[] = [];
  for (const node of nodes.values()) {
    const terminal = isTerminalExpression(node);
    if (node.kind !== "root" && node.kind !== "function-output" && !terminal) continue;
    for (const pin of node.pins) {
      if (pin.direction !== "input" || pin.links.length === 0) continue;
      const source = pin.links[0];
      outputs.push({
        id: `${node.id}:${pin.id}`,
        label: node.kind === "function-output"
          ? (node.displayName ?? "Result")
          : terminal
            ? `${node.expressionClass.replace(/^MaterialExpression/, "")}.${pin.name}`
            : pin.name,
        ownerNodeId: node.id,
        ownerPinId: pin.id,
        sourceNodeId: source.nodeId,
        sourcePinId: source.pinId,
      });
    }
  }
  return outputs;
}

function terminalOutputs(nodes: ReadonlyMap<string, GraphNode>): GraphOutput[] {
  const outputs: GraphOutput[] = [];
  const candidates = [...nodes.values()].flatMap((node) => {
    const outputPins = node.pins.filter((pin) => pin.direction === "output");
    const hasKnownConsumer = outputPins.some((pin) => pin.links.some((link) => nodes.has(link.nodeId)));
    return outputPins
      .filter((pin) => !pin.links.some((link) => nodes.has(link.nodeId)))
      .filter((pin) => pin.links.length > 0 || !hasKnownConsumer)
      .map((pin) => ({ node, pin }));
  });
  const hasBoundaryOutputs = candidates.some(({ pin }) => pin.links.length > 0);
  for (const { node, pin } of candidates) {
    if (hasBoundaryOutputs && pin.links.length === 0) continue;
    const outputPins = node.pins.filter((pin) => pin.direction === "output");
    const expressionName = node.expressionClass.replace(/^MaterialExpression/, "");
    const mask = node.expressionClass === "MaterialExpressionComponentMask"
      ? ["R", "G", "B", "A"].filter((channel) => node.properties.get(channel) === "True").join("")
      : "";
    const semanticOutput = inputDataOutputLabel(node, pin);
    const structuralLabel = /^Output\d*$/.test(pin.name) && semanticOutput
      ? `${expressionName}.${semanticOutput}`
      : pin.name === "Output"
      ? `${expressionName}${mask ? `.${mask}` : ""}`
      : outputPins.length > 1
        ? `${expressionName}.${pin.name}`
        : pin.name;
    outputs.push({
      id: `${node.id}:${pin.id}`,
      label: node.displayName ?? structuralLabel,
      ownerNodeId: node.id,
      ownerPinId: pin.id,
      sourceNodeId: node.id,
      sourcePinId: pin.id,
    });
  }
  return outputs;
}

export function resolveGraph(parsed: ClipboardParseResult): MaterialGraph {
  const nodes = new Map<string, GraphNode>();
  for (const object of parsed.objects) {
    const node = resolveNode(object);
    if (node) nodes.set(node.id, node);
  }
  assignCommentRegions(nodes);

  const diagnostics: Diagnostic[] = [...parsed.diagnostics, ...connectNamedReroutes(nodes)];
  const pinIdsByNode = new Map(
    [...nodes].map(([nodeId, node]) => [nodeId, new Set(node.pins.map((pin) => pin.id))]),
  );
  for (const node of nodes.values()) {
    for (const pin of node.pins) {
      if (pin.direction === "output") continue;
      for (const link of pin.links) {
        if (!pinIdsByNode.get(link.nodeId)?.has(link.pinId)) {
          const nodeLabel = node.displayName ?? node.expressionClass.replace(/^MaterialExpression/, "");
          diagnostics.push({
            code: "unresolved-link",
            severity: "warning",
            message: `Input "${pin.name}" on ${nodeLabel} comes from outside this clipboard selection.`,
            line: node.startLine,
            nodeId: node.id,
          });
        }
      }
    }
  }

  const outputs = connectedOutputs(nodes);
  return {
    nodes,
    outputs: outputs.length > 0 ? outputs : terminalOutputs(nodes),
    diagnostics,
  };
}
