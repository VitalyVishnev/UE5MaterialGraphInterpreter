import type { Diagnostic } from "../clipboard/raw-types";
import {
  declaredFunctionInputType,
  isNumericType,
  numericDimensions,
  numericFamily,
  numericType,
  promoteNumericTypes,
  type MaterialType,
  type NumericType,
} from "./material-types";
import type { GraphSlice } from "./slice";
import type { GraphNode, GraphPin, MaterialGraph } from "./types";
import {
  arithmeticExpressionInputs,
  branchExpressionInputs,
  equivalentExpressionInputs,
  fixedExpressionInputType,
  fixedExpressionOutputType,
  mathInputNames,
  mathExpression,
} from "./expression-semantics";

export interface InferredType {
  type: MaterialType;
  confidence: "confirmed" | "inferred" | "minimum";
}

export interface TypeInferenceResult {
  facts: ReadonlyMap<string, InferredType>;
  diagnostics: Diagnostic[];
}

const key = (nodeId: string, pinId: string): string => `${nodeId}:${pinId}`;

const channelTypes: Readonly<Record<string, NumericType>> = {
  red: "float",
  green: "float",
  blue: "float",
  alpha: "float",
  rg: "float2",
  rgb: "float3",
  rgba: "float4",
};

function pinType(pin: GraphPin): NumericType | undefined {
  return pin.subcategory ? channelTypes[pin.subcategory.toLowerCase()] : undefined;
}

function componentMaskMinimum(node: GraphNode): NumericType | undefined {
  if (node.properties.get("A") === "True") return "float4";
  if (node.properties.get("B") === "True") return "float3";
  if (node.properties.get("G") === "True") return "float2";
  if (node.properties.get("R") === "True") return "float";
  return undefined;
}

function annotatedPinType(name: string): NumericType | undefined {
  const abbreviation = name.match(/\((S|V2|V3|V4)\)\s*$/i)?.[1].toUpperCase();
  return abbreviation === "S"
    ? "float"
    : abbreviation?.startsWith("V")
      ? `float${abbreviation.slice(1)}` as NumericType
      : undefined;
}

function selectedVectorType(node: GraphNode): NumericType | undefined {
  const selectedVector = node.pins.some(
    (pin) => pin.direction === "output" && /^Selected\s+Vector$/i.test(pin.name.trim()),
  );
  if (!selectedVector) return undefined;
  const branchTypes = node.pins.flatMap((pin) => {
    const type = pin.direction === "input" ? annotatedPinType(pin.name) : undefined;
    return type && numericDimensions(type) > 1 ? [type] : [];
  });
  return branchTypes.length >= 2 && new Set(branchTypes).size === 1
    ? branchTypes[0]
    : undefined;
}

function functionName(node: GraphNode): string {
  const target = node.properties.get("MaterialFunction") ?? "";
  const path = target.match(/"([^"]+)"/)?.[1] ?? target;
  const asset = path.split("/").at(-1) ?? path;
  return asset.split(".").at(-1) ?? asset;
}

function customOutputType(value: string | undefined, fallback: MaterialType): MaterialType | undefined {
  if (!value) return fallback;
  const numeric = value.match(/Float([1-4])/i);
  if (numeric) return numericType(Number(numeric[1]));
  return /MaterialAttributes/i.test(value) ? "MaterialAttributes" : undefined;
}

