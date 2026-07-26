import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALL_OUTPUTS_ID,
  createAnalysisWorkspace,
} from "../src/analyze";
import { functionOutputId } from "../src/pseudo-hlsl/generate";
import { parseClipboard } from "../src/clipboard/parser";
import { compileFunctionLibrary } from "../src/functions/library";
import { resolveGraph } from "../src/graph/resolve";

const sampleIt = existsSync(resolve("samples")) ? it : it.skip;

const TARGET = "MaterialFunction'\"/Project/MF_Value.MF_Value\"'";
const OUTPUT_ID = "11111111111111111111111111111111";
const NESTED_TARGET = "MaterialFunction'\"/Project/MF_Nested.MF_Nested\"'";
const NESTED_OUTPUT_ID = "33333333333333333333333333333333";

function rootClipboard(): string {
  return [
    'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Call"',
    'Begin Object Class=/Script/Engine.MaterialExpressionMaterialFunctionCall Name="CallExpression"',
    "End Object",
    'Begin Object Name="CallExpression"',
    `MaterialFunction=${TARGET}`,
    `FunctionOutputs(0)=(ExpressionOutputId=${OUTPUT_ID},Output=(OutputName="Value"))`,
    "End Object",
    `CustomProperties Pin (PinId=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,PinName="Value",Direction="EGPD_Output",LinkedTo=(Output BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB))`,
    "End Object",
    'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Output"',
    'Begin Object Class=/Script/Engine.MaterialExpressionFunctionOutput Name="OutputExpression"',
    "End Object",
    'Begin Object Name="OutputExpression"',
    'OutputName="Result"',
    "Id=22222222222222222222222222222222",
    "End Object",
    'CustomProperties Pin (PinId=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB,PinName="Input",LinkedTo=(Call AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA))',
    "End Object",
  ].join("\n");
}

function definitionClipboard(outputId = OUTPUT_ID): string {
  return [
    'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Constant"',
    'Begin Object Class=/Script/Engine.MaterialExpressionConstant Name="ConstantExpression"',
    "End Object",
    'Begin Object Name="ConstantExpression"',
    "R=3.0",
    "End Object",
    'CustomProperties Pin (PinId=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC,PinName="Output",Direction="EGPD_Output",LinkedTo=(FunctionOutput DDDDDDDDDDDDDDDDDDDDDDDDDDDDDD))',
    "End Object",
    'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="FunctionOutput"',
    'Begin Object Class=/Script/Engine.MaterialExpressionFunctionOutput Name="FunctionOutputExpression"',
    "End Object",
    'Begin Object Name="FunctionOutputExpression"',
    'OutputName="Value"',
    `Id=${outputId}`,
    "End Object",
    'CustomProperties Pin (PinId=DDDDDDDDDDDDDDDDDDDDDDDDDDDDDD,PinName="Input",LinkedTo=(Constant CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC))',
    "End Object",
  ].join("\n");
}

function unresolvedDefinitionClipboard(): string {
  return [
    'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Mystery"',
    'Begin Object Class=/Script/Engine.MaterialExpressionMystery Name="MysteryExpression"',
    "End Object",
    'Begin Object Name="MysteryExpression"',
    'Description="innerValue"',
    "End Object",
    "NodeGuid=ABCDEFABCDEFABCDEFABCDEFABCDEFAB",
    'CustomProperties Pin (PinId=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC,PinName="Output",Direction="EGPD_Output",LinkedTo=(FunctionOutput DDDDDDDDDDDDDDDDDDDDDDDDDDDDDD))',
    "End Object",
    'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="FunctionOutput"',
    'Begin Object Class=/Script/Engine.MaterialExpressionFunctionOutput Name="FunctionOutputExpression"',
    "End Object",
    'Begin Object Name="FunctionOutputExpression"',
    'OutputName="Value"',
    `Id=${OUTPUT_ID}`,
    "End Object",
    'CustomProperties Pin (PinId=DDDDDDDDDDDDDDDDDDDDDDDDDDDDDD,PinName="Input",LinkedTo=(Mystery CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC))',
    "End Object",
  ].join("\n");
}

