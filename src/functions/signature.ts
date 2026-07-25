import type { GraphNode, GraphPin, MaterialGraph } from "../graph/types";

export interface FunctionSignatureValue {
  id: string;
  name: string;
  index: number;
  pin?: GraphPin;
}

export interface FunctionSignature {
  inputs: FunctionSignatureValue[];
  outputs: FunctionSignatureValue[];
}

const pins = (node: GraphNode, direction: GraphPin["direction"]): GraphPin[] =>
  node.pins.filter((pin) => pin.direction === direction);

function indexedProperties(node: GraphNode, prefix: string): { index: number; value: string }[] {
  return [...node.properties]
    .flatMap(([key, value]) => {
      const index = key.match(new RegExp(`^${prefix}\\((\\d+)\\)$`))?.[1];
      return index === undefined ? [] : [{ index: Number(index), value }];
    })
    .sort((a, b) => a.index - b.index);
}

function serializedName(value: string, key: string, fallback: string): string {
  return value.match(new RegExp(`${key}="([^"]*)"`))?.[1]
    ?? value.match(new RegExp(`${key}=([^,)]+)`))?.[1]
    ?? fallback;
}

function callValues(
  node: GraphNode,
  property: "FunctionInputs" | "FunctionOutputs",
  idPattern: RegExp,
  nameKey: "InputName" | "OutputName",
  direction: GraphPin["direction"],
): FunctionSignatureValue[] {
  const availablePins = pins(node, direction);
  const usedPins = new Set<string>();
  return indexedProperties(node, property).map(({ index, value }) => {
    const name = serializedName(value, nameKey, `${direction === "input" ? "Input" : "Output"} ${index + 1}`);
    const namedPin = availablePins.find((pin) =>
      !usedPins.has(pin.id) && pin.name.toLowerCase() === name.toLowerCase());
    const pin = namedPin ?? availablePins[index];
    if (pin) usedPins.add(pin.id);
    return {
      id: value.match(idPattern)?.[1].toUpperCase() ?? "",
      name,
      index,
      pin,
    };
  });
}

export function callFunctionSignature(node: GraphNode): FunctionSignature {
  return {
    inputs: callValues(
      node,
      "FunctionInputs",
      /ExpressionInputId=([A-Fa-f0-9]{32})/,
      "InputName",
      "input",
    ),
    outputs: callValues(
      node,
      "FunctionOutputs",
      /ExpressionOutputId=([A-Fa-f0-9]{32})/,
      "OutputName",
      "output",
    ),
  };
}

export function definitionFunctionSignature(graph: MaterialGraph): FunctionSignature {
  const values = (
    kind: "function-input" | "function-output",
  ): FunctionSignatureValue[] =>
    [...graph.nodes.values()]
      .filter((node) => node.kind === kind)
      .map((node, index) => ({
        id: (node.properties.get("Id") ?? "").toUpperCase(),
        name: node.displayName ?? (kind === "function-input" ? `Input ${index + 1}` : `Output ${index + 1}`),
        index,
      }));
  return {
    inputs: values("function-input"),
    outputs: values("function-output"),
  };
}

export function orderedCallInputs(node: GraphNode): FunctionSignatureValue[] {
  const signature = callFunctionSignature(node).inputs;
  if (signature.length && signature.every(({ pin }) => pin)) return signature;
  return pins(node, "input").map((pin, index) => ({
    id: signature[index]?.id ?? "",
    name: signature[index]?.name ?? pin.name,
    index,
    pin,
  }));
}
