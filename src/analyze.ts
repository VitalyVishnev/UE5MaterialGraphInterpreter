import { parseClipboard } from "./clipboard/parser";
import type { Diagnostic } from "./clipboard/raw-types";
import {
  declaredFunctionInputType,
  materialTypeOptions,
  type MaterialType,
} from "./graph/material-types";
import { isTerminalExpression } from "./graph/expression-semantics";
import { resolveGraph } from "./graph/resolve";
import { sliceOutputs, type StaticSwitchControl } from "./graph/slice";
import type { GraphOutput, MaterialGraph } from "./graph/types";
import {
  compileFunctionLibrary,
  type FunctionDependencyNode,
  type FunctionExpansionMode,
  type FunctionLibrary,
  type FunctionSpecialization,
} from "./functions/library";
import {
  defaultPseudoHlslOptions,
  functionCallId,
  functionOutputId,
  functionOutputSpecializationId,
  generateAllPseudoHlsl,
  generatePseudoHlsl,
  identifier,
  materialFunctionName,
  type PseudoHlslOptions,
  type EditableSymbol,
  type PseudoHlslResult,
  type TypeOverrideGroup,
  type TypeOverrideValue,
  type FunctionGenerationKnowledge,
} from "./pseudo-hlsl/generate";

export const ALL_OUTPUTS_ID = "__all_outputs__";
export { materialTypeOptions };
export type { MaterialType };
export type { FunctionDependencyNode, FunctionExpansionMode };

export type AnalysisFormatting = PseudoHlslOptions;
export const defaultAnalysisFormatting: AnalysisFormatting = defaultPseudoHlslOptions;

export interface AnalysisRequest {
  outputId?: string;
  typeOverrides?: ReadonlyMap<string, MaterialType>;
  staticSwitchOverrides?: ReadonlyMap<string, boolean>;
  nameOverrides?: ReadonlyMap<string, string>;
  formatting?: AnalysisFormatting;
  functionMode?: FunctionExpansionMode;
  functionModeOverrides?: ReadonlyMap<string, FunctionExpansionMode>;
  allowLargeInline?: boolean;
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
  functionTree: FunctionDependencyNode[];
  inlineExpansion?: {
    estimatedNodes: number;
    blocked: boolean;
  };
}

export interface AnalysisWorkspace {
  readonly source: string;
  readonly definitions: ReadonlyMap<string, string>;
  analyze(request?: AnalysisRequest): AnalysisResult;
}

function selectedOutputs(
  graph: MaterialGraph,
  requestedOutputId: string | undefined,
): { selectedOutputId: string; outputs: GraphOutput[]; choices: Pick<GraphOutput, "id" | "label">[] } | undefined {
  if (!graph.outputs.length) return undefined;
  const owners = graph.outputs.map((output) => graph.nodes.get(output.ownerNodeId));
  const firstOwner = owners[0];
  const hasAllOutputs = graph.outputs.length > 1 && (
    owners.every((owner) => owner?.kind === "function-output") ||
    owners.every((owner) => owner?.kind === "root") ||
    Boolean(firstOwner && isTerminalExpression(firstOwner) && owners.every((owner) => owner?.id === firstOwner.id))
  );
  const selectedOutputId = requestedOutputId === ALL_OUTPUTS_ID && hasAllOutputs
    ? ALL_OUTPUTS_ID
    : graph.outputs.some((output) => output.id === requestedOutputId)
      ? requestedOutputId!
      : hasAllOutputs
        ? ALL_OUTPUTS_ID
        : graph.outputs[0].id;
  const outputs = selectedOutputId === ALL_OUTPUTS_ID
    ? graph.outputs
    : [graph.outputs.find((output) => output.id === selectedOutputId)!];
  const choices: Pick<GraphOutput, "id" | "label">[] = graph.outputs.map(({ id, label }) => ({ id, label }));
  if (hasAllOutputs) choices.unshift({ id: ALL_OUTPUTS_ID, label: "All outputs" });
  return { selectedOutputId, outputs, choices };
}

function functionStaticSwitchOverrides(
  target: string,
  overrides: ReadonlyMap<string, boolean>,
): Map<string, boolean> {
  return new Map(
    [...overrides].flatMap(([id, value]) =>
      id.startsWith(`${target}::`) && !id.startsWith(`${target}::call:`) && !id.startsWith(`${target}::config:`)
        ? [[id.slice(target.length + 2), value] as const]
        : []),
  );
}