export function inferTypes(
  graph: MaterialGraph,
  slice: GraphSlice,
  overrides: ReadonlyMap<string, MaterialType> = new Map(),
): TypeInferenceResult {
  const facts = new Map<string, InferredType>();
  const minimums = new Map<string, NumericType>();
  const conflicts = new Set<string>();
  const orderedNodes = slice.orderedNodeIds.map((nodeId) => graph.nodes.get(nodeId)!);

  const set = (
    valueKey: string | undefined,
    type: MaterialType | undefined,
    confidence: Exclude<InferredType["confidence"], "minimum">,
  ): boolean => {
    if (!valueKey || !type || conflicts.has(valueKey)) return false;
    if (overrides.has(valueKey)) return false;
    const current = facts.get(valueKey);
    if (!current) {
      facts.set(valueKey, { type, confidence });
      return true;
    }
    if (current.type !== type) {
      facts.delete(valueKey);
      conflicts.add(valueKey);
      return true;
    }
    if (current.confidence === "inferred" && confidence === "confirmed") {
      facts.set(valueKey, { type, confidence });
      return true;
    }
    return false;
  };

  for (const [valueKey, type] of overrides) {
    facts.set(valueKey, { type, confidence: "confirmed" });
  }

  const setMinimum = (valueKey: string | undefined, type: NumericType | undefined): boolean => {
    if (!valueKey || !type || conflicts.has(valueKey)) return false;
    const exact = facts.get(valueKey);
    if (exact) {
      if (isNumericType(exact.type)
        && (numericDimensions(exact.type) === 1
          || numericDimensions(exact.type) >= numericDimensions(type))) return false;
      facts.delete(valueKey);
      minimums.delete(valueKey);
      conflicts.add(valueKey);
      return true;
    }
    const current = minimums.get(valueKey);
    if (!current || numericDimensions(type) > numericDimensions(current)) {
      minimums.set(valueKey, type);
      return true;
    }
    return false;
  };

  const inputPins = (node: GraphNode): GraphPin[] =>
    node.pins.filter((pin) => pin.direction === "input");
  const outputPins = (node: GraphNode): GraphPin[] =>
    node.pins.filter((pin) => pin.direction === "output");
  const outputKey = (node: GraphNode, pin?: GraphPin): string | undefined => {
    const output = pin ?? node.pins.find((candidate) => candidate.direction === "output");
    return output ? key(node.id, output.id) : undefined;
  };
  const linkedKey = (node: GraphNode, ...names: string[]): string | undefined => {
    const wanted = names.map((name) => name.toLowerCase());
    const pin = inputPins(node).find((candidate) => wanted.includes(candidate.name.toLowerCase()));
    const link = pin?.links[0];
    return link ? key(link.nodeId, link.pinId) : undefined;
  };
  const linkedMathKey = (node: GraphNode, inputName: string): string | undefined => {
    const semantics = mathExpression(node.expressionClass);
    return linkedKey(node, ...(semantics ? mathInputNames(semantics, inputName) : [inputName]));
  };

  for (const node of orderedNodes) {
    for (const pin of outputPins(node)) {
      const declared = fixedExpressionOutputType(node, pin) ?? pinType(pin);
      if (declared) set(key(node.id, pin.id), declared, "confirmed");
    }
    for (const pin of inputPins(node)) {
      const link = pin.links[0];
      if (link) set(key(link.nodeId, link.pinId), fixedExpressionInputType(node, pin), "inferred");
    }

    const first = outputKey(node);
    switch (node.expressionClass) {
      case "MaterialExpressionConstant":
        set(first, "float", "confirmed");
        break;
      case "MaterialExpressionFunctionInput":
        set(first, declaredFunctionInputType(node.properties.get("InputType")), "confirmed");
        break;
      case "MaterialExpressionSceneTexture":
        for (const pin of outputPins(node)) {
          set(
            key(node.id, pin.id),
            pin.name === "Size" || pin.name === "InvSize" ? "float2" : pinType(pin) ?? "float4",
            "confirmed",
          );
        }
        break;
      case "MaterialExpressionComponentMask": {
        const count = ["R", "G", "B", "A"].filter(
          (channel) => node.properties.get(channel) === "True",
        ).length;
        set(first, numericType(count), "confirmed");
        break;
      }
      case "MaterialExpressionCustom": {
        for (const [index, pin] of outputPins(node).entries()) {
          const serialized = index === 0
            ? node.properties.get("OutputType")
            : node.properties.get(`AdditionalOutputs(${index - 1})`)?.match(/OutputType=([^,)]+)/)?.[1];
          set(key(node.id, pin.id), customOutputType(serialized, index === 0 ? "float3" : "float"), "confirmed");
        }
        break;
      }
      case "MaterialExpressionMaterialFunctionCall": {
        const match = functionName(node).match(/^MakeFloat([2-4])$/i);
        const scalarInputs = inputPins(node).every((pin) => annotatedPinType(pin.name) === "float");
        if (match && scalarInputs) set(first, numericType(Number(match[1])), "inferred");
        set(first, selectedVectorType(node), "inferred");
        break;
      }
    }
  }

  let changed = true;
  for (let pass = 0; changed && pass < slice.orderedNodeIds.length * 2; pass += 1) {
    changed = false;
    for (const node of orderedNodes) {
      const out = outputKey(node);

      for (const pin of inputPins(node)) {
        const link = pin.links[0];
        if (link) changed = set(key(link.nodeId, link.pinId), annotatedPinType(pin.name), "inferred") || changed;
      }

      if (node.expressionClass === "MaterialExpressionTextureSample") {
        changed = set(linkedKey(node, "UVs", "Coordinates"), "float2", "inferred") || changed;
      }

      if (node.expressionClass === "MaterialExpressionComponentMask") {
        changed = setMinimum(linkedKey(node, "Input"), componentMaskMinimum(node)) || changed;
      }

      const equivalentKeys = [
        out,
        ...equivalentExpressionInputs(node).map((name) => linkedMathKey(node, name)),
      ].filter((valueKey): valueKey is string => Boolean(valueKey));
      for (const sourceKey of equivalentKeys) {
        const sourceFact = facts.get(sourceKey);
        if (!sourceFact || !isNumericType(sourceFact.type)) continue;
        for (const targetKey of equivalentKeys) {
          if (targetKey === sourceKey) continue;
          changed = set(
            targetKey,
            sourceFact.type,
            sourceKey === out ? "inferred" : sourceFact.confidence === "confirmed" ? "confirmed" : "inferred",
          ) || changed;
        }
      }

      const branchFacts = branchExpressionInputs(node)
        .map((name) => facts.get(linkedKey(node, name) ?? ""))
        .filter((fact): fact is InferredType => Boolean(fact));
      if (out && branchFacts.length > 0) {
        const types = branchFacts.map((fact) => fact.type);
        const branchType = types.every(isNumericType)
          ? types.reduce((left, right) => promoteNumericTypes(left, right) ?? left)
          : types.every((type) => type === types[0])
            ? types[0]
            : undefined;
        const current = facts.get(out);
        if (branchType && current?.type !== branchType) {
          if (current?.confidence === "inferred"
            && isNumericType(current.type)
            && isNumericType(branchType)) {
            facts.set(out, {
              type: promoteNumericTypes(current.type, branchType) ?? current.type,
              confidence: "inferred",
            });
            changed = true;
          } else {
            const confidence = branchFacts.some((fact) => fact.confidence === "inferred")
              ? "inferred"
              : "confirmed";
            changed = set(out, branchType, confidence) || changed;
          }
        }
      }

      const math = mathExpression(node.expressionClass);
      if ((math?.typeRule === "float-to-uint" || math?.typeRule === "uint-to-float") && out) {
        const inputKey = linkedMathKey(node, math.inputs[0]);
        const inputFact = inputKey ? facts.get(inputKey) : undefined;
        const outputFact = facts.get(out);
        if (inputFact && isNumericType(inputFact.type)) {
          const family = math.typeRule === "float-to-uint" ? "uint" : "float";
          changed = set(
            out,
            numericType(numericDimensions(inputFact.type), family),
            inputFact.confidence === "minimum" ? "inferred" : inputFact.confidence,
          ) || changed;
        }
        if (outputFact && isNumericType(outputFact.type)) {
          const family = math.typeRule === "float-to-uint" ? "float" : "uint";
          changed = set(inputKey, numericType(numericDimensions(outputFact.type), family), "inferred") || changed;
        }
      }

      if (math?.typeRule === "modulo" && out) {
        const keys = [out, ...math.inputs.map((name) => linkedMathKey(node, name))]
          .filter((valueKey): valueKey is string => Boolean(valueKey));
        for (const sourceKey of keys) {
          const sourceFact = facts.get(sourceKey);
          if (!sourceFact || !isNumericType(sourceFact.type)) continue;
          const uintType = numericType(numericDimensions(sourceFact.type), "uint");
          for (const targetKey of keys) changed = set(targetKey, uintType, "inferred") || changed;
        }
      }

      const arithmeticInputs = arithmeticExpressionInputs(node);
      if (arithmeticInputs.length === 2 && out) {
        const names = arithmeticInputs;
        const aKey = linkedMathKey(node, names[0]);
        const bKey = linkedMathKey(node, names[1]);
        const a = aKey ? facts.get(aKey) : undefined;
        const b = bKey ? facts.get(bKey) : undefined;
        const result = facts.get(out);
        const aType = a && isNumericType(a.type) ? a.type : undefined;
        const bType = b && isNumericType(b.type) ? b.type : undefined;
        const resultType = result && isNumericType(result.type) ? result.type : undefined;
        const forward = aType && bType
          ? promoteNumericTypes(aType, bType)
          : aType && aType !== "float"
            ? aType
            : bType && bType !== "float"
              ? bType
              : undefined;
        const confidence = a?.confidence === "inferred" || b?.confidence === "inferred" ? "inferred" : "confirmed";
        changed = set(out, forward, confidence) || changed;
        if (resultType === "float") {
          changed = set(aKey, "float", "inferred") || changed;
          changed = set(bKey, "float", "inferred") || changed;
        } else if (resultType && aType === "float") {
          changed = set(bKey, resultType, "inferred") || changed;
        } else if (resultType && bType === "float") {
          changed = set(aKey, resultType, "inferred") || changed;
        }
      }

      if (node.expressionClass === "MaterialExpressionDotProduct") {
        const aKey = linkedKey(node, "A");
        const bKey = linkedKey(node, "B");
        const a = aKey ? facts.get(aKey) : undefined;
        const b = bKey ? facts.get(bKey) : undefined;
        changed = set(aKey, b && isNumericType(b.type) ? b.type : undefined, "inferred") || changed;
        changed = set(bKey, a && isNumericType(a.type) ? a.type : undefined, "inferred") || changed;
      }

      if (node.expressionClass === "MaterialExpressionAppendVector" && out) {
        const aKey = linkedKey(node, "A");
        const bKey = linkedKey(node, "B");
        const a = aKey ? facts.get(aKey) : undefined;
        const b = bKey ? facts.get(bKey) : undefined;
        const result = facts.get(out);
        if (a && b && isNumericType(a.type) && isNumericType(b.type)) {
          const type = numericFamily(a.type) === numericFamily(b.type)
            ? numericType(numericDimensions(a.type) + numericDimensions(b.type), numericFamily(a.type))
            : undefined;
          const confidence = a.confidence === "inferred" || b.confidence === "inferred" ? "inferred" : "confirmed";
          changed = set(out, type, confidence) || changed;
        } else if (result && a && isNumericType(result.type) && isNumericType(a.type)) {
          changed = set(bKey, numericType(numericDimensions(result.type) - numericDimensions(a.type), numericFamily(result.type)), "inferred") || changed;
        } else if (result && b && isNumericType(result.type) && isNumericType(b.type)) {
          changed = set(aKey, numericType(numericDimensions(result.type) - numericDimensions(b.type), numericFamily(result.type)), "inferred") || changed;
        }
      }
    }
  }


  for (const [valueKey, type] of minimums) {
    if (!facts.has(valueKey) && !conflicts.has(valueKey)) {
      facts.set(valueKey, { type, confidence: "minimum" });
    }
  }

  const diagnostics: Diagnostic[] = [...conflicts].map((valueKey) => {
    const nodeId = valueKey.split(":", 1)[0];
    const node = graph.nodes.get(nodeId);
    return {
      code: "type-conflict",
      severity: "warning",
      message: `Conflicting numeric type constraints for ${valueKey}.`,
      line: node?.startLine ?? 1,
      nodeId,
    };
  });

  return { facts, diagnostics };
}