function defaultedArithmeticDefinitionClipboard(): string {
  return [
    'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Constant"',
    'Begin Object Class=/Script/Engine.MaterialExpressionConstant Name="ConstantExpression"',
    "End Object", 'Begin Object Name="ConstantExpression"', "R=2.0", "End Object",
    'CustomProperties Pin (PinId=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC,PinName="Output",Direction="EGPD_Output",LinkedTo=(Multiply DDDDDDDDDDDDDDDDDDDDDDDDDDDDDD))',
    "End Object",
    'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Multiply"',
    'Begin Object Class=/Script/Engine.MaterialExpressionMultiply Name="MultiplyExpression"',
    "End Object", 'Begin Object Name="MultiplyExpression"', "ConstB=0.5", "End Object",
    'CustomProperties Pin (PinId=DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD,PinName="A",LinkedTo=(Constant CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC))',
    'CustomProperties Pin (PinId=EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE,PinName="B",DefaultValue="0.5")',
    'CustomProperties Pin (PinId=FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF,PinName="Output",Direction="EGPD_Output",LinkedTo=(Frac 12121212121212121212121212121212))',
    "End Object",
    'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Frac"',
    'Begin Object Class=/Script/Engine.MaterialExpressionFrac Name="FracExpression"',
    "End Object", 'Begin Object Name="FracExpression"', "End Object",
    'CustomProperties Pin (PinId=12121212121212121212121212121212,PinName="Input",LinkedTo=(Multiply FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF))',
    'CustomProperties Pin (PinId=13131313131313131313131313131313,PinName="Output",Direction="EGPD_Output",LinkedTo=(FunctionOutput DDDDDDDDDDDDDDDDDDDDDDDDDDDDDD))',
    "End Object",
    'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="FunctionOutput"',
    'Begin Object Class=/Script/Engine.MaterialExpressionFunctionOutput Name="FunctionOutputExpression"',
    "End Object", 'Begin Object Name="FunctionOutputExpression"',
    'OutputName="Value"', `Id=${OUTPUT_ID}`, "End Object",
    'CustomProperties Pin (PinId=DDDDDDDDDDDDDDDDDDDDDDDDDDDDDD,PinName="Input",LinkedTo=(Frac 13131313131313131313131313131313))',
    "End Object",
  ].join("\n");
}

function forwardingDefinition(): string {
  return [
    'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="NestedCall"',
    'Begin Object Class=/Script/Engine.MaterialExpressionMaterialFunctionCall Name="NestedCallExpression"',
    "End Object",
    'Begin Object Name="NestedCallExpression"',
    `MaterialFunction=${NESTED_TARGET}`,
    `FunctionOutputs(0)=(ExpressionOutputId=${NESTED_OUTPUT_ID},Output=(OutputName="NestedValue"))`,
    "End Object",
    'CustomProperties Pin (PinId=EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE,PinName="NestedValue",Direction="EGPD_Output",LinkedTo=(FunctionOutput DDDDDDDDDDDDDDDDDDDDDDDDDDDDDD))',
    "End Object",
    'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="FunctionOutput"',
    'Begin Object Class=/Script/Engine.MaterialExpressionFunctionOutput Name="FunctionOutputExpression"',
    "End Object",
    'Begin Object Name="FunctionOutputExpression"',
    'OutputName="Value"',
    `Id=${OUTPUT_ID}`,
    "End Object",
    'CustomProperties Pin (PinId=DDDDDDDDDDDDDDDDDDDDDDDDDDDDDD,PinName="Input",LinkedTo=(NestedCall EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE))',
    "End Object",
  ].join("\n");
}

function cyclicNestedDefinition(): string {
  return forwardingDefinition()
    .replaceAll(NESTED_TARGET, TARGET)
    .replaceAll(NESTED_OUTPUT_ID, OUTPUT_ID)
    .replace(`\nId=${OUTPUT_ID}`, `\nId=${NESTED_OUTPUT_ID}`);
}

