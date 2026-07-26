import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  ALL_OUTPUTS_ID,
  analyzeClipboard,
  createAnalysisWorkspace,
  defaultAnalysisFormatting,
} from "../src/analyze";
import { parseClipboard } from "../src/clipboard/parser";
import { resolveGraph } from "../src/graph/resolve";

const fixture = (name: string): string => readFileSync(
  fileURLToPath(new URL(`./public-fixtures/${name}`, import.meta.url)),
  "utf8",
);

describe("public synthetic clipboard corpus", () => {
  it("parses every complete fixture without structural errors", () => {
    for (const name of [
      "material-root-all-outputs.clipboard.txt",
      "function-call-root.clipboard.txt",
      "function-definition.clipboard.txt",
      "static-switch.clipboard.txt",
      "named-reroute.clipboard.txt",
      "convert-swizzle.clipboard.txt",
      "custom-chain.clipboard.txt",
    ]) {
      expect(parseClipboard(fixture(name)).diagnostics, name).toEqual([]);
    }
  });

  it("covers material roots, static selection, Convert, and Custom type propagation", () => {
    const root = analyzeClipboard(fixture("material-root-all-outputs.clipboard.txt"));
    expect(root.selectedOutputId).toBe(ALL_OUTPUTS_ID);
    expect(root.code).toContain("return GraphOutputs");

    const switched = analyzeClipboard(fixture("static-switch.clipboard.txt"));
    expect(switched.staticSwitches).toEqual([expect.objectContaining({ value: true, resolved: true })]);
    expect(switched.code).toContain("float Selected = 1.0;");
    expect(switched.code).not.toContain("2.0");

    const convert = analyzeClipboard(fixture("convert-swizzle.clipboard.txt"));
    expect(convert.code).toContain("return InputUV.gr;");

    const custom = analyzeClipboard(fixture("custom-chain.clipboard.txt"), {
      formatting: { ...defaultAnalysisFormatting, expandCustomNodes: true },
    });
    expect(custom.code).toContain("float3 Value = Source;");
    expect(custom.typeOverrideGroups.filter(({ kind }) => kind === "custom-node")).toEqual([]);
  });

  it("covers stable Function Library validation and Named Reroute reconstruction", () => {
    const target = "MaterialFunction'\"/Public/MF_PublicValue.MF_PublicValue\"'";
    const workspace = createAnalysisWorkspace(
      fixture("function-call-root.clipboard.txt"),
      new Map([[target, fixture("function-definition.clipboard.txt")]]),
    );
    const functionResult = workspace.analyze();
    expect(functionResult.functionTree[0]).toMatchObject({ status: "defined", callCount: 1 });
    expect(functionResult.code).toContain("float MF_PublicValue()");

    const reroute = resolveGraph(parseClipboard(fixture("named-reroute.clipboard.txt")));
    const usage = [...reroute.nodes.values()].find(
      ({ expressionClass }) => expressionClass === "MaterialExpressionNamedRerouteUsage",
    )!;
    expect(usage.pins.find(({ direction }) => direction === "input")?.links[0]?.nodeId)
      .toBe("PublicDeclaration");
  });

  it("reports a bounded parser error for a physically truncated clipboard", () => {
    expect(parseClipboard(fixture("truncated-object.clipboard.txt")).diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "incomplete-object", severity: "error" })]),
    );
  });
});
