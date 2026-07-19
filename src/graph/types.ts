import type { Diagnostic } from "../clipboard/raw-types";

export interface GraphLink {
  nodeId: string;
  pinId: string;
}

export interface GraphPin {
  id: string;
  name: string;
  direction: "input" | "output";
  category?: string;
  subcategory?: string;
  defaultValue?: string;
  links: GraphLink[];
}

export type GraphNodeKind =
  | "root"
  | "expression"
  | "function-input"
  | "function-output"
  | "custom"
  | "external-call"
  | "unknown";

export interface GraphCommentRegion {
  id: string;
  text: string;
}

export interface GraphNode {
  id: string;
  expressionClass: string;
  kind: GraphNodeKind;
  properties: ReadonlyMap<string, string>;
  pins: GraphPin[];
  startLine: number;
  displayName?: string;
  commentRegions?: readonly GraphCommentRegion[];
}

export interface GraphOutput {
  id: string;
  label: string;
  ownerNodeId: string;
  ownerPinId: string;
  sourceNodeId?: string;
  sourcePinId?: string;
}

export interface MaterialGraph {
  nodes: ReadonlyMap<string, GraphNode>;
  outputs: GraphOutput[];
  diagnostics: Diagnostic[];
}
