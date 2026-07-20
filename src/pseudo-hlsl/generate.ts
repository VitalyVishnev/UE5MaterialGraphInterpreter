import type { Diagnostic } from "../clipboard/raw-types";
import {
  advancedExpression,
  fixedExpressionOutputType,
  inputDataExpression,
  knownMaterialFunctionOutputType,
  mathExpression,
  mathInputDefault,
  mathInputNames,
  proceduralNoiseExpression,
} from "../graph/expression-semantics";
import { inferTypes } from "../graph/infer-types";
import {
  castNumericFamily,
  declaredFunctionInputType,
  isNumericType,
  promoteNumericTypes,
  type MaterialType,
} from "../graph/material-types";
import {
  sliceOutputs,
  type StaticSwitchControl,
  type StaticSwitchOverrides,
} from "../graph/slice";
import type {
  GraphCommentRegion,
  GraphNode,
  GraphOutput,
  GraphPin,
  MaterialGraph,
} from "../graph/types";

export interface PseudoHlslResult {
  code: string;
  diagnostics: Diagnostic[];
  typeOverrideGroups: TypeOverrideGroup[];
  staticSwitches: StaticSwitchControl[];
  editableSymbols: EditableSymbol[];
}

export interface EditableSymbol {
  id: string;
  name: string;
  typeOverrideId?: string;
}

export interface TypeOverrideValue {
  id: string;
  name: string;
  type?: MaterialType;
  status: "inferred" | "minimum" | "unknown" | "overridden";
}

export interface TypeOverrideGroup {
  id: string;
  name: string;
  kind: "external-function" | "custom-node";
  values: TypeOverrideValue[];
}

export type TypeOverrides = ReadonlyMap<string, MaterialType>;
export type NameOverrides = ReadonlyMap<string, string>;

export interface PseudoHlslOptions {
  bundleFormat: "readable" | "strict";
  commentSections: boolean;
  expandCustomNodes: boolean;
  multilineCalls: boolean;
  spaceComplexOperations: boolean;
  simplifyAlgebra: boolean;
}

export const defaultPseudoHlslOptions: PseudoHlslOptions = {
  bundleFormat: "readable",
  commentSections: true,
  expandCustomNodes: false,
  multilineCalls: true,
  spaceComplexOperations: true,
  simplifyAlgebra: false,
};

interface Value {
  code: string;
  type: string;
  confidence?: "confirmed" | "inferred" | "minimum";
  opaque?: boolean;
  call?: { name: string; args: string[]; suffix?: string };
  operation?: { operator: string; left: string; right: string };
}

interface Declaration {
  code: string;
  commentRegions?: readonly GraphCommentRegion[];
  namedByCommentRegionId?: string;
  preamble?: boolean;
  spaced?: boolean;
  output?: boolean;
}

const maxInlineExpressionLength = 100;
const textureEnumNames = new Set(["mipvaluemode", "sampler source", "sampler type"]);
const reservedIdentifiers = new Set([
  "bool", "break", "case", "continue", "default", "do", "else", "false", "float",
  "for", "if", "int", "return", "struct", "switch", "true", "uint", "void", "while",
]);

function renderedType(value: Value | undefined): string {
  if (!value || value.type === "unknown") return "?type";
  if (value.confidence === "minimum") return `?${value.type}+`;
  return value.confidence === "inferred" ? `?${value.type}` : value.type;
}

function identifier(value: string): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "") || "value";
  const safe = reservedIdentifiers.has(cleaned) ? `${cleaned}Value` : cleaned;
  return /^[0-9]/.test(safe) ? `_${safe}` : safe;
}

function pinIdentifier(value: string): string {
  return identifier(value
    .replace(/==/g, " Equal ")
    .replace(/>/g, " Greater ")
    .replace(/</g, " Less "));
}

function number(value: string | undefined, fallback = "0.0"): string {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (Number.isInteger(parsed)) return `${parsed.toFixed(1)}`;
  return String(parsed);
}

function literal(value: string): string {
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return number(value);
  if (/^(?:true|false)$/i.test(value)) return value.toLowerCase();
  if (/^(?:True|False)$/.test(value)) return value === "True" ? "true" : "false";
  return identifier(value);
}

function vector(value: string | undefined, size: 3 | 4): string {
  const channels = ["R", "G", "B", "A"];
  const values = channels.slice(0, size).map((channel) => {
    const match = value?.match(new RegExp(`${channel}=(-?\\d+(?:\\.\\d+)?)`));
    return number(match?.[1]);
  });
  return `float${size}(${values.join(", ")})`;
}

function classShortName(className: string): string {
  return className.replace(/^MaterialExpression/, "") || className;
}

function materialFunctionName(target: string): string {
  const path = target.match(/"([^"]+)"/)?.[1] ?? target;
  const asset = path.split("/").at(-1) ?? path;
  return identifier(asset.split(".").at(-1) ?? asset);
}

const inputPins = (node: GraphNode): GraphPin[] =>
  node.pins.filter((pin) => pin.direction === "input");

const outputPins = (node: GraphNode): GraphPin[] =>
  node.pins.filter((pin) => pin.direction === "output");

function pinByName(node: GraphNode, ...names: string[]): GraphPin | undefined {
  const wanted = names.map((name) => name.toLowerCase());
  return inputPins(node).find((pin) => wanted.includes(pin.name.toLowerCase()));
}

function outputKey(nodeId: string, pinId: string): string {
  return `${nodeId}:${pinId}`;
}

function functionOutputId(target: string, outputIndex: number): string {
  return `${target}::${outputIndex}`;
}

function customInputId(node: GraphNode, pin: GraphPin): string {
  return `CustomNode:${node.id}::input:${pin.id}`;
}

function customInputPins(node: GraphNode): GraphPin[] {
  const declaredNames = new Set(
    [...node.properties]
      .filter(([key]) => /^Inputs\(\d+\)$/.test(key))
      .flatMap(([, value]) => value.match(/InputName="?([^",)]+)/)?.[1] ?? []),
  );
  return inputPins(node).filter((pin) => declaredNames.has(pin.name));
}

function nodeBaseName(node: GraphNode): string {
  if (node.displayName) return identifier(node.displayName);
  if (node.expressionClass === "MaterialExpressionMaterialFunctionCall") {
    const name = materialFunctionName(
      node.properties.get("MaterialFunction") ?? "materialFunction",
    );
    return name[0].toLowerCase() + name.slice(1);
  }
  const short = classShortName(node.expressionClass);
  return identifier(short[0].toLowerCase() + short.slice(1));
}

function lowerCamelIdentifier(value: string): string {
  const compact = identifier(value).replace(/_+([A-Za-z0-9])/g, (_, character: string) =>
    character.toUpperCase());
  const camel = compact.replace(/^[A-Z]+(?=[A-Z][a-z]|[0-9]|$)/, (prefix) => prefix.toLowerCase());
  return camel[0].toLowerCase() + camel.slice(1);
}

