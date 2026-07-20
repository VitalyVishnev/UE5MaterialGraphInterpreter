import { parseClipboard } from "./clipboard/parser";
import type { Diagnostic } from "./clipboard/raw-types";
import { materialTypeOptions, type MaterialType } from "./graph/material-types";
import { isTerminalExpression } from "./graph/expression-semantics";
import { resolveGraph } from "./graph/resolve";
import type { StaticSwitchControl } from "./graph/slice";
import type { GraphOutput } from "./graph/types";
import {
  defaultPseudoHlslOptions,
  generateAllPseudoHlsl,
  generatePseudoHlsl,
  type PseudoHlslOptions,
  type EditableSymbol,
  type TypeOverrideGroup,
} from "./pseudo-hlsl/generate";

export const ALL_OUTPUTS_ID = "__all_outputs__";
export { materialTypeOptions };
export type { MaterialType };

export type AnalysisFormatting = PseudoHlslOptions;
export const defaultAnalysisFormatting: AnalysisFormatting = defaultPseudoHlslOptions;

export interface AnalysisRequest {
  outputId?: string;
  typeOverrides?: ReadonlyMap<string, MaterialType>;
  staticSwitchOverrides?: ReadonlyMap<string, boolean>;
  nameOverrides?: ReadonlyMap<string, string>;
  formatting?: AnalysisFormatting;
}

export interface AnalysisResult {
  outputs: Pick<GraphOutput, "id" | "label">[];
  selectedOutputId?: string;
  code: string;
  diagnostics: Diagnostic[];
  typeOverrideGroups: TypeOverrideGroup[];
  staticSwitches: StaticSwitchControl[];
  editableSymbols: EditableSymbol[];
  nodeCount: number;
}

export function analyzeClipboard(
  source: string,
  request: AnalysisRequest = {},
): AnalysisResult {
  const {
    outputId: requestedOutputId,
    typeOverrides = new Map(),
    staticSwitchOverrides = new Map(),
    nameOverrides = new Map(),
    formatting = defaultAnalysisFormatting,
  } = request;
  const graph = resolveGraph(parseClipboard(source));
  if (graph.outputs.length === 0) {
    return {
      outputs: [],
      code: "",
      diagnostics: graph.diagnostics,
      typeOverrideGroups: [],
      staticSwitches: [],
      editableSymbols: [],
      nodeCount: graph.nodes.size,
    };
  }

  const sharedOwner = graph.nodes.get(graph.outputs[0].ownerNodeId);
  const hasAllOutputs = graph.outputs.length > 1 && (
    graph.outputs.every((output) => graph.nodes.get(output.ownerNodeId)?.kind === "function-output") ||
    Boolean(sharedOwner && isTerminalExpression(sharedOwner) && graph.outputs.every(
      (output) => output.ownerNodeId === sharedOwner.id,
    ))
  );
  const selectedOutputId = requestedOutputId === ALL_OUTPUTS_ID && hasAllOutputs
    ? ALL_OUTPUTS_ID
    : graph.outputs.some((output) => output.id === requestedOutputId)
      ? requestedOutputId!
      : hasAllOutputs
        ? ALL_OUTPUTS_ID
        : graph.outputs[0].id;
  const generated = selectedOutputId === ALL_OUTPUTS_ID
    ? generateAllPseudoHlsl(graph, typeOverrides, formatting, staticSwitchOverrides, nameOverrides)
    : generatePseudoHlsl(graph, selectedOutputId, typeOverrides, formatting, staticSwitchOverrides, nameOverrides);
  const outputs = graph.outputs.map(({ id, label }) => ({ id, label }));
  if (hasAllOutputs) outputs.unshift({ id: ALL_OUTPUTS_ID, label: "All outputs" });
  return {
    outputs,
    selectedOutputId,
    code: generated.code,
    diagnostics: generated.diagnostics,
    typeOverrideGroups: generated.typeOverrideGroups,
    staticSwitches: generated.staticSwitches,
    editableSymbols: generated.editableSymbols,
    nodeCount: graph.nodes.size,
  };
}
