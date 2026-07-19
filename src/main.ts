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
const code = element<HTMLElement>("code").querySelector("code")!;
const diagnostics = element<HTMLOListElement>("diagnostics");
const staticSwitches = element<HTMLDivElement>("static-switches");
const typeOverridesPanel = element<HTMLDivElement>("type-overrides");
const diagnosticCount = element<HTMLSpanElement>("diagnostic-count");
const functionCount = element<HTMLSpanElement>("function-count");
const switchCount = element<HTMLSpanElement>("switch-count");
const inputMeta = element<HTMLSpanElement>("input-meta");
const status = element<HTMLParagraphElement>("status");
const codeTokenPattern = /(\/\/.*|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\?(?:float[2-4]?\+?|bool|type)(?!\w)|\b(?:const|return|static)\b|\b(?:float[2-4]?|bool|Texture2D(?:Array)?|TextureCube(?:Array)?|Texture3D|TextureExternal|SparseVolumeTexture|MaterialAttributes|Substrate|ShadingModel)\b|\b\d+(?:\.\d+)?f?\b|\b[A-Za-z_]\w*(?=\s*\())/g;
const typeTokenPattern = /^(?:float[2-4]?|bool|Texture2D(?:Array)?|TextureCube(?:Array)?|Texture3D|TextureExternal|SparseVolumeTexture|MaterialAttributes|Substrate|ShadingModel)$/;
const keywordTokenPattern = /^(?:const|return|static)$/;

let acceptedSource = "";
let acceptedResult: AnalysisResult | undefined;
let copyFeedbackTimer: number | undefined;
const typeOverrides = new Map<string, MaterialType>();
const staticSwitchOverrides = new Map<string, boolean>();
const formatting: AnalysisFormatting = { ...defaultAnalysisFormatting };

function setStatus(message: string, kind = ""): void {
  status.textContent = message;
  status.className = kind;
}

function renderCode(source: string): void {
  const fragment = document.createDocumentFragment();
  const lines = source.split("\n");
  for (const [lineIndex, line] of lines.entries()) {
    let cursor = 0;
    for (const match of line.matchAll(codeTokenPattern)) {
      const token = match[0];
      const index = match.index ?? 0;
      fragment.append(document.createTextNode(line.slice(cursor, index)));
      const span = document.createElement("span");
      span.textContent = token;
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
                    : "token-function";
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

      const automatic = document.createElement("option");
      automatic.value = "";
      automatic.textContent = output.status === "unknown"
        ? "Unknown — select type"
        : output.status === "minimum"
          ? `Auto · ?${output.type}+`
          : output.status === "inferred"
            ? `Auto · ?${output.type}`
            : "Auto · infer from graph";
      select.append(automatic);
      for (const type of materialTypeOptions) {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type;
        select.append(option);
      }
      select.value = output.status === "overridden" && output.type ? output.type : "";
      select.addEventListener("change", () => {
        if (select.value) typeOverrides.set(output.id, select.value as MaterialType);
        else typeOverrides.delete(output.id);
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
  renderCode(result.code);
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

  const result = analyzeClipboard(source, { formatting });
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
    formatting,
  });
  renderAccepted(acceptedResult);
}

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
