const storageKey = "ue5-material-graph-interpreter:layout";
const handleSize = 7;
const snapDistance = 14;
const minimumLeftPane = 180;
const minimumRightPane = 170;

export type LayoutState = {
  left: number;
  right: number;
  input: number;
};

type Resizer = "left" | "right" | "input";

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

function defaults(width: number, height: number): LayoutState {
  return {
    left: clamp(width * 0.23, 210, 270),
    right: clamp(width * 0.2, 190, 240),
    input: clamp(height * 0.25, 180, 230),
  };
}

export function constrainLayout(width: number, height: number, state: LayoutState): LayoutState {
  const centerMinimum = Math.min(360, width * 0.38);
  const sidePaneBudget = Math.max(
    minimumLeftPane + minimumRightPane,
    width - centerMinimum - handleSize * 2,
  );
  const left = clamp(state.left, minimumLeftPane, sidePaneBudget - minimumRightPane);
  const right = clamp(state.right, minimumRightPane, sidePaneBudget - left);
  return {
    left,
    right,
    input: clamp(state.input, 130, height - 180 - handleSize),
  };
}

function readStoredState(): LayoutState | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) ?? "");
    return value
      && Number.isFinite(value.left)
      && Number.isFinite(value.right)
      && Number.isFinite(value.input)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

export function mountResizableWorkspace(workspace: HTMLElement): void {
  const mobileLayout = window.matchMedia("(max-width: 900px)");
  const handles = [...workspace.querySelectorAll<HTMLElement>("[data-resize]")];
  let state = readStoredState() ?? defaults(workspace.clientWidth, workspace.clientHeight);

  const apply = (): void => {
    if (mobileLayout.matches) return;
    const { width, height } = workspace.getBoundingClientRect();
    state = constrainLayout(width, height, state);
    workspace.style.setProperty("--left-pane", `${state.left}px`);
    workspace.style.setProperty("--right-pane", `${state.right}px`);
    workspace.style.setProperty("--input-pane", `${state.input}px`);
    for (const handle of handles) {
      const kind = handle.dataset.resize as Resizer;
      handle.setAttribute("aria-valuenow", String(Math.round(state[kind])));
    }
  };

  const save = (): void => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Layout persistence is optional; resizing must keep working.
    }
  };

  const reset = (kind: Resizer): void => {
    state[kind] = defaults(workspace.clientWidth, workspace.clientHeight)[kind];
    apply();
    save();
  };

  const resize = (kind: Resizer, clientX: number, clientY: number): void => {
    const rect = workspace.getBoundingClientRect();
    const target = defaults(rect.width, rect.height)[kind];
    const next = kind === "left"
      ? clientX - rect.left
      : kind === "right"
        ? rect.right - clientX
        : clientY - rect.top;
    state[kind] = Math.abs(next - target) <= snapDistance ? target : next;
    apply();
  };

  for (const handle of handles) {
    const kind = handle.dataset.resize as Resizer;
    handle.addEventListener("pointerdown", (event) => {
      if (mobileLayout.matches) return;
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      document.body.classList.add("resizing-layout", `resizing-${kind === "input" ? "row" : "column"}`);
      const move = (moveEvent: PointerEvent): void => resize(kind, moveEvent.clientX, moveEvent.clientY);
      const stop = (): void => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        handle.removeEventListener("lostpointercapture", stop);
        document.body.classList.remove("resizing-layout", "resizing-row", "resizing-column");
        save();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop, { once: true });
      handle.addEventListener("lostpointercapture", stop, { once: true });
    });
    handle.addEventListener("dblclick", () => reset(kind));
    handle.addEventListener("keydown", (event) => {
      const direction = kind === "input"
        ? event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0
        : event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
      if (!direction) return;
      event.preventDefault();
      state[kind] += direction * (kind === "right" ? -10 : 10);
      apply();
      save();
    });
  }

  new ResizeObserver(apply).observe(workspace);
  apply();
}
