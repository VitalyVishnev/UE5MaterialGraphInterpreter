import { describe, expect, it } from "vitest";
import {
  ALL_OUTPUTS_ID,
  createAnalysisWorkspace,
} from "../src/analyze";
import { parseClipboard } from "../src/clipboard/parser";
import { compileFunctionLibrary } from "../src/functions/library";
import { resolveGraph } from "../src/graph/resolve";

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
    expect(result.code).toContain("// Material Function definitions");
    expect(result.code).toContain("float MF_Value()");
    expect(result.code).toContain("return");
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
      ...[["A", outputA, "1.0", "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC1", "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD1"],
        ["B", outputB, "2.0", "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC2", "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD2"]]
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
    ].join("\n");
    const workspace = createAnalysisWorkspace(root, new Map([[target, definition]]));

    expect(workspace.analyze().code).toContain("void MF_Two(out float A, out float B)");
    const strict = workspace.analyze({
      formatting: {
        bundleFormat: "strict",
        commentSections: true,
        expandCustomNodes: false,
        multilineCalls: true,
        spaceComplexOperations: true,
        simplifyAlgebra: false,
      },
    }).code;
    expect(strict).toContain("struct MF_TwoOutputs");
    expect(strict).toContain("MF_TwoOutputs MF_Two()");
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
      ...[["A", "1.0", "EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE2"],
        ["B", "2.0", "EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE3"]]
        .flatMap(([name, value, switchPin], index) => [
          `Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="${name}"`,
          `Begin Object Class=/Script/Engine.MaterialExpressionConstant Name="${name}Expression"`,
          "End Object",
          `Begin Object Name="${name}Expression"`,
          `R=${value}`,
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

    expect(control.id).toContain("::group:1::");
    expect(control).toMatchObject({ value: true, resolved: true });
    expect(workspace.analyze({
      staticSwitchOverrides: new Map([[control.id, false]]),
    }).code).toContain("MF_Switch(false)");
    expect(workspace.analyze({
      functionMode: "inline",
      staticSwitchOverrides: new Map([[control.id, false]]),
    }).code).toContain("2.0");
  });
});
