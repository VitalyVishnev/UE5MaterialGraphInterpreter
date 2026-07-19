export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  line: number;
  nodeId?: string;
}

export interface RawProperty {
  key: string;
  value: string;
  raw: string;
  line: number;
}

export interface RawObject {
  className?: string;
  name?: string;
  exportPath?: string;
  attributes: ReadonlyMap<string, string>;
  properties: Map<string, RawProperty>;
  propertyList: RawProperty[];
  children: RawObject[];
  startLine: number;
  endLine: number;
  incomplete: boolean;
}

export interface ClipboardParseResult {
  objects: RawObject[];
  diagnostics: Diagnostic[];
  lineCount: number;
}
