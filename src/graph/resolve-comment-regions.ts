import type { GraphCommentRegion, GraphNode, MaterialGraph } from "./types";

interface PositionedCommentRegion extends GraphCommentRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

function number(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function assignCommentRegions(nodes: Map<string, GraphNode>): void {
  const regions: PositionedCommentRegion[] = [...nodes.values()]
    .filter((node) => node.expressionClass === "MaterialExpressionComment")
    .map((node) => ({
      id: node.id,
      text: node.properties.get("Text")?.trim() ?? "",
      x: number(node.properties.get("MaterialExpressionEditorX")) ?? 0,
      y: number(node.properties.get("MaterialExpressionEditorY")) ?? 0,
      width: number(node.properties.get("SizeX")) ?? 0,
      height: number(node.properties.get("SizeY")) ?? 0,
    }))
    .filter((region) => region.text && region.width > 0 && region.height > 0);

  for (const node of nodes.values()) {
    if (node.expressionClass === "MaterialExpressionComment") continue;
    const x = number(node.properties.get("MaterialExpressionEditorX"));
    const y = number(node.properties.get("MaterialExpressionEditorY"));
    if (x === undefined || y === undefined) continue;
    node.commentRegions = regions
      .filter((region) => x >= region.x && x <= region.x + region.width
        && y >= region.y && y <= region.y + region.height)
      .sort((a, b) => b.width * b.height - a.width * a.height || a.id.localeCompare(b.id))
      .map(({ id, text }) => ({ id, text }));
  }
}

/**
 * Keeps an already dependency-first slice valid while treating each innermost
 * multi-node Comment Region as a soft presentation block.  The graph remains
 * the source of order; regions only choose between otherwise ready nodes.
 */
export function orderNodesByCommentRegions(
  graph: MaterialGraph,
  orderedNodeIds: readonly string[],
): string[] {
  const included = new Set(orderedNodeIds);
  const originalOrder = new Map(orderedNodeIds.map((nodeId, index) => [nodeId, index]));
  const dependencies = new Map<string, Set<string>>();
  const consumers = new Map<string, Set<string>>();
  const regionMembers = new Map<string, string[]>();

  for (const nodeId of orderedNodeIds) {
    const node = graph.nodes.get(nodeId);
    const dependenciesForNode = new Set<string>();
    for (const pin of node?.pins ?? []) {
      if (pin.direction !== "input") continue;
      for (const link of pin.links) {
        if (!included.has(link.nodeId)) continue;
        dependenciesForNode.add(link.nodeId);
        const linkedConsumers = consumers.get(link.nodeId) ?? new Set<string>();
        linkedConsumers.add(nodeId);
        consumers.set(link.nodeId, linkedConsumers);
      }
    }
    dependencies.set(nodeId, dependenciesForNode);
    const region = node?.commentRegions?.at(-1);
    if (region) regionMembers.set(region.id, [...(regionMembers.get(region.id) ?? []), nodeId]);
  }

  const groupedNodes = new Map<string, string>();
  for (const [regionId, members] of regionMembers) {
    if (members.length < 2) continue;
    for (const nodeId of members) groupedNodes.set(nodeId, regionId);
  }

  const remaining = new Map([...dependencies].map(([nodeId, values]) => [nodeId, values.size]));
  const emitted = new Set<string>();
  const ready = new Set(orderedNodeIds.filter((nodeId) => remaining.get(nodeId) === 0));
  const result: string[] = [];
  const byOriginalOrder = (left: string, right: string): number =>
    (originalOrder.get(left) ?? 0) - (originalOrder.get(right) ?? 0);
  const emit = (nodeId: string): void => {
    ready.delete(nodeId);
    emitted.add(nodeId);
    result.push(nodeId);
    for (const consumerId of consumers.get(nodeId) ?? []) {
      const count = (remaining.get(consumerId) ?? 1) - 1;
      remaining.set(consumerId, count);
      if (count === 0) ready.add(consumerId);
    }
  };
  const regionCanStart = (regionId: string): boolean =>
    (regionMembers.get(regionId) ?? []).every((nodeId) =>
      [...(dependencies.get(nodeId) ?? [])].every((dependencyId) =>
        groupedNodes.get(dependencyId) === regionId || emitted.has(dependencyId),
      ),
    );

  while (ready.size > 0) {
    const candidateRegions = [...new Set([...ready]
      .map((nodeId) => groupedNodes.get(nodeId))
      .filter((regionId): regionId is string => Boolean(regionId && regionCanStart(regionId))))];
    const regionId = candidateRegions.sort((left, right) =>
      byOriginalOrder(regionMembers.get(left)![0], regionMembers.get(right)![0]),
    )[0];
    if (regionId) {
      while (true) {
        const member = [...ready]
          .filter((nodeId) => groupedNodes.get(nodeId) === regionId)
          .sort(byOriginalOrder)[0];
        if (!member) break;
        emit(member);
      }
      continue;
    }
    emit([...ready].sort(byOriginalOrder)[0]);
  }

  return result.length === orderedNodeIds.length ? result : [...orderedNodeIds];
}