interface HelperTarget {
  target: string;
  specialization?: FunctionSpecialization;
  callIds: string[];
}

function specializedInputIds(specialization?: FunctionSpecialization): Set<string> {
  return new Set(
    [...(specialization?.staticSwitchOverrides.keys() ?? [])]
      .flatMap((id) => id.match(/^function-input:(.+)$/)?.[1] ?? []),
  );
}

function helperTargets(
  graph: MaterialGraph,
  outputs: GraphOutput[],
  library: FunctionLibrary,
  globalMode: FunctionExpansionMode,
  modeOverrides: ReadonlyMap<string, FunctionExpansionMode>,
  staticSwitchOverrides: ReadonlyMap<string, boolean>,
): HelperTarget[] {
  const ordered: HelperTarget[] = [];
  const byKey = new Map<string, HelperTarget>();
  const visitGraph = (current: MaterialGraph, ownerTarget?: string): void => {
    if (!current.outputs.length) return;
    const slice = sliceOutputs(
      current,
      current === graph ? outputs.map(({ id }) => id) : current.outputs.map(({ id }) => id),
      ownerTarget ? functionStaticSwitchOverrides(ownerTarget, staticSwitchOverrides) : staticSwitchOverrides,
      Boolean(ownerTarget),
    );
    for (const nodeId of slice.orderedNodeIds) {
      const node = current.nodes.get(nodeId);
      if (node?.kind !== "external-call") continue;
      const target = node.properties.get("MaterialFunction") ?? "UnresolvedMaterialFunction";
      if (library.mode(target, globalMode, modeOverrides) !== "helpers") continue;
      const definition = library.graph(target);
      if (!definition) continue;
      const specialization = library.specialization(target, node, current, staticSwitchOverrides);
      const key = `${target}::${specialization?.id ?? "generic"}`;
      const callId = functionCallId(target, node.nodeGuid ?? node.id);
      const existing = byKey.get(key);
      if (existing) {
        existing.callIds.push(callId);
        continue;
      }
      const item: HelperTarget = { target, specialization, callIds: [callId] };
      byKey.set(key, item);
      const expanded = library.expand(
        definition,
        globalMode,
        modeOverrides,
        specialization?.staticSwitchOverrides ?? staticSwitchOverrides,
        true,
      ).graph;
      visitGraph(expanded, target);
      ordered.push(item);
    }
  };
  visitGraph(graph);
  return ordered;
}

function helperNames(targets: readonly HelperTarget[]): Map<HelperTarget, string> {
  const result = new Map<HelperTarget, string>();
  const used = new Set<string>();
  for (const target of [...targets].sort((left, right) =>
    left.target.localeCompare(right.target)
    || (left.specialization?.id ?? "").localeCompare(right.specialization?.id ?? ""))) {
    const base = `${materialFunctionName(target.target)}${target.specialization ? `__${identifier(target.specialization.label)}` : ""}`;
    let name = base;
    let index = 2;
    while (used.has(name)) name = `${base}_${index++}`;
    used.add(name);
    result.set(target, name);
  }
  return result;
}

function renderedFact(type: MaterialType | undefined, confidence?: "confirmed" | "inferred" | "minimum"): string {
  if (!type) return "?type";
  return confidence === "minimum" ? `?${type}+` : confidence === "inferred" ? `?${type}` : type;
}

function indent(lines: readonly string[]): string {
  return lines.map((line) => line ? `    ${line}` : "").join("\n");
}

interface RenderedHelper {
  code: string;
  editableSymbols: EditableSymbol[];
}

function editableHelperOutput(
  target: string,
  outputId: string,
  name: string,
  knowledge: FunctionGenerationKnowledge,
  typeOverrides: ReadonlyMap<string, MaterialType>,
  specialization?: FunctionSpecialization,
): TypeOverrideValue | undefined {
  const genericId = functionOutputId(target, outputId);
  const id = specialization
    ? functionOutputSpecializationId(target, outputId, specialization.id)
    : genericId;
  const override = typeOverrides.get(id) ?? typeOverrides.get(genericId);
  const fact = knowledge.outputFacts.get(genericId);
  if (!override && fact?.confidence === "confirmed") return undefined;
  return {
    id,
    name,
    type: override ?? fact?.type,
    status: override
      ? "overridden"
      : !fact
        ? "unknown"
        : fact.confidence === "minimum"
          ? "minimum"
          : "inferred",
  };
}