function externalResultBaseName(node: GraphNode, pin: GraphPin): string {
  if (isGenericResultName(pin.name)) {
    return nodeBaseName(node);
  }
  return lowerCamelIdentifier(pin.name);
}

function isGenericResultName(value: string): boolean {
  return /^(?:output|result|return value)(?:\s*\d+)?$/i.test(value.trim());
}

function authoredIdentifier(value: string | undefined): string | undefined {
  const name = value?.trim().replace(/^\/\/\s*/, "");
  return name && /^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(name) ? name : undefined;
}

function authoredName(node: GraphNode): string | undefined {
  return authoredIdentifier(node.displayName);
}

function vectorPin(value: string, pin: GraphPin): Value {
  const swizzle = ({ red: "r", green: "g", blue: "b", alpha: "a" } as const)[
    pin.subcategory as "red" | "green" | "blue" | "alpha"
  ];
  if (swizzle) return { code: `${value}.${swizzle}`, type: "float" };
  return { code: value, type: "float3" };
}

function combinedType(a: Value, b: Value): string {
  return isNumericType(a.type) && isNumericType(b.type)
    ? promoteNumericTypes(a.type, b.type) ?? "unknown"
    : "unknown";
}

function numericFamilyCast(type: string, family: "float" | "uint"): string {
  return isNumericType(type) ? castNumericFamily(type, family) : "unknown";
}

function callValue(name: string, args: string[], type: string, opaque = false): Value {
  return {
    code: `${name}(${args.join(", ")})`,
    type,
    opaque,
    call: { name, args },
  };
}

function operationValue(
  operator: string,
  left: Value,
  right: Value,
  type: string,
  simplify = false,
): Value {
  if (simplify) {
    const literal = (value: Value): number | undefined =>
      /^-?\d+(?:\.\d+)?$/.test(value.code) && Number.isFinite(Number(value.code))
        ? Number(value.code)
        : undefined;
    const a = literal(left);
    const b = literal(right);
    if (a !== undefined && b !== undefined && ["+", "-", "*", "/"].includes(operator) && !(operator === "/" && b === 0)) {
      const folded = operator === "+" ? a + b : operator === "-" ? a - b : operator === "*" ? a * b : a / b;
      if (Number.isFinite(folded)) return { code: number(String(Math.fround(folded))), type };
    }
    if ((operator === "+" && a === 0) || (operator === "*" && a === 1)) return { ...right, type };
    if ((operator === "+" || operator === "-") && b === 0 || (operator === "*" || operator === "/") && b === 1) {
      return { ...left, type };
    }
  }
  return {
    code: `(${left.code} ${operator} ${right.code})`,
    type,
    operation: { operator, left: left.code, right: right.code },
  };
}

