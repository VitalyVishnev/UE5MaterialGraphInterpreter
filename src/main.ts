import "./styles.css";
import {
  analyzeClipboard,
  defaultAnalysisFormatting,
  materialTypeOptions,
  type AnalysisFormatting,
  type AnalysisResult,
  type MaterialType,
} from "./analyze";

const element = <T extends HTMLElement>(id: string): T => {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing UI element: ${id}`);
  return value as T;
};

const clipboard = element<HTMLTextAreaElement>("clipboard");
const pasteButton = element<HTMLButtonElement>("paste-clipboard");
const outputSelect = element<HTMLSelectElement>("output-select");
const copyButton = element<HTMLButtonElement>("copy-code");
const bundleFormat = element<HTMLSelectElement>("bundle-format");
const showSections = element<HTMLInputElement>("show-sections");
const expandCustomNodes = element<HTMLInputElement>("expand-custom-nodes");
const wrapCalls = element<HTMLInputElement>("wrap-calls");
const spaceOperations = element<HTMLInputElement>("space-operations");
const simplifyAlgebra = element<HTMLInputElement>("simplify-algebra");
const syntaxHighlighting = element<HTMLInputElement>("syntax-highlighting");
const code = element<HTMLElement>("code").querySelector("code")!;
const diagnostics = element<HTMLOListElement>("diagnostics");
const staticSwitches = element<HTMLDivElement>("static-switches");
const typeOverridesPanel = element<HTMLDivElement>("type-overrides");
const diagnosticCount = element<HTMLSpanElement>("diagnostic-count");
const functionCount = element<HTMLSpanElement>("function-count");
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
const reservedVariableNames = new Set(["const", "return", "static", "bool", "float", "float2", "float3", "float4"]);

type EditableSymbol = AnalysisResult["editableSymbols"][number];
type TypeOverrideValue = AnalysisResult["typeOverrideGroups"][number]["values"][number];
type CodePopoverState =
  | { kind: "rename"; symbol: EditableSymbol }
  | { kind: "type"; symbol: EditableSymbol; output: TypeOverrideValue };

let acceptedSource = "";
let acceptedResult: AnalysisResult | undefined;
let copyFeedbackTimer: number | undefined;
const typeOverrides = new Map<string, MaterialType>();
const staticSwitchOverrides = new Map<string, boolean>();
const formatting: AnalysisFormatting = { ...defaultAnalysisFormatting };
const nameOverrides = loadNameOverrides();
let codePopoverState: CodePopoverState | undefined;

function loadNameOverrides(): Map<string, string> {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(nameOverrideStorageKey) ?? "[]");
    if (!Array.isArray(parsed)) return new Map();
    return new Map(parsed.filter((entry): entry is [string, string] =>
      Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "string",
    ));
  } catch {
    return new Map();
  }
}

function persistNameOverrides(): void {
  try {
    sessionStorage.setItem(nameOverrideStorageKey, JSON.stringify([...nameOverrides]));
  } catch {
    // Session storage is optional; the active page still keeps the override.
  }
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
  const symbols = new Map(result.editableSymbols.map((symbol) => [symbol.name, symbol]));
  const types = new Map(result.typeOverrideGroups.flatMap((group) =>
    group.values.map((output) => [output.id, output] as const),
  ));
  const lines = result.code.split("\n");
  for (const [lineIndex, line] of lines.entries()) {
    let cursor = 0;
    for (const match of line.matchAll(codeTokenPattern)) {
      const token = match[0];
      const index = match.index ?? 0;
      fragment.append(document.createTextNode(line.slice(cursor, index)));
      const span = document.createElement("span");
      span.textContent = token;
      const remainingLine = line.slice(index + token.length);
      const followingIdentifier = remainingLine.match(/^\s+([A-Za-z_]\w*)/)?.[1];
      const symbol = symbols.get(token);
      const typeOverride = token.startsWith("?") && followingIdentifier
        ? types.get(symbols.get(followingIdentifier)?.typeOverrideId ?? "")
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
      if (typeOverride && symbol === undefined) {
        span.dataset.typeOverrideId = typeOverride.id;
        const open = () => openTypePopover(symbols.get(followingIdentifier!)!, typeOverride, span);
        makeInteractiveCodeToken(span, "code-type-override", "Choose this output type", open);
      } else if (symbol) {
        span.dataset.symbolId = symbol.id;
        const open = () => openRenamePopover(symbol, span);
        makeInteractiveCodeToken(span, "code-symbol", `Rename ${symbol.name}`, open);
      }
      fragment.append(span);
      cursor = index + token.length;
      if (token.startsWith("//")) break;
    }
    fragment.append(document.createTextNode(line.slice(cursor)));
    if (lineIndex < lines.length - 1) fragment.append(document.createTextNode("\n"));
  }
  code.replaceChildren(fragment);
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

function renderTypeOverrides(result: AnalysisResult): void {
  functionCount.textContent = String(result.typeOverrideGroups.length);
  if (result.typeOverrideGroups.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No unresolved or inferred types in this output.";
    typeOverridesPanel.replaceChildren(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const group of result.typeOverrideGroups) {
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
  renderTypeOverrides(result);
  let reviewTypes = 0;
  for (const item of result.typeOverrideGroups) {
    for (const output of item.values) {
      if (output.status !== "overridden") reviewTypes += 1;
    }
  }
  setStatus(
    warnings
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

  const result = analyzeClipboard(source, { formatting, nameOverrides });
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
  typeOverrides.clear();
  staticSwitchOverrides.clear();
  acceptedResult = result;
  renderAccepted(result);
}

function reanalyzeAccepted(): void {
  if (!acceptedSource) return;
  acceptedResult = analyzeClipboard(acceptedSource, {
    outputId: outputSelect.value,
    typeOverrides,
    staticSwitchOverrides,
    nameOverrides,
    formatting,
  });
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
  if (acceptedResult?.editableSymbols.some((symbol) => symbol.id !== state.symbol.id && symbol.name === name)) {
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

outputSelect.addEventListener("change", reanalyzeAccepted);

bundleFormat.addEventListener("change", () => {
  formatting.bundleFormat = bundleFormat.value as AnalysisFormatting["bundleFormat"];
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
