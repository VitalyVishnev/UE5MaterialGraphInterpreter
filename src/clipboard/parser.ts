import type {
  ClipboardParseResult,
  Diagnostic,
  RawObject,
  RawProperty,
} from "./raw-types";

const beginObjectPattern = /^\s*Begin Object(?:\s+(.*))?\s*$/;
const endObjectPattern = /^\s*End Object\s*$/;
const attributePattern = /([A-Za-z][A-Za-z0-9_]*)=("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\S+)/g;

function unquote(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

function parseAttributes(text: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of text.matchAll(attributePattern)) {
    attributes.set(match[1], unquote(match[2]));
  }
  return attributes;
}

function parseProperty(rawLine: string, line: number): RawProperty | undefined {
  const text = rawLine.trim();
  if (!text) return undefined;

  const equalsIndex = text.indexOf("=");
  if (equalsIndex > 0) {
    return {
      key: text.slice(0, equalsIndex).trim(),
      value: text.slice(equalsIndex + 1).trim(),
      raw: text,
      line,
    };
  }

  const customIndex = text.indexOf(" ");
  return {
    key: customIndex > 0 ? text.slice(0, customIndex) : text,
    value: customIndex > 0 ? text.slice(customIndex + 1).trim() : "",
    raw: text,
    line,
  };
}

export function parseClipboard(source: string): ClipboardParseResult {
  const cleanSource = source.charCodeAt(0) === 0xFEFF ? source.slice(1) : source;
  const lines = cleanSource.split(/\r?\n/);
  const objects: RawObject[] = [];
  const stack: RawObject[] = [];
  const diagnostics: Diagnostic[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const rawLine = lines[index];
    const beginMatch = rawLine.match(beginObjectPattern);

    if (beginMatch) {
      const attributes = parseAttributes(beginMatch[1] ?? "");
      const object: RawObject = {
        className: attributes.get("Class"),
        name: attributes.get("Name"),
        exportPath: attributes.get("ExportPath"),
        attributes,
        properties: new Map(),
        propertyList: [],
        children: [],
        startLine: lineNumber,
        endLine: lineNumber,
        incomplete: true,
      };
      const parent = stack.at(-1);
      if (parent) parent.children.push(object);
      else objects.push(object);
      stack.push(object);
      continue;
    }

    if (endObjectPattern.test(rawLine)) {
      const object = stack.pop();
      if (!object) {
        diagnostics.push({
          code: "unexpected-end-object",
          severity: "error",
          message: "End Object has no matching Begin Object.",
          line: lineNumber,
        });
      } else {
        object.endLine = lineNumber;
        object.incomplete = false;
      }
      continue;
    }

    const activeObject = stack.at(-1);
    if (!activeObject) {
      if (rawLine.trim()) {
        diagnostics.push({
          code: "orphan-text",
          severity: "warning",
          message: "Text appears outside an object record.",
          line: lineNumber,
        });
      }
      continue;
    }

    const property = parseProperty(rawLine, lineNumber);
    if (property) {
      activeObject.propertyList.push(property);
      activeObject.properties.set(property.key, property);
    }
  }

  for (const object of stack) {
    object.endLine = lines.length;
    diagnostics.push({
      code: "incomplete-object",
      severity: "error",
      message: `Object ${object.name ?? "<unnamed>"} is missing End Object.`,
      line: object.startLine,
    });
  }

  if (objects.length === 0 && source.trim()) {
    diagnostics.push({
      code: "no-objects",
      severity: "error",
      message: "No Unreal object records were found.",
      line: 1,
    });
  }

  return { objects, diagnostics, lineCount: lines.length };
}
