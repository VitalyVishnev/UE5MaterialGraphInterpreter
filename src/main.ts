import "./styles.css";
import {
  createAnalysisWorkspace,
  defaultAnalysisFormatting,
  materialTypeOptions,
  type AnalysisFormatting,
  type AnalysisResult,
  type AnalysisWorkspace,
  type FunctionDependencyNode,
  type FunctionExpansionMode,
  type MaterialType,
} from "./analyze";
import { mountResizableWorkspace } from "./resizable-layout";
import { loadStringMap, persistStringMap } from "./session-storage";

const element = <T extends HTMLElement>(id: string): T => {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing UI element: ${id}`);
  return value as T;
};

const clipboard = element<HTMLTextAreaElement>("clipboard");
const workspaceElement = element<HTMLElement>("workspace");
const pasteButton = element<HTMLButtonElement>("paste-clipboard");
const outputSelect = element<HTMLSelectElement>("output-select");
const copyButton = element<HTMLButtonElement>("copy-code");
const bundleFormat = element<HTMLSelectElement>("bundle-format");
const functionModeSelect = element<HTMLSelectElement>("function-mode");
const showSections = element<HTMLInputElement>("show-sections");
const expandCustomNodes = element<HTMLInputElement>("expand-custom-nodes");
const wrapCalls = element<HTMLInputElement>("wrap-calls");
const renderIfStatements = element<HTMLInputElement>("render-if-statements");
const spaceOperations = element<HTMLInputElement>("space-operations");
const simplifyAlgebra = element<HTMLInputElement>("simplify-algebra");
const syntaxHighlighting = element<HTMLInputElement>("syntax-highlighting");
const showLineNumbers = element<HTMLInputElement>("show-line-numbers");
const codeSearch = element<HTMLDivElement>("code-search");
const codeSearchInput = element<HTMLInputElement>("code-search-input");
const codeSearchCount = element<HTMLSpanElement>("code-search-count");
const codeSearchPrevious = element<HTMLButtonElement>("code-search-previous");
const codeSearchNext = element<HTMLButtonElement>("code-search-next");
const code = element<HTMLElement>("code").querySelector("code")!;
const diagnostics = element<HTMLOListElement>("diagnostics");
const staticSwitches = element<HTMLDivElement>("static-switches");
const materialFunctions = element<HTMLDivElement>("material-functions");
const typeOverridesPanel = element<HTMLDivElement>("type-overrides");
const clearFunctionLibrary = element<HTMLButtonElement>("clear-function-library");
const generateLargeInline = element<HTMLButtonElement>("generate-large-inline");
const diagnosticCount = element<HTMLSpanElement>("diagnostic-count");
const functionCount = element<HTMLSpanElement>("function-count");
const customCount = element<HTMLSpanElement>("custom-count");
const switchCount = element<HTMLSpanElement>("switch-count");
const inputMeta = element<HTMLSpanElement>("input-meta");
const status = element<HTMLParagraphElement>("status");
const codePopover = element<HTMLDivElement>("code-popover");
const codePopoverLabel = element<HTMLLabelElement>("code-popover-label");
const codePopoverInput = element<HTMLInputElement>("code-popover-input");
const codePopoverType = element<HTMLSelectElement>("code-popover-type");
const codePopoverError = element<HTMLParagraphElement>("code-popover-error");
const codePopoverApply = element<HTMLButtonElement>("code-popover-apply");
const codePopoverReset = element<HTMLButtonElement>("code-popover-reset");
const codeTokenPattern = /(\/\/.*|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\?(?:float[2-4]?\+?|bool|type)(?!\w)|\b(?:const|return|static)\b|\b(?:float[2-4]?|bool|Texture2D(?:Array)?|TextureCube(?:Array)?|Texture3D|TextureExternal|SparseVolumeTexture|MaterialAttributes|Substrate|ShadingModel)\b|\b\d+(?:\.\d+)?f?\b|\b[A-Za-z_]\w*\b)/g;
const typeTokenPattern = /^(?:float[2-4]?|half[2-4]?|int[2-4]?|uint[2-4]?|bool|void|Texture2D(?:Array)?|TextureCube(?:Array)?|Texture3D|TextureExternal|SparseVolumeTexture|MaterialAttributes|Substrate|ShadingModel)$/;
const keywordTokenPattern = /^(?:const|return|static|true|false)$/;
const nameOverrideStorageKey = "ue5-material-graph-interpreter:name-overrides";
const functionDefinitionStorageKey = "ue5-material-graph-interpreter:function-definitions";
const functionModeStorageKey = "ue5-material-graph-interpreter:function-modes";
const reservedVariableNames = new Set(["const", "return", "static", "bool", "float", "float2", "float3", "float4"]);

type EditableSymbol = AnalysisResult["editableSymbols"][number];
type TypeOverrideValue = AnalysisResult["typeOverrideGroups"][number]["values"][number];
type CodePopoverState =
  | { kind: "rename"; symbol: EditableSymbol }
  | { kind: "type"; symbol: EditableSymbol; output: TypeOverrideValue };

let acceptedSource = "";
let acceptedResult: AnalysisResult | undefined;
let acceptedWorkspace: AnalysisWorkspace | undefined;
let copyFeedbackTimer: number | undefined;
const typeOverrides = new Map<string, MaterialType>();
const staticSwitchOverrides = new Map<string, boolean>();
const formatting: AnalysisFormatting = { ...defaultAnalysisFormatting };
const nameOverrides = loadNameOverrides();
const functionDefinitions = loadStringMap(sessionStorage, functionDefinitionStorageKey);
const functionModeOverrides = new Map(
  [...loadStringMap(sessionStorage, functionModeStorageKey)].filter(
    (entry): entry is [string, FunctionExpansionMode] =>
      entry[1] === "types" || entry[1] === "helpers" || entry[1] === "inline",
  ),
);
let functionMode: FunctionExpansionMode = "helpers";
let allowLargeInline = false;
let volatileFunctionLibrary = false;
let codePopoverState: CodePopoverState | undefined;
let codeSearchMatches: HTMLElement[] = [];
let activeCodeSearchMatch = -1;

mountResizableWorkspace(workspaceElement);

function loadNameOverrides(): Map<string, string> {
  return loadStringMap(sessionStorage, nameOverrideStorageKey);
}

function persistNameOverrides(): void {
  persistStringMap(sessionStorage, nameOverrideStorageKey, nameOverrides);
}

function setStatus(message: string, kind = ""): void {
  status.textContent = message;
  status.className = kind;
}

function automaticTypeLabel(output: TypeOverrideValue): string {
  return output.status === "unknown"
    ? "Unknown — select type"
    : output.status === "minimum"
      ? `Auto · ?${output.type}+`
      : output.status === "inferred"
        ? `Auto · ?${output.type}`
        : "Auto · infer from graph";
}

function populateTypeSelect(select: HTMLSelectElement, output: TypeOverrideValue): void {
  const automatic = document.createElement("option");
  automatic.value = "";
  automatic.textContent = automaticTypeLabel(output);
  select.replaceChildren(automatic);
  for (const type of materialTypeOptions) {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    select.append(option);
  }
  select.value = output.status === "overridden" && output.type ? output.type : "";
}

function setTypeOverride(id: string, type: MaterialType | ""): void {
  if (type) typeOverrides.set(id, type);
  else typeOverrides.delete(id);
}

function closeCodePopover(): void {
  codePopover.hidden = true;
  codePopoverState = undefined;
  codePopoverError.hidden = true;
  codePopoverError.textContent = "";
}

function positionCodePopover(target: HTMLElement): void {
  const targetBounds = target.getBoundingClientRect();
  const popoverBounds = codePopover.getBoundingClientRect();
  const left = Math.min(Math.max(12, targetBounds.left), window.innerWidth - popoverBounds.width - 12);
  const below = targetBounds.bottom + 8;
  const top = below + popoverBounds.height <= window.innerHeight - 12
    ? below
    : Math.max(12, targetBounds.top - popoverBounds.height - 8);
  codePopover.style.left = `${left}px`;
  codePopover.style.top = `${top}px`;
}

function showCodePopover(target: HTMLElement, focus: () => void): void {
  codePopoverError.hidden = true;
  codePopover.hidden = false;
  positionCodePopover(target);
  focus();
}

function openRenamePopover(symbol: EditableSymbol, target: HTMLElement): void {
  codePopoverState = { kind: "rename", symbol };
  codePopoverLabel.textContent = `Rename ${symbol.name}`;
  codePopoverLabel.htmlFor = "code-popover-input";
  codePopoverInput.hidden = false;
  codePopoverInput.value = nameOverrides.get(symbol.id) ?? symbol.name;
  codePopoverType.hidden = true;
  codePopoverReset.hidden = !nameOverrides.has(symbol.id);
  showCodePopover(target, () => {
    codePopoverInput.focus();
    codePopoverInput.select();
  });
}

function openTypePopover(symbol: EditableSymbol, output: TypeOverrideValue, target: HTMLElement): void {
  codePopoverState = { kind: "type", symbol, output };
  codePopoverLabel.textContent = `Type for ${symbol.name}`;
  codePopoverLabel.htmlFor = "code-popover-type";
  codePopoverInput.hidden = true;
  codePopoverType.hidden = false;
  populateTypeSelect(codePopoverType, output);
  codePopoverReset.hidden = !typeOverrides.has(output.id);
  showCodePopover(target, () => codePopoverType.focus());
}

function makeInteractiveCodeToken(
  span: HTMLSpanElement,
  className: string,
  title: string,
  open: () => void,
): void {
  span.classList.add(className);
  span.tabIndex = 0;
  span.title = title;
  span.addEventListener("click", open);
  span.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  });
}

function renderCode(result: AnalysisResult): void {
  const fragment = document.createDocumentFragment();
  const symbols = new Map<string, EditableSymbol[]>();
  for (const symbol of result.editableSymbols) {
    const matches = symbols.get(symbol.name) ?? [];
    matches.push(symbol);
    symbols.set(symbol.name, matches);
  }
  for (const matches of symbols.values()) {
    matches.sort((left, right) =>
      ((left.endLine ?? Number.POSITIVE_INFINITY) - (left.startLine ?? 0))
      - ((right.endLine ?? Number.POSITIVE_INFINITY) - (right.startLine ?? 0)));
  }
  const symbolAt = (name: string | undefined, line: number): EditableSymbol | undefined =>
    name
      ? (symbols.get(name) ?? []).find((symbol) =>
          line >= (symbol.startLine ?? 0)
          && line <= (symbol.endLine ?? Number.POSITIVE_INFINITY))
      : undefined;
  const types = new Map(result.typeOverrideGroups.flatMap((group) =>
    group.values.map((output) => [output.id, output] as const),
  ));
  const lines = result.code.split("\n");
  for (const [lineIndex, line] of lines.entries()) {
    const lineElement = document.createElement("span");
    lineElement.className = "code-line";
    lineElement.dataset.line = String(lineIndex + 1);
    let cursor = 0;
    for (const match of line.matchAll(codeTokenPattern)) {
      const token = match[0];
      const index = match.index ?? 0;
      lineElement.append(document.createTextNode(line.slice(cursor, index)));
      const span = document.createElement("span");
      span.textContent = token;
      const remainingLine = line.slice(index + token.length);
      const followingIdentifier = remainingLine.match(/^\s+([A-Za-z_]\w*)/)?.[1];
      const symbol = symbolAt(token, lineIndex);
      const declaredSymbol = symbolAt(followingIdentifier, lineIndex);
      const typeOverride = (token.startsWith("?") || typeTokenPattern.test(token))
        ? declaredSymbol?.typeOverride
          ?? types.get(declaredSymbol?.typeOverrideId ?? "")
        : undefined;
      span.className = token.startsWith("//")
        ? "token-comment"
        : token === "?type"
          ? "token-unresolved"
          : token.startsWith("?")
            ? "token-inferred"
              : typeTokenPattern.test(token)
              ? "token-type"
              : keywordTokenPattern.test(token)
                ? "token-keyword"
                : /^\d/.test(token)
                    ? "token-number"
                    : token.startsWith("\"") || token.startsWith("'")
                      ? "token-string"
                    : /^\s*\(/.test(remainingLine)
                      ? "token-function"
                      : "token-identifier";
      if (typeOverride && declaredSymbol) {
        span.dataset.typeOverrideId = typeOverride.id;
        const open = () => openTypePopover(declaredSymbol, typeOverride, span);
        makeInteractiveCodeToken(span, "code-type-override", "Choose this value type", open);
      } else if (symbol && symbol.renameable !== false) {
        span.dataset.symbolId = symbol.id;
        const open = () => openRenamePopover(symbol, span);
        makeInteractiveCodeToken(span, "code-symbol", `Rename ${symbol.name}`, open);
      }
      lineElement.append(span);
      cursor = index + token.length;
      if (token.startsWith("//")) break;
    }
    lineElement.append(document.createTextNode(line.slice(cursor)));
    fragment.append(lineElement);
    if (lineIndex < lines.length - 1) fragment.append(document.createTextNode("\n"));
  }
  code.replaceChildren(fragment);
  updateCodeSearch();
}

function focusCodeSearchMatch(index: number): void {
  if (!codeSearchMatches.length) return;
  activeCodeSearchMatch = (index + codeSearchMatches.length) % codeSearchMatches.length;
  for (const [matchIndex, match] of codeSearchMatches.entries()) {
    match.classList.toggle("active", matchIndex === activeCodeSearchMatch);
  }
  const matchBounds = codeSearchMatches[activeCodeSearchMatch].getBoundingClientRect();
  const codeBounds = code.getBoundingClientRect();
  code.scrollTop += matchBounds.top - codeBounds.top - codeBounds.height / 2 + matchBounds.height / 2;
  codeSearchCount.textContent = `${activeCodeSearchMatch + 1}/${codeSearchMatches.length}`;
}

function updateCodeSearch(): void {
  for (const match of codeSearchMatches) {
    match.replaceWith(document.createTextNode(match.textContent ?? ""));
  }
  code.normalize();
  codeSearchMatches = [];
  activeCodeSearchMatch = -1;
  const query = codeSearchInput.value.trim().toLocaleLowerCase();
  codeSearch.classList.toggle("has-query", Boolean(query));
  if (query) {
    const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) textNodes.push(node as Text);
    for (const textNode of textNodes) {
      const text = textNode.textContent ?? "";
      const lower = text.toLocaleLowerCase();
      if (!lower.includes(query)) continue;
      const replacement = document.createDocumentFragment();
      let cursor = 0;
      for (let index = lower.indexOf(query, cursor); index >= 0; index = lower.indexOf(query, cursor)) {
        replacement.append(document.createTextNode(text.slice(cursor, index)));
        const match = document.createElement("mark");
        match.className = "code-search-match";
        match.textContent = text.slice(index, index + query.length);
        replacement.append(match);
        codeSearchMatches.push(match);
        cursor = index + query.length;
      }
      replacement.append(document.createTextNode(text.slice(cursor)));
      textNode.replaceWith(replacement);
    }
  }
  codeSearchPrevious.disabled = codeSearchMatches.length === 0;
  codeSearchNext.disabled = codeSearchMatches.length === 0;
  if (codeSearchMatches.length) focusCodeSearchMatch(0);
  else codeSearchCount.textContent = query ? "0/0" : "";
}

function focusCodeSearch(): void {
  codeSearchInput.focus();
  codeSearchInput.select();
}

function renderDiagnostics(result: AnalysisResult): number {
  const fragment = document.createDocumentFragment();
  const grouped = new Map<string, { diagnostic: AnalysisResult["diagnostics"][number]; count: number }>();
  const summarizedCodes = new Set(["orphan-text", "unresolved-link", "unresolved-named-reroute"]);
  for (const diagnostic of result.diagnostics) {
    if (diagnostic.code === "external-function") continue;
    const key = summarizedCodes.has(diagnostic.code)
      ? `${diagnostic.severity}:${diagnostic.code}`
      : `${diagnostic.severity}:${diagnostic.code}:${diagnostic.message}`;
    const group = grouped.get(key);
    if (group) group.count += 1;
    else grouped.set(key, { diagnostic, count: 1 });
  }
  let visibleCount = 0;
  let warnings = 0;
  for (const { diagnostic, count } of grouped.values()) {
    visibleCount += 1;
    if (diagnostic.severity !== "info") warnings += 1;
    const item = document.createElement("li");
    item.className = `message ${diagnostic.severity}`;
    const heading = document.createElement("strong");
    heading.textContent = diagnostic.severity.toUpperCase();
    const message = document.createElement("span");
    message.textContent = diagnostic.code === "unresolved-link"
      ? `${count} graph connection${count === 1 ? "" : "s"} point outside this clipboard selection.`
      : diagnostic.code === "unresolved-named-reroute"
        ? `${count} Named Reroute reference${count === 1 ? "" : "s"} point outside this clipboard selection.`
        : diagnostic.code === "orphan-text"
          ? `${count} text fragment${count === 1 ? "" : "s"} could not be assigned to a complete Unreal object.`
          : count > 1
            ? `${diagnostic.message} (${count} occurrences)`
            : diagnostic.message;
    item.append(heading, message);
    fragment.append(item);
  }
  diagnosticCount.textContent = String(visibleCount);
  if (visibleCount === 0) {
    const item = document.createElement("li");
    item.className = "empty";
    item.textContent = "No other diagnostics.";
    fragment.append(item);
  }
  diagnostics.replaceChildren(fragment);
  return warnings;
}

function functionOutputValue(
  output: Pick<FunctionDependencyNode["outputs"][number], "id" | "name" | "type" | "confidence">,
): TypeOverrideValue {
  const override = typeOverrides.get(output.id);
  return {
    id: output.id,
    name: output.name,
    type: override ?? output.type,
    status: override
      ? "overridden"
      : output.confidence === "minimum"
        ? "minimum"
        : output.type
          ? "inferred"
          : "unknown",
  };
}

function functionNodeIn(
  nodes: readonly FunctionDependencyNode[],
  target: string,
): FunctionDependencyNode | undefined {
  for (const node of nodes) {
    if (node.target === target) return node;
    const nested = functionNodeIn(node.children, target);
    if (nested) return nested;
  }
  return undefined;
}

function currentRequest() {
  return {
    outputId: outputSelect.value,
    typeOverrides,
    staticSwitchOverrides,
    nameOverrides,
    formatting,
    functionMode,
    functionModeOverrides,
    allowLargeInline,
  };
}

function replaceDefinitions(next: ReadonlyMap<string, string>): void {
  functionDefinitions.clear();
  for (const entry of next) functionDefinitions.set(...entry);
  volatileFunctionLibrary = !persistStringMap(
    sessionStorage,
    functionDefinitionStorageKey,
    functionDefinitions,
  );
}

function acceptFunctionDefinition(target: string, source: string): void {
  if (!acceptedSource) return;
  try {
    const candidateDefinitions = new Map(functionDefinitions);
    candidateDefinitions.set(target, source);
    const candidateWorkspace = createAnalysisWorkspace(acceptedSource, candidateDefinitions);
    const validationResult = candidateWorkspace.analyze({
      ...currentRequest(),
      functionMode: "types",
      allowLargeInline: false,
    });
    const candidate = functionNodeIn(validationResult.functionTree, target);
    if (!candidate || candidate.status !== "defined") {
      setStatus(candidate?.error ?? "This clipboard is not a complete matching Material Function.", "error");
      return;
    }
    replaceDefinitions(candidateDefinitions);
    acceptedWorkspace = candidateWorkspace;
    allowLargeInline = false;
    acceptedResult = candidateWorkspace.analyze(currentRequest());
    renderAccepted(acceptedResult);
    if (!volatileFunctionLibrary) {
      setStatus(`${candidate.name} definition loaded for this tab.`, "success");
    }
  } catch (error) {
    setStatus(`Could not load function definition: ${error instanceof Error ? error.message : String(error)}`, "error");
  }
}

async function pasteFunctionDefinition(target: string): Promise<void> {
  try {
    acceptFunctionDefinition(target, await navigator.clipboard.readText());
  } catch (error) {
    setStatus(`Could not read function definition: ${error instanceof Error ? error.message : String(error)}`, "error");
  }
}

function removeFunctionDefinition(target: string): void {
  const next = new Map(functionDefinitions);
  next.delete(target);
  replaceDefinitions(next);
  if (!acceptedSource) return;
  acceptedWorkspace = createAnalysisWorkspace(acceptedSource, functionDefinitions);
  acceptedResult = acceptedWorkspace.analyze(currentRequest());
  renderAccepted(acceptedResult);
}

function renderMaterialFunctions(result: AnalysisResult): void {
  const uniqueTargets = new Set<string>();
  const count = (nodes: readonly FunctionDependencyNode[]): void => {
    for (const node of nodes) {
      uniqueTargets.add(node.target);
      count(node.children);
    }
  };
  count(result.functionTree);
  functionCount.textContent = String(uniqueTargets.size);
  clearFunctionLibrary.disabled = functionDefinitions.size === 0;
  if (!result.functionTree.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No Material Functions in this clipboard.";
    materialFunctions.replaceChildren(empty);
    return;
  }

  const renderNodes = (nodes: readonly FunctionDependencyNode[], depth: number): DocumentFragment => {
    const fragment = document.createDocumentFragment();
    for (const node of nodes) {
      const card = document.createElement("section");
      card.className = `function-card function-definition ${node.status}`;
      card.style.setProperty("--function-depth", String(depth));

      const heading = document.createElement("div");
      heading.className = "function-heading function-definition-heading";
      const title = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = node.name;
      const meta = document.createElement("span");
      meta.className = "function-state";
      meta.textContent = [
        node.status === "defined" ? "Defined" : node.status === "invalid" ? "Invalid" : "Missing",
        node.shared ? "Shared" : "",
        node.cycle ? "Cycle" : "",
        `${node.callCount} call${node.callCount === 1 ? "" : "s"}`,
      ].filter(Boolean).join(" · ");
      title.append(name, meta);

      const actions = document.createElement("div");
      actions.className = "function-actions";
      const mode = document.createElement("select");
      mode.title = "Override the global Material Function rendering mode for this asset.";
      mode.setAttribute("aria-label", `${node.name} rendering mode`);
      for (const [value, label] of [
        ["", "Inherit"],
        ["types", "Types only"],
        ["helpers", "Helper"],
        ["inline", "Inline"],
      ]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        mode.append(option);
      }
      mode.value = functionModeOverrides.get(node.target) ?? "";
      mode.addEventListener("change", () => {
        if (mode.value) functionModeOverrides.set(node.target, mode.value as FunctionExpansionMode);
        else functionModeOverrides.delete(node.target);
        persistStringMap(sessionStorage, functionModeStorageKey, functionModeOverrides);
        allowLargeInline = false;
        reanalyzeAccepted();
      });
      const paste = document.createElement("button");
      paste.type = "button";
      paste.textContent = node.status === "defined" ? "Replace" : "Paste";
      paste.addEventListener("click", () => void pasteFunctionDefinition(node.target));
      actions.append(mode, paste);
      let remove: HTMLButtonElement | undefined;
      if (node.status === "defined") {
        remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => removeFunctionDefinition(node.target));
      }
      heading.append(title, actions);
      const pasteFallback = document.createElement("textarea");
      pasteFallback.className = "function-definition-paste";
      pasteFallback.rows = 1;
      pasteFallback.spellcheck = false;
      pasteFallback.placeholder = "Begin Object ...";
      pasteFallback.setAttribute("aria-label", `Paste ${node.name} definition`);
      pasteFallback.title = "Click here and press Ctrl+V to paste this Material Function definition.";
      pasteFallback.addEventListener("paste", (event) => {
        const source = event.clipboardData?.getData("text/plain");
        if (!source) return;
        event.preventDefault();
        pasteFallback.value = "";
        acceptFunctionDefinition(node.target, source);
      });
      const pasteRow = document.createElement("div");
      pasteRow.className = "function-definition-paste-row";
      pasteRow.append(pasteFallback);
      if (remove) pasteRow.append(remove);
      card.append(heading, pasteRow);

      if (node.error) {
        const error = document.createElement("p");
        error.className = "function-error";
        error.textContent = node.error;
        card.append(error);
      }
      for (const summary of node.outputs) {
        const variants = summary.variants?.length
          ? summary.variants.map((variant) => ({
              ...variant,
              name: `${summary.name} — ${variant.label}${variant.callCount > 1 ? ` · ${variant.callCount} calls` : ""}`,
            }))
          : [summary];
        for (const variant of variants) {
          const output = functionOutputValue(variant);
          const row = document.createElement("label");
          row.className = "function-output";
          const label = document.createElement("span");
          label.textContent = `Output · ${output.name}`;
          const select = document.createElement("select");
          select.className = `type-select ${output.status}`;
          select.title = output.type
            ? `The loaded graph derives ${output.type}. Choose another type only if Unreal proves otherwise.`
            : "The graph still cannot derive this output type. Choose the type shown inside Unreal.";
          populateTypeSelect(select, output);
          select.addEventListener("change", () => {
            setTypeOverride(output.id, select.value as MaterialType | "");
            reanalyzeAccepted();
          });
          const control = document.createElement("div");
          control.className = "function-output-control";
          control.append(select);
          if (output.status === "unknown" && summary.unresolvedDependencies?.length) {
            const hint = document.createElement("small");
            hint.className = "function-output-hint";
            const names = summary.unresolvedDependencies.join(", ");
            hint.textContent = `Needs ${names} — paste its definition below.`;
            hint.title = "This output depends on a nested Material Function whose definition is missing or invalid.";
            control.append(hint);
          }
          row.append(label, control);
          card.append(row);
        }
      }

      if (node.staticSwitches.length) {
        const switches = document.createElement("div");
        switches.className = "nested-switches";
        for (const control of node.staticSwitches) {
          const label = document.createElement("label");
          label.className = "switch-toggle";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = staticSwitchOverrides.get(control.id) ?? control.value;
          checkbox.title = "Override this Static Switch inside the loaded function definition.";
          const text = document.createElement("span");
          text.textContent = `${control.label}: ${checkbox.checked ? "True" : "False"}`;
          checkbox.addEventListener("change", () => {
            staticSwitchOverrides.set(control.id, checkbox.checked);
            text.textContent = `${control.label}: ${checkbox.checked ? "True" : "False"}`;
            reanalyzeAccepted();
          });
          label.append(checkbox, text);
          switches.append(label);
        }
        card.append(switches);
      }
      if (node.children.length) {
        const children = document.createElement("div");
        children.className = "function-children";
        children.append(renderNodes(node.children, depth + 1));
        card.append(children);
      }
      fragment.append(card);
    }
    return fragment;
  };
  materialFunctions.replaceChildren(renderNodes(result.functionTree, 0));
}

function renderTypeOverrides(result: AnalysisResult): void {
  const groups = result.typeOverrideGroups.filter((group) => group.kind === "custom-node");
  customCount.textContent = String(groups.length);
  if (groups.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No unresolved Custom HLSL inputs in this output.";
    typeOverridesPanel.replaceChildren(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const group of groups) {
    const card = document.createElement("section");
    const hasUnknown = group.values.some((output) => output.status === "unknown");
    const hasInferred = group.values.some(
      (output) => output.status === "inferred" || output.status === "minimum",
    );
    card.className = `function-card ${hasUnknown ? "unknown" : hasInferred ? "inferred" : "overridden"}`;

    const heading = document.createElement("div");
    heading.className = "function-heading";
    const name = document.createElement("strong");
    name.textContent = group.name;
    heading.append(name);
    card.append(heading);

    for (const output of group.values) {
      const row = document.createElement("label");
      row.className = "function-output";
      const outputName = document.createElement("span");
      outputName.textContent = `${group.kind === "custom-node" ? "Input" : "Output"} · ${output.name}`;
      const select = document.createElement("select");
      select.className = `type-select ${output.status}`;
      select.setAttribute("aria-label", `${group.name} ${output.name} type`);
      select.title = output.status === "overridden"
        ? "This type is manually selected. Choose Auto to return to graph inference."
        : output.status === "minimum"
          ? `The graph proves at least ${output.type}, but not one exact type. Choose the actual type used in Unreal.`
          : output.status === "inferred"
            ? `The graph currently infers ${output.type}. Override it only if Unreal shows a different type.`
            : group.kind === "custom-node"
              ? "Choose the type this Custom HLSL input expects; the connected graph could not determine it."
              : "Choose the type returned by this Material Function output, as shown inside the function in Unreal.";

      populateTypeSelect(select, output);
      select.addEventListener("change", () => {
        setTypeOverride(output.id, select.value as MaterialType | "");
        if (!acceptedSource) return;
        reanalyzeAccepted();
      });
      row.append(outputName, select);
      card.append(row);
    }
    fragment.append(card);
  }
  typeOverridesPanel.replaceChildren(fragment);
}

function renderStaticSwitches(result: AnalysisResult): void {
  switchCount.textContent = String(result.staticSwitches.length);
  if (result.staticSwitches.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No Static Switches in this output.";
    staticSwitches.replaceChildren(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const [index, control] of result.staticSwitches.entries()) {
    const card = document.createElement("section");
    card.className = `switch-card ${control.resolved ? "resolved" : "unresolved"}`;

    const heading = document.createElement("div");
    heading.className = "switch-heading";
    const name = document.createElement("strong");
    name.textContent = `${index + 1}. ${control.label}`;
    const toggle = document.createElement("label");
    toggle.className = "switch-toggle";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = control.value;
    checkbox.setAttribute("aria-label", `${control.label}: ${control.value ? "True" : "False"}`);
    checkbox.title = "Override the clipboard Static Switch value and regenerate pseudo-HLSL using the selected branch.";
    const state = document.createElement("span");
    state.textContent = control.value ? "True" : "False";
    checkbox.addEventListener("change", () => {
      staticSwitchOverrides.set(control.id, checkbox.checked);
      reanalyzeAccepted();
    });
    toggle.append(checkbox, state);
    heading.append(name, toggle);

    const details = document.createElement("dl");
    details.className = "switch-details";
    for (const [term, description] of [
      ["True", control.trueSource],
      ["False", control.falseSource],
      ["Feeds", control.feeds.join(", ") || "Graph output"],
    ]) {
      const label = document.createElement("dt");
      label.textContent = term;
      const value = document.createElement("dd");
      value.textContent = description;
      details.append(label, value);
    }
    card.append(heading, details);
    fragment.append(card);
  }
  staticSwitches.replaceChildren(fragment);
}

function renderAccepted(result: AnalysisResult): void {
  closeCodePopover();
  outputSelect.replaceChildren();
  for (const output of result.outputs) {
    const option = document.createElement("option");
    option.value = output.id;
    option.textContent = output.label;
    option.selected = output.id === result.selectedOutputId;
    outputSelect.append(option);
  }
  outputSelect.disabled = result.outputs.length === 0;
  bundleFormat.disabled = result.outputs.length === 0;
  renderCode(result);
  copyButton.disabled = !result.code;
  inputMeta.textContent = `${result.nodeCount} nodes · ${result.outputs.length} outputs`;
  const warnings = renderDiagnostics(result);
  renderStaticSwitches(result);
  renderMaterialFunctions(result);
  renderTypeOverrides(result);
  generateLargeInline.hidden = !result.inlineExpansion?.blocked;
  let reviewTypes = 0;
  const reviewedFunctionOutputs = new Set<string>();
  for (const item of result.typeOverrideGroups.filter((group) => group.kind === "custom-node")) {
    for (const output of item.values) {
      if (output.status !== "overridden") reviewTypes += 1;
    }
  }
  const reviewFunctionTypes = (nodes: readonly FunctionDependencyNode[]): void => {
    for (const node of nodes) {
      for (const output of node.outputs) {
        if (!reviewedFunctionOutputs.has(output.id) && !typeOverrides.has(output.id) && !output.type) {
          reviewTypes += 1;
          reviewedFunctionOutputs.add(output.id);
        }
      }
      reviewFunctionTypes(node.children);
    }
  };
  reviewFunctionTypes(result.functionTree);
  setStatus(
    volatileFunctionLibrary
      ? "Analysis completed, but sessionStorage is full. Loaded definitions will be lost on refresh."
      : result.inlineExpansion?.blocked
      ? `Inline expansion would create about ${result.inlineExpansion.estimatedNodes.toLocaleString()} nodes. Confirm to generate it.`
      : warnings
      ? `Analysis completed with ${warnings} diagnostic${warnings === 1 ? "" : "s"}.`
      : reviewTypes
        ? `Analysis completed. Review ${reviewTypes} unresolved or inferred type${reviewTypes === 1 ? "" : "s"}.`
        : "Analysis completed.",
    warnings || reviewTypes ? "warning" : "success",
  );
}

function analyzeRequestedSource(): void {
  const source = clipboard.value;
  if (!source.trim()) {
    setStatus("Paste Unreal clipboard text first.", "error");
    return;
  }

  const workspace = createAnalysisWorkspace(source, functionDefinitions);
  const result = workspace.analyze({
    ...currentRequest(),
    outputId: undefined,
  });
  const failed = result.outputs.length === 0 || result.diagnostics.some(
    (item) => item.severity === "error" && item.code !== "graph-cycle",
  );
  if (failed) {
    renderDiagnostics(result);
    setStatus(
      acceptedResult
        ? "This clipboard is structurally incomplete. The previous successful code is preserved."
        : "This clipboard is structurally incomplete; no code was generated.",
      "error",
    );
    return;
  }

  acceptedSource = source;
  acceptedWorkspace = workspace;
  typeOverrides.clear();
  staticSwitchOverrides.clear();
  allowLargeInline = false;
  acceptedResult = result;
  renderAccepted(result);
}

function reanalyzeAccepted(): void {
  if (!acceptedWorkspace) return;
  acceptedResult = acceptedWorkspace.analyze(currentRequest());
  renderAccepted(acceptedResult);
}

function applyCodePopover(): void {
  const state = codePopoverState;
  if (!state) return;

  if (state.kind === "type") {
    setTypeOverride(state.output.id, codePopoverType.value as MaterialType | "");
    reanalyzeAccepted();
    return;
  }

  const name = codePopoverInput.value.trim();
  if (!/^[A-Za-z_]\w*$/.test(name) || reservedVariableNames.has(name)) {
    codePopoverError.textContent = "Use an HLSL-style name: letters, digits, and underscores; do not start with a digit.";
    codePopoverError.hidden = false;
    return;
  }
  const scopeStart = state.symbol.startLine ?? 0;
  const scopeEnd = state.symbol.endLine ?? Number.POSITIVE_INFINITY;
  if (acceptedResult?.editableSymbols.some((symbol) =>
    symbol.id !== state.symbol.id
    && symbol.name === name
    && (symbol.startLine ?? 0) <= scopeEnd
    && (symbol.endLine ?? Number.POSITIVE_INFINITY) >= scopeStart)) {
    codePopoverError.textContent = "This name is already used by another declaration.";
    codePopoverError.hidden = false;
    return;
  }
  if (name === state.symbol.name) nameOverrides.delete(state.symbol.id);
  else nameOverrides.set(state.symbol.id, name);
  persistNameOverrides();
  reanalyzeAccepted();
}

codePopoverApply.addEventListener("click", applyCodePopover);
codePopoverReset.addEventListener("click", () => {
  if (!codePopoverState) return;
  if (codePopoverState.kind === "type") setTypeOverride(codePopoverState.output.id, "");
  else {
    nameOverrides.delete(codePopoverState.symbol.id);
    persistNameOverrides();
  }
  reanalyzeAccepted();
});
for (const control of [codePopoverInput, codePopoverType]) {
  control.addEventListener("keydown", (event) => {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.key === "Enter") applyCodePopover();
    if (event.key === "Escape") closeCodePopover();
  });
}
document.addEventListener("pointerdown", (event) => {
  const target = event.target;
  if (!codePopover.hidden && target instanceof Node && !codePopover.contains(target)) closeCodePopover();
});

outputSelect.addEventListener("change", () => {
  allowLargeInline = false;
  reanalyzeAccepted();
});

bundleFormat.addEventListener("change", () => {
  formatting.bundleFormat = bundleFormat.value as AnalysisFormatting["bundleFormat"];
  reanalyzeAccepted();
});

functionModeSelect.addEventListener("change", () => {
  functionMode = functionModeSelect.value as FunctionExpansionMode;
  allowLargeInline = false;
  reanalyzeAccepted();
});

showSections.addEventListener("change", () => {
  formatting.commentSections = showSections.checked;
  reanalyzeAccepted();
});

expandCustomNodes.addEventListener("change", () => {
  formatting.expandCustomNodes = expandCustomNodes.checked;
  reanalyzeAccepted();
});

wrapCalls.addEventListener("change", () => {
  formatting.multilineCalls = wrapCalls.checked;
  reanalyzeAccepted();
});

renderIfStatements.addEventListener("change", () => {
  formatting.ifElseStatements = renderIfStatements.checked;
  reanalyzeAccepted();
});

spaceOperations.addEventListener("change", () => {
  formatting.spaceComplexOperations = spaceOperations.checked;
  reanalyzeAccepted();
});

simplifyAlgebra.addEventListener("change", () => {
  formatting.simplifyAlgebra = simplifyAlgebra.checked;
  reanalyzeAccepted();
});

syntaxHighlighting.addEventListener("change", () => {
  code.classList.toggle("syntax-disabled", !syntaxHighlighting.checked);
});

showLineNumbers.addEventListener("change", () => {
  code.classList.toggle("line-numbers", showLineNumbers.checked);
});

codeSearchInput.addEventListener("input", updateCodeSearch);
codeSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    focusCodeSearchMatch(activeCodeSearchMatch + (event.shiftKey ? -1 : 1));
  }
  if (event.key === "Escape") {
    event.preventDefault();
    codeSearchInput.value = "";
    updateCodeSearch();
    codeSearchInput.blur();
  }
});
codeSearchPrevious.addEventListener("click", () => focusCodeSearchMatch(activeCodeSearchMatch - 1));
codeSearchNext.addEventListener("click", () => focusCodeSearchMatch(activeCodeSearchMatch + 1));
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
    event.preventDefault();
    focusCodeSearch();
  }
});

clearFunctionLibrary.addEventListener("click", () => {
  replaceDefinitions(new Map());
  functionModeOverrides.clear();
  persistStringMap(sessionStorage, functionModeStorageKey, functionModeOverrides);
  if (!acceptedSource) return;
  acceptedWorkspace = createAnalysisWorkspace(acceptedSource);
  acceptedResult = acceptedWorkspace.analyze(currentRequest());
  renderAccepted(acceptedResult);
});

generateLargeInline.addEventListener("click", () => {
  allowLargeInline = true;
  reanalyzeAccepted();
});

copyButton.addEventListener("click", async () => {
  if (!acceptedResult?.code) return;
  try {
    await navigator.clipboard.writeText(acceptedResult.code);
    window.clearTimeout(copyFeedbackTimer);
    copyButton.textContent = "Copied";
    copyButton.classList.add("copied");
    copyFeedbackTimer = window.setTimeout(() => {
      copyButton.textContent = "Copy code";
      copyButton.classList.remove("copied");
    }, 1400);
    setStatus("Pseudo-HLSL copied.", "success");
  } catch (error) {
    setStatus(`Could not copy code: ${error instanceof Error ? error.message : String(error)}`, "error");
  }
});

pasteButton.addEventListener("click", async () => {
  try {
    clipboard.value = await navigator.clipboard.readText();
    clipboard.dispatchEvent(new Event("input"));
  } catch (error) {
    setStatus(`Could not read clipboard: ${error instanceof Error ? error.message : String(error)}`, "error");
  }
});

clipboard.addEventListener("input", () => {
  const lines = clipboard.value ? clipboard.value.split(/\r?\n/).length : 0;
  inputMeta.textContent = lines ? `${lines} lines` : "Waiting for Unreal clipboard text";
  analyzeRequestedSource();
});
