import type { Diagnostic } from "../clipboard/raw-types";
import type { GraphNode } from "./types";

function referencedDeclarationId(value: string | undefined): string | undefined {
  return value?.match(/(MaterialGraphNode_[A-Za-z0-9_]+)\.MaterialExpressionNamedRerouteDeclaration/)?.[1];
}

export function connectNamedReroutes(nodes: Map<string, GraphNode>): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const declarationsByGuid = new Map<string, GraphNode>();

  for (const node of nodes.values()) {
    if (node.expressionClass !== "MaterialExpressionNamedRerouteDeclaration") continue;
    const guid = node.properties.get("VariableGuid");
    if (guid) declarationsByGuid.set(guid, node);
    node.displayName = node.properties.get("Name") ?? node.displayName;
  }

  for (const usage of nodes.values()) {
    if (usage.expressionClass !== "MaterialExpressionNamedRerouteUsage") continue;
    const declaration = nodes.get(referencedDeclarationId(usage.properties.get("Declaration")) ?? "")
      ?? declarationsByGuid.get(usage.properties.get("DeclarationGuid") ?? "");
    const declarationOutput = declaration?.pins.find((pin) => pin.direction === "output");
    if (!declaration || !declarationOutput) {
      diagnostics.push({
        code: "unresolved-named-reroute",
        severity: "warning",
        message: `Named Reroute usage ${usage.id} references a declaration outside this clipboard selection.`,
        line: usage.startLine,
        nodeId: usage.id,
      });
      continue;
    }

    usage.pins.unshift({
      id: `named-reroute:${usage.id}`,
      name: "Input",
      direction: "input",
      links: [{ nodeId: declaration.id, pinId: declarationOutput.id }],
    });
  }

  return diagnostics;
}
