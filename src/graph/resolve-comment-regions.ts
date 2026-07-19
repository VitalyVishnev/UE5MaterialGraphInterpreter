import type { GraphCommentRegion, GraphNode } from "./types";

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