function isComplexValue(value: Value): boolean {
  if (value.call && value.call.args.length >= 3) return true;
  if (!value.operation || value.code.length <= 80) return false;
  const calls = `${value.operation.left} ${value.operation.right}`.match(/[A-Za-z_]\w*\(/g);
  return (calls?.length ?? 0) >= 2;
}

function assignment(type: string, name: string, value: Value, multilineCalls: boolean): string {
  if (multilineCalls && isComplexValue(value) && value.operation) {
    return `${type} ${name} = (\n    ${value.operation.left}\n    ${value.operation.operator} ${value.operation.right}\n);`;
  }
  if (!multilineCalls || !value.call || value.call.args.length <= 2) {
    return `${type} ${name} = ${value.code};`;
  }
  const args = value.call.args.map(
    (argument, index) => `    ${argument}${index < value.call!.args.length - 1 ? "," : ""}`,
  );
  return `${type} ${name} = ${value.call.name}(\n${args.join("\n")}\n)${value.call.suffix ?? ""};`;
}

function callStatement(name: string, args: string[], multiline: boolean): string {
  if (!multiline || args.length <= 2) return `${name}(${args.join(", ")});`;
  const lines = args.map((argument, index) =>
    `    ${argument}${index < args.length - 1 ? "," : ""}`);
  return `${name}(\n${lines.join("\n")}\n);`;
}

function meaningfulInputPin(pin: GraphPin): boolean {
  return pin.direction === "input" && (
    pin.links.length > 0
    || pin.defaultValue !== undefined
    || pin.category === "required"
    || /^(?:MipValue|DDX|DDY|CoordinatesD[XY]|Derivative[XY])(?:\b|_)/i.test(pin.name)
  );
}

type TextureEnumSetting = "MipValueMode" | "Sampler_Source" | "Sampler_Type";

function textureEnumSetting(value: string): TextureEnumSetting | undefined {
  if (/^(?:none .*computed mip|mip ?level|mip ?bias|derivative)/i.test(value)) {
    return "MipValueMode";
  }
  if (/^(?:from texture asset|shared:? (?:wrap|clamp)|external)$/i.test(value)) {
    return "Sampler_Source";
  }
  if (/^(?:color|grayscale|alpha|normal|masks|distance field font|linear color|linear grayscale|data)$/i.test(value)) {
    return "Sampler_Type";
  }
  return undefined;
}

function renderDeclarations(declarations: Declaration[]): string[] {
  const lines: string[] = [];
  const preamble = declarations.filter((declaration) => declaration.preamble);
  const body = declarations.filter((declaration) => !declaration.preamble);
  lines.push(...preamble.map((declaration) => declaration.code));
  if (preamble.length > 0 && body.length > 0) lines.push("");
  const regionCounts = new Map<string, number>();
  for (const declaration of body) {
    for (const region of declaration.commentRegions ?? []) {
      regionCounts.set(region.id, (regionCounts.get(region.id) ?? 0) + 1);
    }
  }
  let activeLargeRegions: readonly GraphCommentRegion[] = [];
  let outputsStarted = false;
  const separator = "//---------------------------------------------------";
  for (const declaration of body) {
    if (declaration.output && !outputsStarted) {
      if (lines.length > 0 && lines.at(-1) !== "") lines.push("");
      outputsStarted = true;
    }
    const largeRegions = (declaration.commentRegions ?? []).filter(
      (region) => (regionCounts.get(region.id) ?? 0) > 1,
    );
    let sharedDepth = 0;
    while (sharedDepth < activeLargeRegions.length
      && sharedDepth < largeRegions.length
      && activeLargeRegions[sharedDepth].id === largeRegions[sharedDepth].id) sharedDepth += 1;
    for (const region of largeRegions.slice(sharedDepth)) {
      if (lines.length > 0 && lines.at(-1) !== "") lines.push("");
      lines.push(separator, `// ${region.text}`, separator);
    }
    activeLargeRegions = largeRegions;
    if (declaration.spaced && lines.length > 0 && lines.at(-1) !== "") lines.push("");
    const localRegion = [...(declaration.commentRegions ?? [])].reverse().find(
      (region) => (regionCounts.get(region.id) ?? 0) === 1
        && region.id !== declaration.namedByCommentRegionId,
    );
    if (localRegion) lines.push(`// ${localRegion.text}`);
    lines.push(declaration.code);
    if (declaration.spaced) lines.push("");
  }
  return lines;
}

function generatePseudoHlslForOutputs(
  graph: MaterialGraph,
  outputs: GraphOutput[],
  overrides: TypeOverrides = new Map(),
  options: PseudoHlslOptions = defaultPseudoHlslOptions,
  staticSwitchOverrides: StaticSwitchOverrides = new Map(),
  nameOverrides: NameOverrides = new Map(),
): PseudoHlslResult {
  if (outputs.length === 0) throw new Error("At least one graph output is required.");
  const slice = sliceOutputs(graph, outputs.map((output) => output.id), staticSwitchOverrides);
  const orderedNodes = slice.orderedNodeIds.map((nodeId) => graph.nodes.get(nodeId)!);
  const commentRegionNodeCounts = new Map<string, number>();
  for (const node of graph.nodes.values()) {
    if (node.expressionClass === "MaterialExpressionComment") continue;
    for (const region of node.commentRegions ?? []) {
      commentRegionNodeCounts.set(region.id, (commentRegionNodeCounts.get(region.id) ?? 0) + 1);
    }
  }
  const localCommentRegion = (node: GraphNode): GraphCommentRegion | undefined =>
    options.commentSections
      ? [...(node.commentRegions ?? [])].reverse().find(
          (region) => commentRegionNodeCounts.get(region.id) === 1,
        )
      : undefined;
  const customNodeNames = new Map<string, string>();
  let customNodeIndex = 0;
  for (const node of orderedNodes) {
    if (node.kind === "custom") {
      customNodeNames.set(node.id, node.displayName ?? `Custom Node ${++customNodeIndex}`);
    }
  }
  const valueOverrides = new Map<string, MaterialType>();
  for (const node of orderedNodes) {
    if (node.kind === "external-call") {
      const target = node.properties.get("MaterialFunction") ?? "UnresolvedMaterialFunction";
      outputPins(node).forEach((pin, index) => {
        const override = overrides.get(functionOutputId(target, index));
        if (override) valueOverrides.set(outputKey(node.id, pin.id), override);
      });
    }
    if (node.kind === "custom") {
      for (const pin of customInputPins(node)) {
        const override = overrides.get(customInputId(node, pin));
        const link = pin.links[0];
        if (override && link) valueOverrides.set(outputKey(link.nodeId, link.pinId), override);
      }
    }
  }
  const typeInference = inferTypes(graph, slice, valueOverrides);
  const diagnostics: Diagnostic[] = [
    ...graph.diagnostics,
    ...slice.diagnostics,
    ...typeInference.diagnostics,
  ];
  const values = new Map<string, Value>();
  const declarations: Declaration[] = [];
  const functionInputSymbols = new Set<string>();
  const usedNames = new Set<string>();
  const editableSymbols = new Map<string, EditableSymbol>();

  const uniqueName = (preferred: string): string => {
    let candidate = preferred;
    let index = 2;
    while (usedNames.has(candidate)) candidate = `${preferred}_${index++}`;
    usedNames.add(candidate);
    return candidate;
  };

  const symbolId = (node: GraphNode, pin: GraphPin): string =>
    `Node:${node.nodeGuid ?? node.properties.get("MaterialExpressionGuid") ?? node.id}:Output:${pin.id}`;
  const preferredName = (node: GraphNode, pin: GraphPin, fallback: string): string =>
    nameOverrides.get(symbolId(node, pin)) ?? fallback;
  const externalTypeOverrideId = (node: GraphNode, pin: GraphPin): string | undefined => {
    if (node.kind !== "external-call") return undefined;
    const index = outputPins(node).findIndex((candidate) => candidate.id === pin.id);
    if (index < 0) return undefined;
    return functionOutputId(node.properties.get("MaterialFunction") ?? "UnresolvedMaterialFunction", index);
  };
  const registerSymbol = (node: GraphNode, pin: GraphPin, name: string): void => {
    const id = symbolId(node, pin);
    editableSymbols.set(id, {
      id,
      name,
      typeOverrideId: externalTypeOverrideId(node, pin),
    });
  };

  const linkedValue = (node: GraphNode, pin: GraphPin | undefined, fallbackProperty?: string): Value => {
    const link = pin?.links[0];
    if (link) {
      const value = values.get(outputKey(link.nodeId, link.pinId));
      if (value) return value;
      return { code: identifier(`external_${link.nodeId}_${pinIdentifier(pin?.name ?? "input")}`), type: "unknown" };
    }
    const fallback = (fallbackProperty ? node.properties.get(fallbackProperty) : undefined)
      ?? pin?.defaultValue;
    if (fallback !== undefined) return { code: literal(fallback), type: "float" };
    return { code: identifier(`external_${node.id}_${pinIdentifier(pin?.name ?? "input")}`), type: "unknown" };
  };

  const input = (node: GraphNode, names: readonly string[], fallbackProperty?: string): Value =>
    linkedValue(node, pinByName(node, ...names), fallbackProperty);

  const periodicArgument = (node: GraphNode): Value => {
    const value = input(node, ["Input"]);
    const periodPin = pinByName(node, "Period");
    const serializedPeriod = node.properties.get("Period") ?? periodPin?.defaultValue;
    const hasCustomPeriod = Boolean(periodPin?.links.length)
      || (serializedPeriod !== undefined && Number(serializedPeriod) !== 1);
    if (!hasCustomPeriod) return value;
    const period = linkedValue(node, periodPin, "Period");
    return { code: `(${value.code} / ${period.code})`, type: value.type };
  };

  const translate = (node: GraphNode, sourcePin: GraphPin): Value => {
    const className = node.expressionClass;
    const short = classShortName(className);
    switch (className) {
      case "MaterialExpressionConstant":
        return { code: number(node.properties.get("R")), type: "float" };
      case "MaterialExpressionConstant2Vector": {
        const x = input(node, ["X"]);
        const y = input(node, ["Y"]);
        const value = `float2(${x.code}, ${y.code})`;
        return vectorPin(value, sourcePin);
      }
      case "MaterialExpressionConstant3Vector":
        return vectorPin(vector(node.properties.get("Constant") ?? pinByName(node, "Constant")?.defaultValue, 3), sourcePin);
      case "MaterialExpressionConstant4Vector": {
        const value = vector(node.properties.get("Constant") ?? pinByName(node, "Constant")?.defaultValue, 4);
        const selector = sourcePin.name === "RGB" ? ".rgb" : ({ red: ".r", green: ".g", blue: ".b", alpha: ".a" } as const)[sourcePin.subcategory as "red" | "green" | "blue" | "alpha"] ?? "";
        const type = selector === ".rgb" ? "float3" : selector ? "float" : "float4";
        return { code: `${value}${selector}`, type };
      }
      case "MaterialExpressionConstantDouble":
        return { code: input(node, ["Value"]).code, type: "float" };
      case "MaterialExpressionScalarParameter":
        return {
          code: node.properties.get("bUseCustomPrimitiveData") === "True"
            ? `CustomPrimitiveData(${identifier(node.displayName ?? node.id)})`
            : number(node.properties.get("DefaultValue")),
          type: "float",
        };
      case "MaterialExpressionVectorParameter": {
        const value = node.properties.get("bUseCustomPrimitiveData") === "True"
          ? `CustomPrimitiveData4(${identifier(node.displayName ?? node.id)})`
          : vector(node.properties.get("DefaultValue"), 4);
        const selector = sourcePin.name === "RGB" ? ".rgb" : sourcePin.name === "RGBA" ? "" : ({ R: ".r", G: ".g", B: ".b", A: ".a" } as const)[sourcePin.name as "R" | "G" | "B" | "A"] ?? "";
        return { code: `${value}${selector}`, type: fixedExpressionOutputType(node, sourcePin) ?? "float4" };
      }
      case "MaterialExpressionFunctionInput":
        return {
          code: identifier(node.displayName ?? node.id),
          type: declaredFunctionInputType(node.properties.get("InputType")) ?? "unknown",
        };
      case "MaterialExpressionStaticSwitch":
      case "MaterialExpressionStaticSwitchParameter":
        return input(node, [slice.staticSwitchSelections.get(node.id) ? "True" : "False"]);
      case "MaterialExpressionReroute":
      case "MaterialExpressionNamedRerouteDeclaration":
      case "MaterialExpressionNamedRerouteUsage":
      case "MaterialExpressionFunctionOutput":
        return input(node, ["Input", "InputPin", "A"]);
      case "MaterialExpressionOneMinus": {
        const value = input(node, ["Input"]);
        return { code: `(1.0 - ${value.code})`, type: value.type };
      }
      case "MaterialExpressionCosine": {
        const value = periodicArgument(node);
        return { code: `cos(${value.code})`, type: value.type };
      }
      case "MaterialExpressionSine": {
        const value = periodicArgument(node);
        return { code: `sin(${value.code})`, type: value.type };
      }
      case "MaterialExpressionTangent": {
        const value = periodicArgument(node);
        return { code: `tan(${value.code})`, type: value.type };
      }
      case "MaterialExpressionClamp": {
        const value = input(node, ["Input"]);
        const min = input(node, ["Min"], "MinDefault");
        const max = input(node, ["Max"], "MaxDefault");
        const mode = node.properties.get("ClampMode") ?? pinByName(node, "Clamp Mode")?.defaultValue ?? "Clamp";
        if (/Min/i.test(mode) && !/Max/i.test(mode)) return callValue("max", [value.code, min.code], value.type);
        if (/Max/i.test(mode) && !/Min/i.test(mode)) return callValue("min", [value.code, max.code], value.type);
        return callValue("clamp", [value.code, min.code, max.code], value.type);
      }
      case "MaterialExpressionComponentMask": {
        const value = input(node, ["Input"]);
        const mask = ["R", "G", "B", "A"].filter((channel) => node.properties.get(channel) === "True").join("").toLowerCase();
        return {
          code: mask ? `${value.code}.${mask}` : value.code,
          type: mask.length <= 1 ? "float" : `float${mask.length}`,
        };
      }
      case "MaterialExpressionAppendVector": {
        const a = input(node, ["A"]);
        const b = input(node, ["B"]);
        const size = (value: Value): number | undefined =>
          value.type === "float" ? 1 : Number(value.type.match(/^float([2-4])$/)?.[1]) || undefined;
        const total = (size(a) ?? 0) + (size(b) ?? 0);
        return total >= 2 && total <= 4
          ? { code: `float${total}(${a.code}, ${b.code})`, type: `float${total}` }
          : { code: `Append(${a.code}, ${b.code})`, type: "unknown" };
      }
      case "MaterialExpressionDesaturation": {
        const value = input(node, ["Input"]);
        const fraction = input(node, ["Fraction"], "Fraction");
        return { code: `Desaturate(${value.code}, ${fraction.code})`, type: value.type };
      }
      case "MaterialExpressionTime":
        return { code: "Time", type: "float" };
      case "MaterialExpressionScreenPosition":
        return { code: `ScreenPosition().${identifier(sourcePin.name)}`, type: "float2" };
      case "MaterialExpressionWorldPosition": {
        const suffix = sourcePin.name === "XY" ? ".xy" : sourcePin.name === "Z" ? ".z" : "";
        return { code: `WorldPosition()${suffix}`, type: sourcePin.name === "XY" ? "float2" : sourcePin.name === "Z" ? "float" : "float3" };
      }
      case "MaterialExpressionLocalPosition": {
        const suffix = sourcePin.name === "XY" ? ".xy" : sourcePin.name === "Z" ? ".z" : "";
        return { code: `LocalPosition()${suffix}`, type: sourcePin.name === "XY" ? "float2" : sourcePin.name === "Z" ? "float" : "float3" };
      }
      case "MaterialExpressionVertexNormalWS":
        return { code: "VertexNormalWS()", type: "float3" };
      case "MaterialExpressionPreSkinnedNormal":
        return { code: "PreSkinnedNormal()", type: "float3" };
      case "MaterialExpressionLength": {
        const value = input(node, ["Input"]);
        return { code: `length(${value.code})`, type: "float" };
      }
      case "MaterialExpressionDistance": {
        const a = input(node, ["A"]);
        const b = input(node, ["B"]);
        return callValue("distance", [a.code, b.code], "float");
      }
      case "MaterialExpressionConstantBiasScale": {
        const value = input(node, ["Input"]);
        const bias = input(node, ["Bias"]);
        const scale = input(node, ["Scale"]);
        const biased = operationValue("+", value, bias, combinedType(value, bias), options.simplifyAlgebra);
        return operationValue("*", biased, scale, combinedType(biased, scale), options.simplifyAlgebra);
      }
      case "MaterialExpressionDDX":
      case "MaterialExpressionDDY": {
        const value = input(node, ["Value"]);
        return { code: `${className === "MaterialExpressionDDX" ? "ddx" : "ddy"}(${value.code})`, type: value.type };
      }
      case "MaterialExpressionVertexInterpolator": {
        const value = input(node, ["VS", "Input"]);
        return callValue("VertexInterpolator", [value.code], value.type);
      }
      case "MaterialExpressionShaderStageSwitch": {
        const pixel = input(node, ["PixelShader"]);
        const vertex = input(node, ["VertexShader"]);
        return callValue("ShaderStageSwitch", [pixel.code, vertex.code], combinedType(pixel, vertex));
      }
      case "MaterialExpressionTransform": {
        const value = input(node, ["Input"]);
        const coordinateSpace = (property: string, pinName: string): string | undefined => {
          const raw = node.properties.get(property) ?? pinByName(node, pinName)?.defaultValue;
          return raw
            ? identifier(raw.replace(/^TRANSFORMSOURCE_|^TRANSFORM_/, "").replace(/\s+Space$/i, ""))
            : undefined;
        };
        const source = coordinateSpace("TransformSourceType", "Source");
        const destination = coordinateSpace("TransformType", "Destination");
        const args = [value.code, source, destination].filter((item): item is string => Boolean(item));
        return callValue("Transform", args, "float3");
      }
      case "MaterialExpressionConvert": {
        const args = inputPins(node).map((pin) => linkedValue(node, pin).code);
        return callValue("Convert", args, "unknown");
      }
      case "MaterialExpressionSceneTexture": {
        const uv = pinByName(node, "UVs")?.links.length ? input(node, ["UVs"]).code : undefined;
        const id = node.properties.get("SceneTextureId") ?? "UnknownSceneTexture";
        const call = uv ? `SceneTexture(${id}, ${uv})` : `SceneTexture(${id})`;
        if (sourcePin.name === "Size") return { code: `${call}.Size`, type: "float2" };
        if (sourcePin.name === "InvSize") return { code: `${call}.InvSize`, type: "float2" };
        return { code: call, type: "float4" };
      }
      case "MaterialExpressionTextureObject":
      case "MaterialExpressionTextureObjectParameter": {
        const semantics = advancedExpression(className)!;
        const args: string[] = [];
        const parameter = node.properties.get("ParameterName");
        const texture = node.properties.get("Texture");
        if (parameter) args.push(`Parameter: ${identifier(parameter)}`);
        if (texture && texture !== "None") args.push(`Texture: ${identifier(texture)}`);
        return callValue(semantics.token, args, fixedExpressionOutputType(node, sourcePin) ?? "unknown");
      }
      case "MaterialExpressionCollectionParameter": {
        const collection = materialFunctionName(node.properties.get("Collection") ?? "Collection");
        const parameter = identifier(node.properties.get("ParameterName") ?? "Parameter");
        return callValue(
          "CollectionParameter",
          [`Collection: ${collection}`, `Parameter: ${parameter}`],
          "unknown",
        );
      }
      case "MaterialExpressionTextureSample":
      case "MaterialExpressionTextureSampleParameter2D":
      case "MaterialExpressionTextureSampleParameter2DArray":
      case "MaterialExpressionTextureSampleParameterCube":
      case "MaterialExpressionTextureSampleParameterCubeArray":
      case "MaterialExpressionTextureSampleParameterSubUV":
      case "MaterialExpressionTextureSampleParameterVolume":
      case "MaterialExpressionSparseVolumeTextureSample":
      case "MaterialExpressionSparseVolumeTextureSampleParameter":
      case "MaterialExpressionParticleSubUV": {
        const semantics = advancedExpression(className)!;
        const inputPins = node.pins.filter(meaningfulInputPin);
        const settings = inputPins
          .filter((pin) => !textureEnumNames.has(pin.name.toLowerCase()))
          .map((pin) => `${pinIdentifier(pin.name)}: ${linkedValue(node, pin).code}`);
        const enumSettings = new Map<TextureEnumSetting, string>();
        for (const pin of inputPins.filter((item) => textureEnumNames.has(item.name.toLowerCase()))) {
          if (pin.links.length > 0 || pin.defaultValue === undefined) {
            settings.push(`${pinIdentifier(pin.name)}: ${linkedValue(node, pin).code}`);
            continue;
          }
          const setting = textureEnumSetting(pin.defaultValue);
          if (setting && !enumSettings.has(setting)) enumSettings.set(setting, literal(pin.defaultValue));
        }
        for (const setting of ["MipValueMode", "Sampler_Source", "Sampler_Type"] as const) {
          const value = enumSettings.get(setting);
          if (value) settings.push(`${setting}: ${value}`);
        }
        const texture = node.properties.get("ParameterName") ?? node.properties.get("Texture");
        if (texture) settings.unshift(`Texture: ${identifier(texture)}`);
        const outputs = outputPins(node);
        const outputName = /^(?:R|G|B|A|RG|RGB|RGBA)$/i.test(sourcePin.name)
          ? sourcePin.name.toLowerCase()
          : pinIdentifier(sourcePin.name);
        const field = outputs.length > 1 ? `.${outputName}` : "";
        const value = callValue(semantics.token, settings, fixedExpressionOutputType(node, sourcePin) ?? "unknown");
        return {
          ...value,
          code: `${value.code}${field}`,
          call: field ? { ...value.call!, suffix: field } : value.call,
        };
      }
      case "MaterialExpressionCustom": {
        const inputs = customInputPins(node).map((pin) => {
          const value = linkedValue(node, pin);
          const override = overrides.get(customInputId(node, pin));
          return {
            pin,
            value: override ? { ...value, type: override, confidence: "confirmed" as const } : value,
          };
        });
        const customName = customNodeNames.get(node.id) ?? "Custom Node";
        const body = node.properties.get("Code")?.trim();
        if (options.expandCustomNodes && body) {
          const inputBindings = inputs.map(({ pin, value }) =>
            `    ${renderedType(value)} ${identifier(pin.name)} = ${value.code};`);
          return {
            code: [
              "CustomHLSL",
              "{",
              ...(inputBindings.length ? ["    // Inputs", ...inputBindings, ""] : []),
              ...body.replace(/\r\n?/g, "\n").split("\n").map((line) => `    ${line}`),
              "}",
            ].join("\n"),
            type: "unknown",
            opaque: true,
          };
        }
        diagnostics.push({
          code: "opaque-custom",
          severity: "warning",
          message: `Custom HLSL node "${customName}" is preserved as an opaque call.`,
          line: node.startLine,
          nodeId: node.id,
        });
        const callName = node.displayName
          ? `Custom_${identifier(customName)}`
          : identifier(customName.replace("Custom Node", "CustomNode"));
        return callValue(callName, inputs.map(({ value }) => value.code), "unknown", true);
      }
      case "MaterialExpressionMaterialFunctionCall": {
        const args = inputPins(node).map((pin) => linkedValue(node, pin).code);
        const target = node.properties.get("MaterialFunction") ?? "UnresolvedMaterialFunction";
        const functionName = materialFunctionName(target);
        diagnostics.push({
          code: "external-function",
          severity: "warning",
          message: `Material Function ${functionName} at ${target} is not expanded; rendered as ${functionName}(...).`,
          line: node.startLine,
          nodeId: node.id,
        });
        return callValue(functionName, args, "unknown", true);
      }
      default: {
        const noise = proceduralNoiseExpression(node);
        if (noise) {
          const args = [
            ...noise.inputs.map((name) => input(node, [name]).code),
            ...noise.settings.map(([name, value]) => `${name}: ${literal(value)}`),
          ];
          return callValue(noise.token, args, noise.outputType);
        }
        const advanced = advancedExpression(className);
        if (advanced) {
          const args = node.pins
            .filter(meaningfulInputPin)
            .map((pin) => `${pinIdentifier(pin.name)}: ${linkedValue(node, pin).code}`);
          const parameter = node.properties.get("ParameterName");
          if (parameter) args.unshift(`Parameter: ${identifier(parameter)}`);
          const outputs = outputPins(node);
          const field = outputs.length > 1 ? `.${pinIdentifier(sourcePin.name)}` : "";
          const value = callValue(advanced.token, args, fixedExpressionOutputType(node, sourcePin) ?? "unknown");
          return {
            ...value,
            code: `${value.code}${field}`,
            call: field ? { ...value.call!, suffix: field } : value.call,
          };
        }
        const builtIn = inputDataExpression(className);
        if (builtIn) {
          const outputs = outputPins(node);
          const outputIndex = outputs.findIndex((pin) => pin.id === sourcePin.id);
          const args = builtIn.inputs.map((name) => input(node, [name]).code);
          if (className === "MaterialExpressionViewProperty") {
            args.push(identifier(node.properties.get("Property") ?? "FieldOfView"));
          }
          const base = builtIn.inputs.length > 0 || className === "MaterialExpressionViewProperty"
            ? `${builtIn.token}(${args.join(", ")})`
            : `${builtIn.token}()`;
          const selector = builtIn.selectors?.[outputIndex] ?? "";
          return {
            code: `${base}${selector}`,
            type: fixedExpressionOutputType(node, sourcePin) ?? "unknown",
          };
        }
        const semantics = mathExpression(className);
        if (semantics) {
          const inputNames = className === "MaterialExpressionSwitch"
            ? inputPins(node).map((pin) => pin.name)
            : semantics.inputs;
          const args = inputNames.map((name) => input(
            node,
            mathInputNames(semantics, name),
            mathInputDefault(semantics, name),
          ));
          if (className === "MaterialExpressionFloatToUInt" && node.properties.has("Mode")) {
            args.push({ code: identifier(node.properties.get("Mode")!), type: "unknown" });
          }
          const byName = (name: string | undefined): Value | undefined => {
            const index = name ? inputNames.indexOf(name) : -1;
            return index >= 0 ? args[index] : undefined;
          };
          const branchValues = className === "MaterialExpressionIf"
            ? [byName("A > B"), byName("A == B"), byName("A < B")]
            : className === "MaterialExpressionSwitch"
              ? args.filter((_, index) => inputNames[index] !== "SwitchValue")
              : [];
          const combine = (values: (Value | undefined)[]): string => {
            const present = values.filter((value): value is Value => Boolean(value));
            return present.slice(1).reduce((type, value) => combinedType({ code: "", type }, value), present[0]?.type ?? "unknown");
          };
          const source = byName(semantics.resultInput ?? semantics.inputs[0]);
          const type = semantics.typeRule === "fixed-float"
            ? "float"
            : semantics.typeRule === "fixed-float3"
              ? "float3"
              : semantics.typeRule === "float-to-uint"
                ? numericFamilyCast(source?.type ?? "unknown", "uint")
                : semantics.typeRule === "uint-to-float"
                  ? numericFamilyCast(source?.type ?? "unknown", "float")
                  : semantics.typeRule === "modulo"
                    ? numericFamilyCast(combine(args), "uint")
                    : semantics.typeRule === "branches"
                      ? combine(branchValues)
                      : semantics.typeRule === "arithmetic"
                        ? combine(args.slice(0, 2))
                        : source?.type ?? "unknown";
          if (semantics.render === "operator" && args.length >= 2) {
            return operationValue(semantics.token, args[0], args[1], type, options.simplifyAlgebra);
          }
          return callValue(semantics.token, args.map((value) => value.code), type);
        }
        const args = inputPins(node).map((pin) => linkedValue(node, pin).code);
        diagnostics.push({
          code: "unsupported-node",
          severity: "warning",
          message: `${className} is not supported; rendered as ${short}(...).`,
          line: node.startLine,
          nodeId: node.id,
        });
        return callValue(identifier(short), args, "unknown", true);
      }
    }
  };

  const neededPins = new Map<string, Set<string>>();
  const useCounts = new Map<string, number>();
  const consumersByOutput = new Map<string, GraphNode[]>();
  const outputsBySource = new Map<string, GraphOutput[]>();
  const need = (nodeId: string, pinId: string): void => {
    const pins = neededPins.get(nodeId) ?? new Set<string>();
    pins.add(pinId);
    neededPins.set(nodeId, pins);
    const key = outputKey(nodeId, pinId);
    useCounts.set(key, (useCounts.get(key) ?? 0) + 1);
  };
  for (const output of outputs) {
    if (output.sourceNodeId && output.sourcePinId) {
      need(output.sourceNodeId, output.sourcePinId);
      const key = outputKey(output.sourceNodeId, output.sourcePinId);
      outputsBySource.set(key, [...(outputsBySource.get(key) ?? []), output]);
    }
  }
  for (const node of orderedNodes) {
    for (const pin of node.pins) {
      if (pin.direction !== "input") continue;
      const link = pin.links[0];
      if (link && slice.nodeIds.has(link.nodeId)) {
        need(link.nodeId, link.pinId);
        const key = outputKey(link.nodeId, link.pinId);
        consumersByOutput.set(key, [...(consumersByOutput.get(key) ?? []), node]);
      }
    }
  }
  const absorbedReroutes = new Set<string>();
  const terminalNamedRerouteName = (nodeId: string, pin: GraphPin): string | undefined => {
    const path: string[] = [];
    let sourceKey = outputKey(nodeId, pin.id);
    let name: string | undefined;
    const visited = new Set<string>();

    while ((useCounts.get(sourceKey) ?? 0) === 1 && !visited.has(sourceKey)) {
      visited.add(sourceKey);
      const consumers = consumersByOutput.get(sourceKey) ?? [];
      if (consumers.length !== 1) break;
      const reroute = consumers[0];
      const rerouteOutput = outputPins(reroute)[0];
      if (reroute.expressionClass === "MaterialExpressionNamedRerouteUsage" && rerouteOutput) {
        sourceKey = outputKey(reroute.id, rerouteOutput.id);
        continue;
      }
      if (reroute.expressionClass !== "MaterialExpressionNamedRerouteDeclaration" || !reroute.displayName) break;
      if (!rerouteOutput) break;
      path.push(reroute.id);
      name = identifier(reroute.displayName);
      sourceKey = outputKey(reroute.id, rerouteOutput.id);
    }

    const terminalOutputs = outputsBySource.get(sourceKey) ?? [];
    if ((useCounts.get(sourceKey) ?? 0) === 1 && terminalOutputs.length === 1) {
      const outputName = terminalOutputs[0].label;
      if (!name || !isGenericResultName(outputName)) name = identifier(outputName);
    }
    if (name) path.forEach((rerouteId) => absorbedReroutes.add(rerouteId));
    return name;
  };

  for (const node of orderedNodes) {
    const nodeId = node.id;
    const pins = [...(neededPins.get(nodeId) ?? [])];

    const nodeOutputPins = outputPins(node);
    if (node.kind === "external-call" && nodeOutputPins.length > 1 && pins.length > 0) {
      const usedOutputPins = nodeOutputPins.filter((pin) => pins.includes(pin.id));
      const firstPin = usedOutputPins[0];
      const translated = translate(node, firstPin);
      const results = usedOutputPins.map((pin) => {
        const fact = typeInference.facts.get(outputKey(node.id, pin.id));
        const name = uniqueName(
          preferredName(
            node,
            pin,
            terminalNamedRerouteName(node.id, pin) ?? externalResultBaseName(node, pin),
          ),
        );
        registerSymbol(node, pin, name);
        const value: Value = {
          code: name,
          type: fact?.type ?? "unknown",
          confidence: fact?.confidence,
        };
        values.set(outputKey(node.id, pin.id), value);
        return { pin, name, value };
      });
      const call = translated.call!;
      const code = options.bundleFormat === "strict"
        ? (() => {
            const target = node.properties.get("MaterialFunction") ?? "MaterialFunction";
            const functionName = materialFunctionName(target);
            const bundleName = uniqueName(
              `${lowerCamelIdentifier(functionName.replace(/^MF_/i, ""))}Outputs`,
            );
            for (const result of results) {
              values.set(outputKey(node.id, result.pin.id), {
                ...result.value,
                code: `${bundleName}.${identifier(result.pin.name)}`,
              });
            }
            return assignment(`${functionName}_Outputs`, bundleName, translated, options.multilineCalls);
          })()
        : [
            ...results.map(({ name, value }) => `${renderedType(value)} ${name};`),
            "",
            callStatement(
              call.name,
              [...call.args, ...results.map(({ name }) => `out ${name}`)],
              options.multilineCalls,
            ),
          ].join("\n");
      declarations.push({
        code,
        commentRegions: options.commentSections ? node.commentRegions : undefined,
        spaced: options.spaceComplexOperations && isComplexValue(translated),
      });
      continue;
    }

    if (node.expressionClass === "MaterialExpressionConstant3Vector" && pins.length > 1) {
      const authored = authoredName(node);
      const commentRegion = localCommentRegion(node);
      const commentName = authoredIdentifier(commentRegion?.text);
      const primaryPin = nodeOutputPins[0];
      const name = uniqueName(primaryPin
        ? preferredName(node, primaryPin, authored ?? commentName ?? "constant3")
        : authored ?? commentName ?? "constant3");
      if (primaryPin) registerSymbol(node, primaryPin, name);
      declarations.push({
        code: `const float3 ${name} = ${vector(node.properties.get("Constant"), 3)};`,
        commentRegions: options.commentSections ? node.commentRegions : undefined,
        namedByCommentRegionId: !authored && commentName ? commentRegion?.id : undefined,
      });
      for (const pinId of pins) {
        const pin = node.pins.find((candidate) => candidate.id === pinId);
        if (pin) values.set(outputKey(nodeId, pinId), vectorPin(name, pin));
      }
      continue;
    }

    for (const pinId of pins) {
      const pin = node.pins.find((candidate) => candidate.id === pinId);
      if (!pin) continue;
      const key = outputKey(nodeId, pinId);
      const translated = translate(node, pin);
      const fact = typeInference.facts.get(key);
      const value: Value = fact
        ? { ...translated, type: fact.type, confidence: fact.confidence }
        : translated;
      const authored = authoredName(node);
      const protectedName = node.kind === "function-input" || /Parameter$/.test(node.expressionClass);
      const commentRegion = protectedName ? undefined : localCommentRegion(node);
      const commentName = authoredIdentifier(commentRegion?.text);
      const redundantRerouteAlias = /MaterialExpression(?:Named)?Reroute(?:Declaration|Usage)?$/.test(node.expressionClass)
        && (absorbedReroutes.has(node.id) || !authored || authored === value.code)
        && /^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)?$/.test(value.code);
      const keep =
        !redundantRerouteAlias && (
          node.kind === "function-input" ||
          /Parameter$/.test(node.expressionClass) ||
          Boolean(authored) ||
          Boolean(commentRegion) ||
          Boolean(value.opaque) ||
          (useCounts.get(key) ?? 0) > 1 ||
          value.code.length > maxInlineExpressionLength
        );

      if (!keep) {
        values.set(key, value);
        continue;
      }

      const generatedBaseName = node.kind === "external-call"
        ? externalResultBaseName(node, pin)
        : nodeBaseName(node);
      const terminalName = node.kind !== "function-input" && !/Parameter$/.test(node.expressionClass)
        ? terminalNamedRerouteName(node.id, pin)
        : undefined;
      const name = uniqueName(preferredName(
        node,
        pin,
        terminalName ?? authored ?? commentName ?? generatedBaseName,
      ));
      registerSymbol(node, pin, name);
      const preamble = node.kind === "function-input" || functionInputSymbols.has(value.code);
      values.set(key, { code: name, type: value.type, confidence: value.confidence });
      declarations.push({
        code: node.kind === "function-input"
          ? `${renderedType(value)} ${name}; // Function input`
          : assignment(renderedType(value), name, value, options.multilineCalls),
        commentRegions: preamble || !options.commentSections ? undefined : node.commentRegions,
        namedByCommentRegionId: !terminalName && !authored && commentName
          ? commentRegion?.id
          : undefined,
        preamble,
        spaced: options.spaceComplexOperations && (
          isComplexValue(value) || options.expandCustomNodes && node.kind === "custom"
        ),
      });
      if (node.kind === "function-input") functionInputSymbols.add(name);
    }
  }

  const renderedOutputs = outputs.map((output) => {
    const value = output.sourceNodeId && output.sourcePinId
      ? values.get(outputKey(output.sourceNodeId, output.sourcePinId))
      : undefined;
    const fieldName = identifier(output.label);
    if (value
      && graph.nodes.get(output.ownerNodeId)?.kind === "function-output"
      && /^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)?$/.test(value.code)) {
      return { fieldName, name: value.code, value };
    }
    const name = value?.code === fieldName ? fieldName : uniqueName(fieldName);
    if (value?.code === fieldName) return { fieldName, name, value };
    declarations.push({
      code: `${renderedType(value)} ${name} = ${value?.code ?? "unresolved_output"};`,
      commentRegions: options.commentSections && output.sourceNodeId
        ? graph.nodes.get(output.sourceNodeId)?.commentRegions
        : undefined,
      spaced: options.spaceComplexOperations && Boolean(value && isComplexValue(value)),
      output: true,
    });
    return { fieldName, name, value };
  });

  const bundleLines = outputs.length === 1
    ? graph.nodes.get(outputs[0].ownerNodeId)?.kind === "function-output"
      ? ["", `return ${renderedOutputs[0].name};`]
      : []
    : options.bundleFormat === "strict"
      ? [
          "",
          "struct FunctionOutputs",
          "{",
          ...renderedOutputs.map(({ fieldName, value }) => `    ${renderedType(value)} ${fieldName};`),
          "};",
          "",
          "FunctionOutputs result;",
          ...renderedOutputs.map(({ fieldName, name }) => `result.${fieldName} = ${name};`),
          "return result;",
        ]
      : [
          "",
          "return FunctionOutputs",
          "{",
          ...renderedOutputs.map(
            ({ fieldName, name }, index) => `    ${fieldName}: ${name}${index < renderedOutputs.length - 1 ? "," : ""}`,
          ),
          "};",
        ];

  const warningLines = [...new Set(diagnostics
    .filter((diagnostic) => diagnostic.severity !== "info")
    .map((diagnostic) => `// ${diagnostic.severity.toUpperCase()}: ${diagnostic.message}`))];
  const codeLines = [
    "// Pseudo-HLSL: semantic approximation of the connected Unreal graph.",
    ...warningLines,
    ...(warningLines.length ? [""] : []),
    ...renderDeclarations(declarations),
    ...bundleLines,
  ];
  const code = codeLines
    .filter((line, index) => line !== "" || codeLines[index - 1] !== "")
    .join("\n");

  const functionGroups = new Map<string, GraphNode[]>();
  for (const node of orderedNodes) {
    if (node.kind !== "external-call") continue;
    if (outputPins(node).every((pin) => knownMaterialFunctionOutputType(node, pin))) continue;
    const target = node.properties.get("MaterialFunction") ?? "UnresolvedMaterialFunction";
    const group = functionGroups.get(target) ?? [];
    group.push(node);
    functionGroups.set(target, group);
  }
  const statusPriority = (status: TypeOverrideValue["status"]): number =>
    status === "unknown" ? 0 : status === "inferred" || status === "minimum" ? 1 : 2;
  const externalGroups: TypeOverrideGroup[] = [...functionGroups].map(([target, nodes]) => {
    const firstOutputs = outputPins(nodes[0]);
    return {
      id: target,
      name: materialFunctionName(target),
      kind: "external-function" as const,
      values: firstOutputs.map((pin, index): TypeOverrideValue => {
        const id = functionOutputId(target, index);
        const override = overrides.get(id);
        const facts = nodes.map((node) => {
          const candidate = outputPins(node)[index];
          return candidate
            ? typeInference.facts.get(outputKey(node.id, candidate.id))
            : undefined;
        });
        const types = new Set(facts.flatMap((fact) => fact ? [fact.type] : []));
        const fact = facts.every(Boolean) && types.size === 1 ? facts[0] : undefined;
        return {
          id,
          name: pin.name || `Output ${index + 1}`,
          type: override ?? fact?.type,
          status: override
            ? "overridden"
            : !fact
              ? "unknown"
              : fact.confidence === "minimum"
                ? "minimum"
                : "inferred",
        };
      }).sort((a, b) =>
        statusPriority(a.status) - statusPriority(b.status) || a.name.localeCompare(b.name)),
    };
  });
  const customGroups: TypeOverrideGroup[] = orderedNodes.flatMap((node) => {
    if (node.kind !== "custom") return [];
    const values = customInputPins(node).flatMap((pin): TypeOverrideValue[] => {
      const id = customInputId(node, pin);
      const override = overrides.get(id);
      const link = pin.links[0];
      const fact = link ? typeInference.facts.get(outputKey(link.nodeId, link.pinId)) : undefined;
      if (!override && fact && fact.confidence !== "minimum") return [];
      return [{
        id,
        name: pin.name,
        type: override ?? fact?.type,
        status: override ? "overridden" : fact?.confidence === "minimum" ? "minimum" : "unknown",
      }];
    });
    return values.length ? [{
      id: `CustomNode:${node.id}`,
      name: customNodeNames.get(node.id) ?? "Custom Node",
      kind: "custom-node" as const,
      values,
    }] : [];
  });
  const typeOverrideGroups = [...externalGroups, ...customGroups].sort((a, b) => {
    const aPriority = Math.min(...a.values.map((value) => statusPriority(value.status)));
    const bPriority = Math.min(...b.values.map((value) => statusPriority(value.status)));
    return aPriority - bPriority || a.name.localeCompare(b.name);
  });

  return {
    code,
    diagnostics,
    typeOverrideGroups,
    staticSwitches: slice.staticSwitches,
    editableSymbols: [...editableSymbols.values()],
  };
}

export function generatePseudoHlsl(
  graph: MaterialGraph,
  outputId: string,
  overrides: TypeOverrides = new Map(),
  options: PseudoHlslOptions = defaultPseudoHlslOptions,
  staticSwitchOverrides: StaticSwitchOverrides = new Map(),
  nameOverrides: NameOverrides = new Map(),
): PseudoHlslResult {
  const output = graph.outputs.find((candidate) => candidate.id === outputId);
  if (!output) throw new Error(`Unknown graph output: ${outputId}`);
  return generatePseudoHlslForOutputs(graph, [output], overrides, options, staticSwitchOverrides, nameOverrides);
}

export function generateAllPseudoHlsl(
  graph: MaterialGraph,
  overrides: TypeOverrides = new Map(),
  options: PseudoHlslOptions = defaultPseudoHlslOptions,
  staticSwitchOverrides: StaticSwitchOverrides = new Map(),
  nameOverrides: NameOverrides = new Map(),
): PseudoHlslResult {
  return generatePseudoHlslForOutputs(
    graph,
    graph.outputs,
    overrides,
    options,
    staticSwitchOverrides,
    nameOverrides,
  );
}