describe("Function Definition Library", () => {
  sampleIt("derives UV outputs through the loaded MF_Rotate2D dependency", () => {
    const sample = "samples/MF_ResolveCoordinateFrame_Biplanar_Dither";
    const definitionSources = new Map([
      ["/Script/Engine.MaterialFunction'/BaseMaterial/Materials/Functions/MF_Coordinate_Biplanar.MF_Coordinate_Biplanar'", "01_MF_Coordinate_Biplanar/MF_Coordinate_Biplanar_clipboard.txt"],
      ["/Script/Engine.MaterialFunction'/BaseMaterial/Materials/Functions/MF_Rotate2D.MF_Rotate2D'", "02_MF_Rotate2D/MF_Rotate2D_clipboard.txt"],
    ].map(([target, path]) => [target, readFileSync(resolve(sample, "functions", path), "utf8")]));
    const root = readFileSync(resolve(sample, "MF_ResolveCoordinateFrame_Biplanar_Dither_full_clipboard.txt"), "utf8");
    const result = createAnalysisWorkspace(root, definitionSources).analyze();
    const find = (nodes: typeof result.functionTree): typeof result.functionTree[number] | undefined => {
      for (const node of nodes) {
        if (node.name === "MF_Coordinate_Biplanar") return node;
        const child = find(node.children);
        if (child) return child;
      }
      return undefined;
    };

    expect(find(result.functionTree)?.outputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "UV1", type: "float2" }),
      expect.objectContaining({ name: "UV2", type: "float2" }),
    ]));
    const incomplete = createAnalysisWorkspace(
      root,
      new Map([[...definitionSources][0]]),
    ).analyze();
    const missingUV1 = find(incomplete.functionTree)?.outputs.find(({ name }) => name === "UV1");
    expect(missingUV1?.unresolvedDependencies).toEqual(["MF_Rotate2D"]);
  });

  it("validates exact output IDs and renders a reachable helper", () => {
    const workspace = createAnalysisWorkspace(
      rootClipboard(),
      new Map([[TARGET, definitionClipboard()]]),
    );
    const result = workspace.analyze();

    expect(result.functionTree[0]).toMatchObject({
      target: TARGET,
      status: "defined",
      callCount: 1,
    });
    expect(result.functionTree[0].outputs[0].id).toBe(functionOutputId(TARGET, OUTPUT_ID));
    expect(result.code).toContain("// Material Function definitions");
    expect(result.code).toContain("float MF_Value()");
    expect(result.code).toContain("return");
  });

  it("propagates a numeric type through unconnected arithmetic defaults", () => {
    const result = createAnalysisWorkspace(
      rootClipboard(),
      new Map([[TARGET, defaultedArithmeticDefinitionClipboard()]]),
    ).analyze();

    expect(result.code).toContain("float MF_Value()");
    expect(result.code).not.toContain("?type MF_Value");
  });

  it("rejects a definition whose stable output ID differs", () => {
    const result = createAnalysisWorkspace(
      rootClipboard(),
      new Map([[TARGET, definitionClipboard("99999999999999999999999999999999")]]),
    ).analyze();

    expect(result.functionTree[0].status).toBe("invalid");
    expect(result.functionTree[0].error).toContain("Outputs");
    expect(result.functionTree[0].error).toContain("missing");
    expect(result.functionTree[0].error).toContain("extra");
    expect(result.code).not.toContain("// Material Function definitions");
  });

  it("rejects a definition missing a stable input ID", () => {
    const source = rootClipboard().replace(
      `FunctionOutputs(0)=`,
      `FunctionInputs(0)=(ExpressionInputId=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,Input=(InputName="Required"))\nFunctionOutputs(0)=`,
    );
    const result = createAnalysisWorkspace(
      source,
      new Map([[TARGET, definitionClipboard()]]),
    ).analyze();

    expect(result.functionTree[0]).toMatchObject({ status: "invalid" });
    expect(result.functionTree[0].error).toContain("Inputs: missing Required");
  });

  it("keeps calls in types mode and replaces them in inline mode", () => {
    const workspace = createAnalysisWorkspace(
      rootClipboard(),
      new Map([[TARGET, definitionClipboard()]]),
    );

    expect(workspace.analyze({ functionMode: "types" }).code).toContain("MF_Value()");
    expect(workspace.analyze({ functionMode: "inline" }).code).not.toContain("MF_Value()");
  });

  it("exposes and applies a manual type for any unresolved inline declaration", () => {
    const workspace = createAnalysisWorkspace(
      rootClipboard(),
      new Map([[TARGET, unresolvedDefinitionClipboard()]]),
    );
    const initial = workspace.analyze({ functionMode: "inline" });
    const symbol = initial.editableSymbols.find(({ name }) => name === "innerValue");

    expect(initial.code).toContain("?type innerValue");
    expect(symbol?.typeOverride).toMatchObject({ status: "unknown" });

    const overridden = workspace.analyze({
      functionMode: "inline",
      typeOverrides: new Map([[symbol!.typeOverride!.id, "float3"]]),
    });

    expect(overridden.code).toContain("float3 innerValue");
    expect(overridden.editableSymbols.find(({ name }) => name === "innerValue")?.typeOverride)
      .toMatchObject({ type: "float3", status: "overridden" });
  });

  it("keeps helper symbols scoped and applies their name overrides", () => {
    const workspace = createAnalysisWorkspace(
      rootClipboard(),
      new Map([[TARGET, unresolvedDefinitionClipboard()]]),
    );
    const initial = workspace.analyze({ functionMode: "helpers" });
    const symbol = initial.editableSymbols.find(({ name }) => name === "Value");

    expect(symbol).toMatchObject({
      name: "Value",
      startLine: expect.any(Number),
      endLine: expect.any(Number),
    });

    const renamed = workspace.analyze({
      functionMode: "helpers",
      nameOverrides: new Map([[symbol!.id, "helperValue"]]),
    });

    expect(renamed.code).toContain("?type helperValue");
    expect(renamed.code).not.toContain("?type Value");
  });

  it("namespaces repeated inline calls independently", () => {
    const secondCall = rootClipboard()
      .replaceAll('Name="Call"', 'Name="Call2"')
      .replaceAll('Name="CallExpression"', 'Name="CallExpression2"')
      .replaceAll('Name="Output"', 'Name="Output2"')
      .replaceAll('Name="OutputExpression"', 'Name="OutputExpression2"')
      .replaceAll("LinkedTo=(Call ", "LinkedTo=(Call2 ")
      .replaceAll("LinkedTo=(Output ", "LinkedTo=(Output2 ")
      .replaceAll("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE")
      .replaceAll("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")
      .replaceAll("22222222222222222222222222222222", "44444444444444444444444444444444");
    const graph = resolveGraph(parseClipboard(`${rootClipboard()}\n${secondCall}`));
    const library = compileFunctionLibrary(graph, new Map([[TARGET, definitionClipboard()]]));
    const expanded = library.expand(graph, "inline", new Map(), new Map(), true).graph;

    expect(expanded.nodes.has("Call__Constant")).toBe(true);
    expect(expanded.nodes.has("Call2__Constant")).toBe(true);
  });

  it("orders nested helpers dependency-first and recursively inlines them", () => {
    const workspace = createAnalysisWorkspace(
      rootClipboard(),
      new Map([
        [TARGET, forwardingDefinition()],
        [NESTED_TARGET, definitionClipboard(NESTED_OUTPUT_ID)],
      ]),
    );
    const helperCode = workspace.analyze().code;

    expect(workspace.analyze().functionTree[0].children[0]).toMatchObject({
      target: NESTED_TARGET,
      status: "defined",
    });
    expect(helperCode.indexOf("float MF_Nested()")).toBeLessThan(
      helperCode.indexOf("float MF_Value()"),
    );
    expect(workspace.analyze({ functionMode: "inline" }).code).not.toMatch(/MF_(?:Value|Nested)\(\)/);
  });

  it("marks definition cycles and leaves the recursive edge opaque", () => {
    const workspace = createAnalysisWorkspace(
      rootClipboard(),
      new Map([
        [TARGET, forwardingDefinition()],
        [NESTED_TARGET, cyclicNestedDefinition()],
      ]),
    );
    const result = workspace.analyze({ functionMode: "inline" });

    expect(result.functionTree[0].children[0].children[0]).toMatchObject({
      target: TARGET,
      cycle: true,
      shared: true,
    });
    expect(result.diagnostics.some(({ code }) => code === "function-definition-cycle")).toBe(true);
    expect(workspace.analyze({ functionMode: "types" }).diagnostics.some(
      ({ code }) => code === "function-definition-cycle",
    )).toBe(true);
  });

  it("uses out parameters or a struct for loaded multi-output helpers", () => {
    const target = "MaterialFunction'\"/Project/MF_Two.MF_Two\"'";
    const outputA = "44444444444444444444444444444444";
    const outputB = "55555555555555555555555555555555";
    const root = [
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Call"',
      'Begin Object Class=/Script/Engine.MaterialExpressionMaterialFunctionCall Name="CE"',
      "End Object",
      'Begin Object Name="CE"',
      `MaterialFunction=${target}`,
      `FunctionOutputs(0)=(ExpressionOutputId=${outputA},Output=(OutputName="A"))`,
      `FunctionOutputs(1)=(ExpressionOutputId=${outputB},Output=(OutputName="B"))`,
      "End Object",
      'CustomProperties Pin (PinId=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1,PinName="A",Direction="EGPD_Output",LinkedTo=(OA BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB1))',
      'CustomProperties Pin (PinId=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2,PinName="B",Direction="EGPD_Output",LinkedTo=(OB BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB2))',
      "End Object",
      ...["A", "B"].flatMap((name, index) => [
        `Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="O${name}"`,
        `Begin Object Class=/Script/Engine.MaterialExpressionFunctionOutput Name="OE${name}"`,
        "End Object",
        `Begin Object Name="OE${name}"`,
        `OutputName="${name}"`,
        `Id=${index ? "77777777777777777777777777777777" : "66666666666666666666666666666666"}`,
        "End Object",
        `CustomProperties Pin (PinId=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB${index + 1},PinName="Input",LinkedTo=(Call AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA${index + 1}))`,
        "End Object",
      ]),
    ].join("\n");
    const definition = [
      ...[["A", outputA, "1.0", "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC1", "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD1"]]
        .flatMap(([name, id, value, constantPin, outputPin], index) => [
          `Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="C${index}"`,
          `Begin Object Class=/Script/Engine.MaterialExpressionConstant Name="CE${index}"`,
          "End Object",
          `Begin Object Name="CE${index}"`,
          `R=${value}`,
          "End Object",
          `CustomProperties Pin (PinId=${constantPin},PinName="Output",Direction="EGPD_Output",LinkedTo=(FO${index} ${outputPin}))`,
          "End Object",
          `Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="FO${index}"`,
          `Begin Object Class=/Script/Engine.MaterialExpressionFunctionOutput Name="FOE${index}"`,
          "End Object",
          `Begin Object Name="FOE${index}"`,
          `OutputName="${name}"`,
          `Id=${id}`,
          "End Object",
          `CustomProperties Pin (PinId=${outputPin},PinName="Input",LinkedTo=(C${index} ${constantPin}))`,
          "End Object",
        ]),
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Lerp"',
      'Begin Object Class=/Script/Engine.MaterialExpressionLinearInterpolate Name="LerpExpression"',
      "End Object",
      'Begin Object Name="LerpExpression"',
      "ConstA=1.0",
      "ConstB=2.0",
      "ConstAlpha=0.5",
      'Description="B"',
      "End Object",
      'CustomProperties Pin (PinId=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC2,PinName="A",DefaultValue="1.0")',
      'CustomProperties Pin (PinId=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC3,PinName="B",DefaultValue="2.0")',
      'CustomProperties Pin (PinId=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC4,PinName="Alpha",DefaultValue="0.5")',
      'CustomProperties Pin (PinId=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC5,PinName="Output",Direction="EGPD_Output",LinkedTo=(FOB DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD2))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="FOB"',
      'Begin Object Class=/Script/Engine.MaterialExpressionFunctionOutput Name="FOBE"',
      "End Object",
      'Begin Object Name="FOBE"',
      'OutputName="B"',
      `Id=${outputB}`,
      "End Object",
      'CustomProperties Pin (PinId=DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD2,PinName="Input",LinkedTo=(Lerp CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC5))',
      "End Object",
    ].join("\n");
    const workspace = createAnalysisWorkspace(root, new Map([[target, definition]]));

    expect(workspace.analyze().code).toContain("void MF_Two(out float A, out float B)");
    expect(workspace.analyze().code).toContain("A = 1.0;");
    expect(workspace.analyze().code).not.toContain("float A = 1.0;");
    expect(workspace.analyze().code).not.toContain("A = A;");
    expect(workspace.analyze().code).toContain("B = lerp(\n");
    expect(workspace.analyze().code).not.toContain("float B = lerp(");
    const strict = workspace.analyze({
      formatting: {
        bundleFormat: "strict",
        commentSections: true,
        expandCustomNodes: false,
        multilineCalls: true,
        ifElseStatements: false,
        spaceComplexOperations: true,
        simplifyAlgebra: false,
      },
    }).code;
    expect(strict).toContain("struct MF_TwoOutputs");
    expect(strict).toContain("MF_TwoOutputs MF_Two()");
  });

  it("orders helper parameters and call arguments by stable input IDs", () => {
    const target = "MaterialFunction'\"/Project/MF_Inputs.MF_Inputs\"'";
    const scalarId = "11111111111111111111111111111111";
    const vectorId = "22222222222222222222222222222222";
    const outputId = "33333333333333333333333333333333";
    const root = [
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Scalar"',
      'Begin Object Class=/Script/Engine.MaterialExpressionConstant Name="ScalarExpression"',
      "End Object", 'Begin Object Name="ScalarExpression"', "R=2.0", "End Object",
      'CustomProperties Pin (PinId=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1,PinName="Output",Direction="EGPD_Output",LinkedTo=(Call BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB2))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Vector"',
      'Begin Object Class=/Script/Engine.MaterialExpressionConstant3Vector Name="VectorExpression"',
      "End Object", 'Begin Object Name="VectorExpression"', "Constant=(R=1.0,G=2.0,B=3.0)", "End Object",
      'CustomProperties Pin (PinId=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2,PinName="Output",Direction="EGPD_Output",LinkedTo=(Call BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB1))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Call"',
      'Begin Object Class=/Script/Engine.MaterialExpressionMaterialFunctionCall Name="CallExpression"',
      "End Object", 'Begin Object Name="CallExpression"',
      `MaterialFunction=${target}`,
      `FunctionInputs(0)=(ExpressionInputId=${scalarId},Input=(InputName="Scalar"))`,
      `FunctionInputs(1)=(ExpressionInputId=${vectorId},Input=(InputName="Vector"))`,
      `FunctionOutputs(0)=(ExpressionOutputId=${outputId},Output=(OutputName="Value"))`,
      "End Object",
      'CustomProperties Pin (PinId=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB1,PinName="Vector",LinkedTo=(Vector AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2))',
      'CustomProperties Pin (PinId=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB2,PinName="Scalar",LinkedTo=(Scalar AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1))',
      'CustomProperties Pin (PinId=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB3,PinName="Value",Direction="EGPD_Output",LinkedTo=(Output CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Output"',
      'Begin Object Class=/Script/Engine.MaterialExpressionFunctionOutput Name="OutputExpression"',
      "End Object", 'Begin Object Name="OutputExpression"', 'OutputName="Result"',
      "Id=44444444444444444444444444444444", "End Object",
      'CustomProperties Pin (PinId=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC,PinName="Input",LinkedTo=(Call BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB3))',
      "End Object",
    ].join("\n");
    const definition = [
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="VectorInput"',
      'Begin Object Class=/Script/Engine.MaterialExpressionFunctionInput Name="VectorInputExpression"',
      "End Object", 'Begin Object Name="VectorInputExpression"', 'InputName="Vector"',
      `Id=${vectorId}`, "End Object",
      'CustomProperties Pin (PinId=DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD1,PinName="Output",Direction="EGPD_Output",LinkedTo=(Add EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE1))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="ScalarInput"',
      'Begin Object Class=/Script/Engine.MaterialExpressionFunctionInput Name="ScalarInputExpression"',
      "End Object", 'Begin Object Name="ScalarInputExpression"', 'InputName="Scalar"',
      `Id=${scalarId}`, "InputType=FunctionInput_Scalar", "End Object",
      'CustomProperties Pin (PinId=DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD2,PinName="Output",Direction="EGPD_Output",LinkedTo=(Add EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE2))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Add"',
      'Begin Object Class=/Script/Engine.MaterialExpressionAdd Name="AddExpression"',
      "End Object", 'Begin Object Name="AddExpression"', "End Object",
      'CustomProperties Pin (PinId=EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE1,PinName="A",LinkedTo=(VectorInput DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD1))',
      'CustomProperties Pin (PinId=EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE2,PinName="B",LinkedTo=(ScalarInput DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD2))',
      'CustomProperties Pin (PinId=EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE3,PinName="Output",Direction="EGPD_Output",LinkedTo=(FunctionOutput FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="FunctionOutput"',
      'Begin Object Class=/Script/Engine.MaterialExpressionFunctionOutput Name="FunctionOutputExpression"',
      "End Object", 'Begin Object Name="FunctionOutputExpression"', 'OutputName="Value"',
      `Id=${outputId}`, "End Object",
      'CustomProperties Pin (PinId=FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF,PinName="Input",LinkedTo=(Add EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE3))',
      "End Object",
    ].join("\n");

    const code = createAnalysisWorkspace(root, new Map([[target, definition]])).analyze().code;

    expect(code).toContain("float3 MF_Inputs(float Scalar, float3 Vector)");
    expect(code).toContain("MF_Inputs(2.0, float3(1.0, 2.0, 3.0))");
    expect(code).not.toContain("MF_Inputs(float3 Vector, float Scalar)");
  });

  it("offers All outputs for a multi-input Material Root", () => {
    const source = [
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode_Root Name="Root"',
      'CustomProperties Pin (PinId=11111111111111111111111111111111,PinName="Base Color",LinkedTo=(A AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA))',
      'CustomProperties Pin (PinId=22222222222222222222222222222222,PinName="Roughness",LinkedTo=(B BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="A"',
      'Begin Object Class=/Script/Engine.MaterialExpressionConstant Name="AE"',
      "End Object",
      'Begin Object Name="AE"',
      "R=1.0",
      "End Object",
      'CustomProperties Pin (PinId=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,PinName="Output",Direction="EGPD_Output",LinkedTo=(Root 11111111111111111111111111111111))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="B"',
      'Begin Object Class=/Script/Engine.MaterialExpressionConstant Name="BE"',
      "End Object",
      'Begin Object Name="BE"',
      "R=0.5",
      "End Object",
      'CustomProperties Pin (PinId=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB,PinName="Output",Direction="EGPD_Output",LinkedTo=(Root 22222222222222222222222222222222))',
      "End Object",
    ].join("\n");

    const result = createAnalysisWorkspace(source).analyze();
    expect(result.selectedOutputId).toBe(ALL_OUTPUTS_ID);
    expect(result.outputs[0]).toEqual({ id: ALL_OUTPUTS_ID, label: "All outputs" });
    expect(result.code).toContain("return GraphOutputs");
  });

  it("keeps Static Bool input overrides separate for each call site", () => {
    const target = "MaterialFunction'\"/Project/MF_Switch.MF_Switch\"'";
    const inputId = "88888888888888888888888888888888";
    const outputId = "99999999999999999999999999999999";
    const callGuid = "ABCDEFABCDEFABCDEFABCDEFABCDEFAB";
    const root = [
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Bool"',
      'Begin Object Class=/Script/Engine.MaterialExpressionStaticBool Name="BoolExpression"',
      "End Object",
      'Begin Object Name="BoolExpression"',
      "End Object",
      'CustomProperties Pin (PinId=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1,PinName="Value",DefaultValue=True)',
      'CustomProperties Pin (PinId=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2,PinName="Output",Direction="EGPD_Output",LinkedTo=(Call BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB1))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Call"',
      'Begin Object Class=/Script/Engine.MaterialExpressionMaterialFunctionCall Name="CallExpression"',
      "End Object",
      'Begin Object Name="CallExpression"',
      `MaterialFunction=${target}`,
      `FunctionInputs(0)=(ExpressionInputId=${inputId},Input=(InputName="Use A"))`,
      `FunctionOutputs(0)=(ExpressionOutputId=${outputId},Output=(OutputName="Value"))`,
      "End Object",
      `NodeGuid=${callGuid}`,
      'CustomProperties Pin (PinId=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB1,PinName="Use A",DefaultValue=True,LinkedTo=(Bool AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2))',
      'CustomProperties Pin (PinId=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB2,PinName="Value",Direction="EGPD_Output",LinkedTo=(Output CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Output"',
      'Begin Object Class=/Script/Engine.MaterialExpressionFunctionOutput Name="OutputExpression"',
      "End Object",
      'Begin Object Name="OutputExpression"',
      'OutputName="Result"',
      "Id=77777777777777777777777777777777",
      "End Object",
      'CustomProperties Pin (PinId=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC,PinName="Input",LinkedTo=(Call BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB2))',
      "End Object",
    ].join("\n");
    const definition = [
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="FunctionInput"',
      'Begin Object Class=/Script/Engine.MaterialExpressionFunctionInput Name="InputExpression"',
      "End Object",
      'Begin Object Name="InputExpression"',
      'InputName="Use A"',
      `Id=${inputId}`,
      "InputType=FunctionInput_StaticBool",
      "End Object",
      'CustomProperties Pin (PinId=DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD,PinName="Output",Direction="EGPD_Output",LinkedTo=(Switch EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE1))',
      "End Object",
      ...[["A", "float3(1.0, 2.0, 3.0)", "EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE2"],
        ["B", "2.0", "EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE3"]]
        .flatMap(([name, value, switchPin], index) => [
          `Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="${name}"`,
          `Begin Object Class=/Script/Engine.MaterialExpression${index ? "Constant" : "Constant3Vector"} Name="${name}Expression"`,
          "End Object",
          `Begin Object Name="${name}Expression"`,
          index ? `R=${value}` : "Constant=(R=1.0,G=2.0,B=3.0)",
          "End Object",
          `CustomProperties Pin (PinId=FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF${index + 1},PinName="Output",Direction="EGPD_Output",LinkedTo=(Switch ${switchPin}))`,
          "End Object",
        ]),
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="Switch"',
      'Begin Object Class=/Script/Engine.MaterialExpressionStaticSwitch Name="SwitchExpression"',
      "End Object",
      'Begin Object Name="SwitchExpression"',
      "End Object",
      'CustomProperties Pin (PinId=EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE1,PinName="Value",LinkedTo=(FunctionInput DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD))',
      'CustomProperties Pin (PinId=EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE2,PinName="True",LinkedTo=(A FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF1))',
      'CustomProperties Pin (PinId=EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE3,PinName="False",LinkedTo=(B FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF2))',
      'CustomProperties Pin (PinId=EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE4,PinName="Output",Direction="EGPD_Output",LinkedTo=(FunctionOutput 11111111111111111111111111111111))',
      "End Object",
      'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="FunctionOutput"',
      'Begin Object Class=/Script/Engine.MaterialExpressionFunctionOutput Name="FunctionOutputExpression"',
      "End Object",
      'Begin Object Name="FunctionOutputExpression"',
      'OutputName="Value"',
      `Id=${outputId}`,
      "End Object",
      'CustomProperties Pin (PinId=11111111111111111111111111111111,PinName="Input",LinkedTo=(Switch EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE4))',
      "End Object",
    ].join("\n");
    const workspace = createAnalysisWorkspace(root, new Map([[target, definition]]));
    const initial = workspace.analyze();
    const control = initial.functionTree[0].staticSwitches[0];

    expect(control.id).toContain(`${inputId}=true`);
    expect(control).toMatchObject({ value: true, resolved: true });
    expect(initial.code).toContain("float3 Result = MF_Switch__Use_A_True(");
    expect(workspace.analyze({
      staticSwitchOverrides: new Map([[control.id, false]]),
    }).code).toContain("float Result = MF_Switch__Use_A_False(");
    expect(workspace.analyze({
      functionMode: "inline",
      staticSwitchOverrides: new Map([[control.id, false]]),
    }).code).toContain("2.0");
  });
});
