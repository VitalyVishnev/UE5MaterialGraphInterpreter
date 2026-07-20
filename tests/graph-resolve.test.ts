import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { parseClipboard } from "../src/clipboard/parser";
import { resolveGraph } from "../src/graph/resolve";

const sampleIt = existsSync(resolve("samples")) ? it : it.skip;
import { assignCommentRegions } from "../src/graph/resolve-comment-regions";
import { sliceOutput } from "../src/graph/slice";
import type { GraphNode, MaterialGraph } from "../src/graph/types";

describe("resolveGraph", () => {
  sampleIt("discovers the connected material output in SceneColor", () => {
    const source = readFileSync(
      resolve("samples/SceneColor/SceneColor_full_clipboard.txt"),
      "utf8",
    );

    const graph = resolveGraph(parseClipboard(source));

    expect(graph.outputs).toEqual([
      expect.objectContaining({
        label: "Emissive Color",
        sourceNodeId: "MaterialGraphNode_0",
      }),
    ]);
    expect(graph.nodes.get("MaterialGraphNode_0")?.expressionClass).toBe(
      "MaterialExpressionLinearInterpolate",
    );
  });

  sampleIt("discovers Material Function inputs and outputs", () => {
    const source = readFileSync(
      resolve(
        "samples/MF_Noise_InterleavedGradientGolden_1d/MF_Noise_InterleavedGradientGolden_1d_full_clipboard.txt",
      ),
      "utf8",
    );

    const graph = resolveGraph(parseClipboard(source));
    const functionInputs = [...graph.nodes.values()].filter(
      (node) => node.kind === "function-input",
    );

    expect(graph.outputs.map((output) => output.label)).toContain("Unsigned");
    expect(functionInputs.map((node) => node.displayName)).toEqual(
      expect.arrayContaining(["TemporalSampleIndex", "PixelPosition"]),
    );
  });

  it("discovers Landscape Grass Output pins from the Landscape module", () => {
    const graph = resolveGraph(parseClipboard(`
Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="GrassOutput"
  Begin Object Class=/Script/Landscape.MaterialExpressionLandscapeGrassOutput Name="GrassOutputExpression"
  End Object
  Begin Object Name="GrassOutputExpression"
  End Object
  CustomProperties Pin (PinId=11111111111111111111111111111111,PinName="Kill Layer",LinkedTo=(Max AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA))
  CustomProperties Pin (PinId=22222222222222222222222222222222,PinName="Grass",LinkedTo=(Grass BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB))
  CustomProperties Pin (PinId=33333333333333333333333333333333,PinName="GrassDry",LinkedTo=(GrassDry CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC))
End Object
Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Grass"
  Begin Object Class=/Script/Landscape.MaterialExpressionLandscapeLayerSample Name="GrassExpression"
  End Object
  Begin Object Name="GrassExpression"
    ParameterName="Grass"
  End Object
  CustomProperties Pin (PinId=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB,PinName="Output",Direction="EGPD_Output")
End Object
Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="GrassDry"
  Begin Object Class=/Script/Landscape.MaterialExpressionLandscapeLayerSample Name="GrassDryExpression"
  End Object
  Begin Object Name="GrassDryExpression"
    ParameterName="GrassDry"
  End Object
  CustomProperties Pin (PinId=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC,PinName="Output",Direction="EGPD_Output")
End Object
Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Max"
  Begin Object Class=/Script/Engine.MaterialExpressionMax Name="MaxExpression"
  End Object
  Begin Object Name="MaxExpression"
  End Object
  CustomProperties Pin (PinId=DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD,PinName="A",LinkedTo=(Grass BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB))
  CustomProperties Pin (PinId=EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE,PinName="B",LinkedTo=(GrassDry CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC))
  CustomProperties Pin (PinId=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,PinName="Output",Direction="EGPD_Output")
End Object
`));

    expect(graph.outputs.map((output) => output.label)).toEqual([
      "LandscapeGrassOutput.Kill Layer",
      "LandscapeGrassOutput.Grass",
      "LandscapeGrassOutput.GrassDry",
    ]);
    expect(graph.nodes.get("Grass")?.expressionClass).toBe("MaterialExpressionLandscapeLayerSample");
    expect(graph.nodes.get("GrassOutput")?.expressionClass).toBe("MaterialExpressionLandscapeGrassOutput");
  });

  sampleIt("does not expose the Function Output input-pin name as the result name", () => {
    const source = readFileSync(
      resolve("samples/MF_GerstnerWaves/MF_GerstnerWaves_full_clipboard.txt"),
      "utf8",
    );

    const graph = resolveGraph(parseClipboard(source));

    expect(graph.outputs).toEqual([
      expect.objectContaining({ label: "Result" }),
    ]);
  });

  sampleIt("excludes the detached Custom reference from the noise output slice", () => {
    const source = readFileSync(
      resolve(
        "samples/MF_Noise_InterleavedGradientGolden_1d/MF_Noise_InterleavedGradientGolden_1d_full_clipboard.txt",
      ),
      "utf8",
    );
    const graph = resolveGraph(parseClipboard(source));
    const output = graph.outputs.find((candidate) => candidate.label === "Unsigned");
    const reference = [...graph.nodes.values()].find(
      (node) => node.kind === "custom" && node.properties.get("Description") === "InterleavedGradientNoise",
    );

    expect(output).toBeDefined();
    expect(reference).toBeDefined();
    expect(sliceOutput(graph, output!.id).nodeIds.has(reference!.id)).toBe(false);
  });

  sampleIt("turns missing dependencies in a valid partial selection into external inputs", () => {
    const source = readFileSync(
      resolve("samples/SceneColor/SceneColor_partial_1_clipboard.txt"),
      "utf8",
    );
    const graph = resolveGraph(parseClipboard(source));

    expect(graph.outputs.length).toBeGreaterThan(0);
    const slice = sliceOutput(graph, graph.outputs[0].id);
    expect(slice.externalInputs.length).toBeGreaterThan(0);
    expect(graph.diagnostics.some((item) => item.code === "unresolved-link")).toBe(true);
  });

  it("warns about missing input sources but ignores missing output consumers", () => {
    const graph = resolveGraph(parseClipboard(`
Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="AddNode"
  Begin Object Class=/Script/Engine.MaterialExpressionAdd Name="AddExpression"
  End Object
  Begin Object Name="AddExpression"
  End Object
  CustomProperties Pin (PinId=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,PinName="A",LinkedTo=(MissingSource BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB))
  CustomProperties Pin (PinId=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC,PinName="Output",Direction="EGPD_Output",LinkedTo=(MissingConsumer DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD))
End Object
`));

    const unresolved = graph.diagnostics.filter((item) => item.code === "unresolved-link");
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].message).toBe(
      'Input "A" on Add comes from outside this clipboard selection.',
    );
    expect(unresolved[0].message).not.toContain("MissingSource");
  });

  sampleIt("does not expose unused secondary channels as partial-graph outputs", () => {
    const source = readFileSync(
      resolve(
        "samples/MF_ResolveCoordinateFrame_Biplanar_Dither/MF_ResolveCoordinateFrame_Biplanar_Dither_partial_1_clipboard.txt",
      ),
      "utf8",
    );

    const graph = resolveGraph(parseClipboard(source));
    const labels = graph.outputs.map((output) => output.label);

    expect(labels).toContain("RefNorm");
    expect(labels).not.toContain("Constant3Vector.R");
    expect(labels).not.toContain("LocalPosition.XY");
  });

  it("terminates malformed cycles with a diagnostic", () => {
    const graph: MaterialGraph = {
      nodes: new Map([
        [
          "A",
          {
            id: "A",
            expressionClass: "MaterialExpressionAdd",
            kind: "expression",
            properties: new Map(),
            startLine: 1,
            pins: [
              { id: "A-in", name: "A", direction: "input", links: [{ nodeId: "B", pinId: "B-out" }] },
              { id: "A-out", name: "Output", direction: "output", links: [] },
            ],
          },
        ],
        [
          "B",
          {
            id: "B",
            expressionClass: "MaterialExpressionAdd",
            kind: "expression",
            properties: new Map(),
            startLine: 2,
            pins: [
              { id: "B-in", name: "A", direction: "input", links: [{ nodeId: "A", pinId: "A-out" }] },
              { id: "B-out", name: "Output", direction: "output", links: [] },
            ],
          },
        ],
      ]),
      outputs: [{
        id: "out",
        label: "Result",
        ownerNodeId: "A",
        ownerPinId: "A-out",
        sourceNodeId: "A",
        sourcePinId: "A-out",
      }],
      diagnostics: [],
    };

    expect(sliceOutput(graph, "out").diagnostics).toEqual([
      expect.objectContaining({ code: "graph-cycle" }),
    ]);
  });

  it("prunes inactive static-switch branches and applies user overrides", () => {
    const node = (
      id: string,
      expressionClass: string,
      pins: GraphNode["pins"],
      displayName?: string,
    ) => ({ id, expressionClass, kind: "expression" as const, properties: new Map(), pins, startLine: 1, displayName });
    const condition = node("Condition", "MaterialExpressionStaticBool", [
      { id: "ConditionValue", name: "Value", direction: "input", defaultValue: "false", links: [] },
      { id: "ConditionOut", name: "Output", direction: "output", links: [] },
    ]);
    const fallback = node("Fallback", "MaterialExpressionConstant", [
      { id: "FallbackOut", name: "Output", direction: "output", links: [] },
    ]);
    const loop = node("Loop", "MaterialExpressionAdd", [
      { id: "LoopIn", name: "A", direction: "input", links: [{ nodeId: "Switch", pinId: "SwitchOut" }] },
      { id: "LoopOut", name: "Output", direction: "output", links: [] },
    ]);
    const switchNode = node("Switch", "MaterialExpressionStaticSwitch", [
      { id: "SwitchTrue", name: "True", direction: "input", links: [{ nodeId: "Loop", pinId: "LoopOut" }] },
      { id: "SwitchFalse", name: "False", direction: "input", links: [{ nodeId: "Fallback", pinId: "FallbackOut" }] },
      { id: "SwitchValue", name: "Value", direction: "input", links: [{ nodeId: "Condition", pinId: "ConditionOut" }] },
      { id: "SwitchOut", name: "Output", direction: "output", links: [] },
    ]);
    const graph: MaterialGraph = {
      nodes: new Map([condition, fallback, loop, switchNode].map((item) => [item.id, item])),
      outputs: [{
        id: "out",
        label: "Result",
        ownerNodeId: "Output",
        ownerPinId: "Input",
        sourceNodeId: "Switch",
        sourcePinId: "SwitchOut",
      }],
      diagnostics: [],
    };

    const defaultSlice = sliceOutput(graph, "out");
    expect(defaultSlice.staticSwitches).toEqual([
      expect.objectContaining({ value: false, resolved: true }),
    ]);
    expect(defaultSlice.nodeIds.has("Fallback")).toBe(true);
    expect(defaultSlice.nodeIds.has("Loop")).toBe(false);
    expect(defaultSlice.diagnostics).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "graph-cycle" })]),
    );

    const overridden = sliceOutput(
      graph,
      "out",
      new Map([[defaultSlice.staticSwitches[0].id, true]]),
    );
    expect(overridden.staticSwitches[0].value).toBe(true);
    expect(overridden.nodeIds.has("Loop")).toBe(true);
    expect(overridden.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "graph-cycle" })]),
    );
  });

  sampleIt("connects Named Reroute usages to their declarations", () => {
    const source = readFileSync(
      resolve(
        "samples/MF_ResolveCoordinateFrame_Biplanar_Dither/MF_ResolveCoordinateFrame_Biplanar_Dither_full_clipboard.txt",
      ),
      "utf8",
    );

    const graph = resolveGraph(parseClipboard(source));
    const usage = [...graph.nodes.values()].find(
      (node) => node.expressionClass === "MaterialExpressionNamedRerouteUsage",
    )!;
    const declaration = [...graph.nodes.values()].find(
      (node) =>
        node.expressionClass === "MaterialExpressionNamedRerouteDeclaration" &&
        node.properties.get("VariableGuid") === usage.properties.get("DeclarationGuid"),
    )!;

    expect(declaration).toBeDefined();
    expect(usage.pins.find((pin) => pin.direction === "input")?.links[0]?.nodeId).toBe(
      declaration.id,
    );
  });

  it("preserves nested comment regions from outermost to innermost", () => {
    const node = (id: string, expressionClass: string, properties: [string, string][]): GraphNode => ({
      id,
      expressionClass,
      kind: "expression",
      properties: new Map(properties),
      pins: [],
      startLine: 1,
    });
    const outer = node("Outer", "MaterialExpressionComment", [
      ["Text", "Outer stage"],
      ["MaterialExpressionEditorX", "0"],
      ["MaterialExpressionEditorY", "0"],
      ["SizeX", "500"],
      ["SizeY", "500"],
    ]);
    const inner = node("Inner", "MaterialExpressionComment", [
      ["Text", "Inner detail"],
      ["MaterialExpressionEditorX", "100"],
      ["MaterialExpressionEditorY", "100"],
      ["SizeX", "200"],
      ["SizeY", "200"],
    ]);
    const value = node("Value", "MaterialExpressionAdd", [
      ["MaterialExpressionEditorX", "150"],
      ["MaterialExpressionEditorY", "150"],
    ]);
    const nodes = new Map([outer, inner, value].map((item) => [item.id, item]));

    assignCommentRegions(nodes);

    expect(value.commentRegions?.map((region) => region.text)).toEqual([
      "Outer stage",
      "Inner detail",
    ]);
  });
});
