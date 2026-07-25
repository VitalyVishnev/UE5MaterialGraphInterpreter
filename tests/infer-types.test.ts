import { describe, expect, it } from "vitest";
import { inferTypes } from "../src/graph/infer-types";
import type { GraphSlice } from "../src/graph/slice";
import type { GraphNode, MaterialGraph } from "../src/graph/types";

const node = (
  id: string,
  expressionClass: string,
  pins: GraphNode["pins"],
  properties: ReadonlyMap<string, string> = new Map(),
): GraphNode => ({
  id,
  expressionClass,
  kind: expressionClass === "MaterialExpressionMaterialFunctionCall"
    ? "external-call"
    : "expression",
  properties,
  pins,
  startLine: 1,
});

describe("type inference", () => {
  const branchResult = (
    branchClasses: readonly string[],
    selectedStaticBranch?: boolean,
    expressionClass?: string,
  ) => {
    const branches = branchClasses.map((expressionClass, index) =>
      node(`Branch${index}`, expressionClass, [{
        id: `branch-${index}-out`,
        name: "Output",
        direction: "output",
        links: [{ nodeId: "If", pinId: `value-${index}` }],
      }]));
    const branchNames = selectedStaticBranch === undefined
      ? ["A > B", "A == B", "A < B"]
      : ["True", "False"];
    const branchNode = node(
      "If",
      expressionClass ?? (selectedStaticBranch === undefined
        ? "MaterialExpressionIf"
        : "MaterialExpressionStaticSwitch"),
      [
      ...branchNames.map((name, index) => ({
        id: `value-${index}`,
        name,
        direction: "input" as const,
        links: index < branches.length
          ? [{ nodeId: `Branch${index}`, pinId: `branch-${index}-out` }]
          : [],
      })),
      { id: "if-out", name: "Output", direction: "output", links: [] },
    ]);
    const nodes = [...branches, branchNode];
    const graph: MaterialGraph = {
      nodes: new Map(nodes.map((item) => [item.id, item])),
      outputs: [],
      diagnostics: [],
    };
    const slice: GraphSlice = {
      outputId: "test",
      outputIds: ["test"],
      nodeIds: new Set(nodes.map(({ id }) => id)),
      orderedNodeIds: nodes.map(({ id }) => id),
      externalInputs: [],
      staticSwitches: [],
      staticSwitchSelections: selectedStaticBranch === undefined
        ? new Map()
        : new Map([["If", selectedStaticBranch]]),
      diagnostics: [],
    };
    return inferTypes(graph, slice);
  };

  it("does not guess a type for incompatible branch widths", () => {
    for (const classes of [
      ["MaterialExpressionConstant2Vector", "MaterialExpressionConstant3Vector"],
      ["MaterialExpressionConstant3Vector", "MaterialExpressionConstant2Vector"],
    ]) {
      const result = branchResult(classes);
      expect(result.facts.get("If:if-out")).toBeUndefined();
      expect(result.diagnostics.filter(({ code }) => code === "type-conflict")).toHaveLength(1);
    }
  });

  it("promotes scalar branches and marks incomplete branch evidence as inferred", () => {
    const complete = branchResult([
      "MaterialExpressionConstant",
      "MaterialExpressionConstant3Vector",
      "MaterialExpressionConstant",
    ]);
    expect(complete.facts.get("If:if-out")).toEqual({
      type: "float3",
      confidence: "confirmed",
    });

    const incomplete = branchResult(["MaterialExpressionConstant3Vector"]);
    expect(incomplete.facts.get("If:if-out")).toEqual({
      type: "float3",
      confidence: "inferred",
    });
  });

  it("uses only the selected Static Switch branch", () => {
    const result = branchResult([
      "MaterialExpressionConstant2Vector",
      "MaterialExpressionConstant3Vector",
    ], false);
    expect(result.facts.get("If:if-out")).toEqual({
      type: "float3",
      confidence: "confirmed",
    });
    expect(result.diagnostics.some(({ code }) => code === "type-conflict")).toBe(false);
  });

  it("does not treat platform-specific branch widths as a runtime conflict", () => {
    const result = branchResult([
      "MaterialExpressionConstant3Vector",
      "MaterialExpressionConstant4Vector",
    ], undefined, "MaterialExpressionFeatureLevelSwitch");
    expect(result.facts.get("If:if-out")).toBeUndefined();
    expect(result.diagnostics.some(({ code }) => code === "type-conflict")).toBe(false);
  });

  it("uses arithmetic defaults without rejecting a valid scalar broadcast", () => {
    const constant = node("Constant", "MaterialExpressionConstant", [{
      id: "constant-out", name: "Output", direction: "output",
      links: [{ nodeId: "Multiply", pinId: "a" }],
    }]);
    const multiply = node("Multiply", "MaterialExpressionMultiply", [
      {
        id: "a", name: "A", direction: "input",
        links: [{ nodeId: "Constant", pinId: "constant-out" }],
      },
      { id: "b", name: "B", direction: "input", defaultValue: "0.04", links: [] },
      {
        id: "multiply-out", name: "Output", direction: "output",
        links: [{ nodeId: "Call", pinId: "value" }],
      },
    ], new Map([["ConstB", "0.04"]]));
    const call = node("Call", "MaterialExpressionMaterialFunctionCall", [
      {
        id: "value", name: "Value (V3)", direction: "input",
        links: [{ nodeId: "Multiply", pinId: "multiply-out" }],
      },
      { id: "call-out", name: "Output", direction: "output", links: [] },
    ]);
    const graph: MaterialGraph = {
      nodes: new Map([constant, multiply, call].map((item) => [item.id, item])),
      outputs: [],
      diagnostics: [],
    };
    const slice: GraphSlice = {
      outputId: "test",
      outputIds: ["test"],
      nodeIds: new Set(["Constant", "Multiply", "Call"]),
      orderedNodeIds: ["Constant", "Multiply", "Call"],
      externalInputs: [],
      staticSwitches: [],
      staticSwitchSelections: new Map(),
      diagnostics: [],
    };

    const result = inferTypes(graph, slice);
    expect(result.facts.get("Multiply:multiply-out")).toEqual({
      type: "float",
      confidence: "confirmed",
    });
    expect(result.diagnostics.some((item) => item.code === "type-conflict")).toBe(false);
  });

  it("allows a scalar operand to broadcast in a vector dot product", () => {
    const vector = node("Vector", "MaterialExpressionConstant2Vector", [{
      id: "vector-out", name: "Output", direction: "output",
      links: [{ nodeId: "Power", pinId: "base" }],
    }]);
    const exponent = node("Exponent", "MaterialExpressionConstant", [{
      id: "exponent-out", name: "Output", direction: "output",
      links: [{ nodeId: "Power", pinId: "exp" }],
    }]);
    const scalar = node("Scalar", "MaterialExpressionConstant", [{
      id: "scalar-out", name: "Output", direction: "output",
      links: [{ nodeId: "Dot", pinId: "dot-b" }],
    }]);
    const power = node("Power", "MaterialExpressionPower", [
      {
        id: "base", name: "Base", direction: "input",
        links: [{ nodeId: "Vector", pinId: "vector-out" }],
      },
      {
        id: "exp", name: "Exp", direction: "input",
        links: [{ nodeId: "Exponent", pinId: "exponent-out" }],
      },
      {
        id: "power-out", name: "Output", direction: "output",
        links: [
          { nodeId: "Dot", pinId: "dot-a" },
          { nodeId: "Divide", pinId: "divide-a" },
        ],
      },
    ]);
    const dot = node("Dot", "MaterialExpressionDotProduct", [
      {
        id: "dot-a", name: "A", direction: "input",
        links: [{ nodeId: "Power", pinId: "power-out" }],
      },
      {
        id: "dot-b", name: "B", direction: "input",
        links: [{ nodeId: "Scalar", pinId: "scalar-out" }],
      },
      {
        id: "dot-out", name: "Output", direction: "output",
        links: [{ nodeId: "Divide", pinId: "divide-b" }],
      },
    ]);
    const divide = node("Divide", "MaterialExpressionDivide", [
      {
        id: "divide-a", name: "A", direction: "input",
        links: [{ nodeId: "Power", pinId: "power-out" }],
      },
      {
        id: "divide-b", name: "B", direction: "input",
        links: [{ nodeId: "Dot", pinId: "dot-out" }],
      },
      { id: "divide-out", name: "Output", direction: "output", links: [] },
    ]);
    const nodes = [vector, exponent, scalar, power, dot, divide];
    const graph: MaterialGraph = {
      nodes: new Map(nodes.map((item) => [item.id, item])),
      outputs: [],
      diagnostics: [],
    };
    const slice: GraphSlice = {
      outputId: "test",
      outputIds: ["test"],
      nodeIds: new Set(nodes.map(({ id }) => id)),
      orderedNodeIds: nodes.map(({ id }) => id),
      externalInputs: [],
      staticSwitches: [],
      staticSwitchSelections: new Map(),
      diagnostics: [],
    };

    const result = inferTypes(graph, slice);
    expect(result.facts.get("Power:power-out")?.type).toBe("float2");
    expect(result.facts.get("Divide:divide-out")?.type).toBe("float2");
    expect(result.diagnostics.some((item) => item.code === "type-conflict")).toBe(false);
  });
});