function renderHelper(
  target: string,
  name: string,
  graph: MaterialGraph,
  generated: PseudoHlslResult,
  library: FunctionLibrary,
  knowledge: FunctionGenerationKnowledge,
  formatting: AnalysisFormatting,
  typeOverrides: ReadonlyMap<string, MaterialType>,
  omittedInputIds: ReadonlySet<string> = new Set(),
  specialization?: FunctionSpecialization,
): RenderedHelper {
  const signature = library.signature(target);
  const outputFacts = graph.outputs.map((output, index) => {
    const owner = graph.nodes.get(output.ownerNodeId);
    const outputId = owner?.properties.get("Id") ?? signature?.outputs[index]?.id ?? output.ownerPinId;
    const genericId = functionOutputId(target, outputId);
    const id = specialization
      ? functionOutputSpecializationId(target, outputId, specialization.id)
      : genericId;
    const override = typeOverrides.get(id) ?? typeOverrides.get(genericId);
    return override
      ? { type: override, confidence: "confirmed" as const }
      : knowledge.outputFacts.get(genericId);
  });
  const declarationsById = new Map(
    generated.functionInputs.map(({ id, declaration }) => [id, declaration]),
  );
  const inputNodesById = new Map(
    [...graph.nodes.values()]
      .filter((node) => node.kind === "function-input")
      .map((node) => [(node.properties.get("Id") ?? "").toUpperCase(), node]),
  );
  const params = signature?.inputs.flatMap(({ id }) => {
    if (omittedInputIds.has(id)) return [];
    const node = inputNodesById.get(id);
    const declaration = declarationsById.get(id) ?? (node
      ? `${renderedFact(declaredFunctionInputType(node.properties.get("InputType")), "confirmed")} ${safeName(node.displayName ?? "Input")}`
      : undefined);
    return declaration ? [declaration] : [];
  }) ?? generated.functionInputs.map(({ declaration }) => declaration);
  const generatedLines = generated.code.split("\n");
  let lines = generatedLines.filter((line) =>
    line !== "// Pseudo-HLSL: semantic approximation of the connected Unreal graph."
    && !line.endsWith("// Function input"));
  let code: string;

  if (graph.outputs.length <= 1) {
    const fact = outputFacts[0];
    code = `${renderedFact(fact?.type, fact?.confidence)} ${name}(${params.join(", ")})\n{\n${indent(lines)}\n}`;
  } else if (formatting.bundleFormat === "readable") {
    const start = lines.findIndex((line) => line === "return FunctionOutputs");
    const assignments: string[] = [];
    if (start >= 0) {
      for (const line of lines.slice(start + 2)) {
        const match = line.trim().match(/^([A-Za-z_]\w*):\s*(.+?)(?:,)?$/);
        const value = match?.[2].replace(/,$/, "");
        if (match && value !== match[1]) assignments.push(`${match[1]} = ${value};`);
      }
      const outputNames = new Set(graph.outputs.map((output) => safeName(output.label)));
      const body = lines.slice(0, start).map((line) => {
        const declaration = line.match(/^(\s*)(?:\?[A-Za-z_]\w*\+?|[A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*=/);
        if (declaration && outputNames.has(declaration[2])) {
          return line.replace(/^(\s*)(?:\?[A-Za-z_]\w*\+?|[A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*=/, "$1$2 =");
        }
        const bareDeclaration = line.match(/^(\s*)(?:\?[A-Za-z_]\w*\+?|[A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*;$/);
        return bareDeclaration && outputNames.has(bareDeclaration[2]) ? "" : line;
      });
      lines = [...body, ...assignments];
    }
    const outParams = graph.outputs.map((output, index) => {
      const fact = outputFacts[index];
      return `out ${renderedFact(fact?.type, fact?.confidence)} ${safeName(output.label)}`;
    });
    code = `void ${name}(${[...params, ...outParams].join(", ")})\n{\n${indent(lines)}\n}`;
  } else {
    const bundle = `${name}Outputs`;
    lines = lines.map((line) => line.replace(/\bFunctionOutputs\b/g, bundle));
    const structStart = lines.findIndex((line) => line === `struct ${bundle}`);
    const structEnd = structStart >= 0 ? lines.findIndex((line, index) => index > structStart && line === "};") : -1;
    const structLines = structStart >= 0 && structEnd >= 0 ? lines.slice(structStart, structEnd + 1) : [];
    const body = structLines.length ? [...lines.slice(0, structStart), ...lines.slice(structEnd + 1)] : lines;
    code = `${structLines.join("\n")}\n\n${bundle} ${name}(${params.join(", ")})\n{\n${indent(body)}\n}`.trim();
  }

  const codeLines = code.split("\n");
  const signatureSymbols = graph.outputs.flatMap((output, index) => {
    const owner = graph.nodes.get(output.ownerNodeId);
    const outputName = graph.outputs.length === 1 ? name : safeName(output.label);
    const typeOverride = editableHelperOutput(
      target,
      owner?.properties.get("Id") ?? signature?.outputs[index]?.id ?? output.ownerPinId,
      outputName,
      knowledge,
      typeOverrides,
      specialization,
    );
    if (!typeOverride) return [];
    const lineIndex = codeLines.findIndex((line) =>
      graph.outputs.length === 1
        ? new RegExp(`\\b${name}\\s*\\(`).test(line)
        : new RegExp(`\\b${outputName}\\b`).test(line));
    return [{
      id: `HelperSignature:${target}:Output:${index}`,
      name: outputName,
      startLine: Math.max(0, lineIndex),
      endLine: Math.max(0, lineIndex),
      renameable: false,
      typeOverrideId: typeOverride.id,
      typeOverride,
    }];
  });
  return {
    code,
    editableSymbols: [...generated.editableSymbols, ...signatureSymbols],
  };
}

function safeName(value: string): string {
  return identifier(value);
}

function functionCycleDiagnostics(nodes: readonly FunctionDependencyNode[]): Diagnostic[] {
  const targets = new Set<string>();
  const visit = (items: readonly FunctionDependencyNode[]): void => {
    for (const item of items) {
      if (item.cycle) targets.add(item.target);
      visit(item.children);
    }
  };
  visit(nodes);
  return [...targets].map((target) => ({
    code: "function-definition-cycle",
    severity: "warning",
    message: `Material Function dependency cycle reaches ${materialFunctionName(target)}; the cyclic edge remains opaque.`,
    line: 0,
  }));
}

export function createAnalysisWorkspace(
  source: string,
  definitions: ReadonlyMap<string, string> = new Map(),
): AnalysisWorkspace {
  const rootGraph = resolveGraph(parseClipboard(source));
  const library = compileFunctionLibrary(rootGraph, definitions);
  return {
    source,
    definitions: new Map(definitions),
    analyze(request: AnalysisRequest = {}): AnalysisResult {
      const {
        outputId: requestedOutputId,
        typeOverrides = new Map(),
        staticSwitchOverrides = new Map(),
        nameOverrides = new Map(),
        formatting = defaultAnalysisFormatting,
        functionMode = "helpers",
        functionModeOverrides = new Map(),
        allowLargeInline = false,
      } = request;
      const resolvedStaticSwitchOverrides = library.resolveStaticSwitchOverrides(staticSwitchOverrides);
      const expanded = library.expand(
        rootGraph,
        functionMode,
        functionModeOverrides,
        resolvedStaticSwitchOverrides,
        allowLargeInline,
      );
      const graph = expanded.graph;
      const functionTree = library.tree(resolvedStaticSwitchOverrides);
      const cycleDiagnostics = functionCycleDiagnostics(functionTree);
      const selection = selectedOutputs(graph, requestedOutputId);
      if (!selection) {
        return {
          outputs: [],
          code: "",
          diagnostics: [...graph.diagnostics, ...cycleDiagnostics],
          typeOverrideGroups: [],
          staticSwitches: [],
          editableSymbols: [],
          nodeCount: graph.nodes.size,
          functionTree,
          inlineExpansion: {
            estimatedNodes: expanded.estimatedInlineNodes,
            blocked: expanded.blocked,
          },
        };
      }
      const targets = helperTargets(
        graph,
        selection.outputs,
        library,
        functionMode,
        functionModeOverrides,
        resolvedStaticSwitchOverrides,
      );
      const names = helperNames(targets);
      const callNames = new Map<string, string>();
      const callOmittedInputIds = new Map<string, ReadonlySet<string>>();
      for (const target of targets) {
        const name = names.get(target);
        if (!name) continue;
        const omittedInputIds = specializedInputIds(target.specialization);
        for (const callId of target.callIds) {
          callNames.set(callId, name);
          if (omittedInputIds.size) callOmittedInputIds.set(callId, omittedInputIds);
        }
      }
      const knowledge = {
        ...library.knowledge(resolvedStaticSwitchOverrides),
        callNames,
        callOmittedInputIds,
        callInputOverrides: resolvedStaticSwitchOverrides,
      };
      const generated = selection.selectedOutputId === ALL_OUTPUTS_ID
        ? generateAllPseudoHlsl(
            graph,
            typeOverrides,
            formatting,
            resolvedStaticSwitchOverrides,
            nameOverrides,
            knowledge,
          )
        : generatePseudoHlsl(
            graph,
            selection.selectedOutputId,
            typeOverrides,
            formatting,
            resolvedStaticSwitchOverrides,
            nameOverrides,
            knowledge,
      );
      const helperResults = targets.flatMap((target) => {
        const definition = library.graph(target.target);
        const name = names.get(target);
        if (!definition || !name) return [];
        const helperStaticSwitchOverrides = target.specialization?.staticSwitchOverrides
          ?? functionStaticSwitchOverrides(target.target, resolvedStaticSwitchOverrides);
        const helperGraph = library.expand(
          definition,
          functionMode,
          functionModeOverrides,
          helperStaticSwitchOverrides,
          true,
        ).graph;
        const helperKnowledge = {
          ...knowledge,
          outputFacts: new Map([
            ...knowledge.outputFacts,
            ...(target.specialization?.outputFacts ?? []),
          ]),
        };
        const helperGenerated = generateAllPseudoHlsl(
          helperGraph,
          typeOverrides,
          formatting,
          helperStaticSwitchOverrides,
          nameOverrides,
          {
            ...helperKnowledge,
            preserveStaticSwitches: true,
            symbolNamespace: `${target.target}:${target.specialization?.id ?? "generic"}`,
          },
        );
        const rendered = renderHelper(
          target.target,
          name,
          helperGraph,
          helperGenerated,
          library,
          helperKnowledge,
          formatting,
          typeOverrides,
          specializedInputIds(target.specialization),
          target.specialization,
        );
        return [{
          ...rendered,
          diagnostics: helperGenerated.diagnostics,
          typeOverrideGroups: helperGenerated.typeOverrideGroups,
        }];
      });
      const segments = helperResults.length
        ? [
            {
              code: [
                "//---------------------------------------------------",
                "// Material Function definitions",
                "//---------------------------------------------------",
              ].join("\n"),
              editableSymbols: [] as EditableSymbol[],
            },
            ...helperResults.flatMap((helper, index) => [
              ...(index ? [{ code: "", editableSymbols: [] as EditableSymbol[] }] : []),
              helper,
            ]),
            { code: "", editableSymbols: [] as EditableSymbol[] },
            {
              code: [
                "//---------------------------------------------------",
                "// Main graph",
                "//---------------------------------------------------",
              ].join("\n"),
              editableSymbols: [] as EditableSymbol[],
            },
            { code: generated.code, editableSymbols: generated.editableSymbols },
          ]
        : [{ code: generated.code, editableSymbols: generated.editableSymbols }];
      let lineOffset = 0;
      const editableSymbols = segments.flatMap((segment) => {
        const lineCount = segment.code.split("\n").length;
        const scoped = segment.editableSymbols.map((symbol) => ({
          ...symbol,
          startLine: lineOffset + (symbol.startLine ?? 0),
          endLine: lineOffset + (symbol.endLine ?? lineCount - 1),
        }));
        lineOffset += lineCount;
        return scoped;
      });
      const code = segments.map((segment) => segment.code).join("\n");
      const typeOverrideGroups = [
        ...generated.typeOverrideGroups,
        ...helperResults.flatMap(({ typeOverrideGroups }) => typeOverrideGroups),
      ].filter((group, index, groups) =>
        groups.findIndex(({ id }) => id === group.id) === index);
      return {
        outputs: selection.choices,
        selectedOutputId: selection.selectedOutputId,
        code,
        diagnostics: [
          ...generated.diagnostics,
          ...helperResults.flatMap(({ diagnostics }) => diagnostics),
          ...cycleDiagnostics.filter(({ code }) =>
            !generated.diagnostics.some((diagnostic) => diagnostic.code === code)),
        ],
        typeOverrideGroups,
        staticSwitches: generated.staticSwitches,
        editableSymbols,
        nodeCount: graph.nodes.size,
        functionTree,
        inlineExpansion: {
          estimatedNodes: expanded.estimatedInlineNodes,
          blocked: expanded.blocked,
        },
      };
    },
  };
}

export function analyzeClipboard(
  source: string,
  request: AnalysisRequest = {},
): AnalysisResult {
  return createAnalysisWorkspace(source).analyze(request);
}
