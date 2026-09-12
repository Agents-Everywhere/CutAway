// This thin connector is a protected host boundary, excluded from runtime edits.
export type SelectionId =
  "booking.capacity" | "booking.submit" | "booking.reservations";
export interface ConnectorConfig {
  revision: string;
  runId: string;
  shellOrigin: string;
}

const eventId = "pottery-saturday";
const bindings: Record<SelectionId, { label: string; sourceKey: string }> = {
  "booking.capacity": {
    label: "Workshop availability",
    sourceKey: "src/server/reservations.ts",
  },
  "booking.submit": {
    label: "Reservation form",
    sourceKey: "src/client/main.tsx",
  },
  "booking.reservations": {
    label: "Confirmed reservations",
    sourceKey: "src/server/reservations.ts",
  },
};

function isSelection(value: unknown): value is SelectionId {
  return typeof value === "string" && Object.hasOwn(bindings, value);
}

export function connectToCutaway(config: ConnectorConfig) {
  const parameters = new URLSearchParams(location.search);
  const runId = parameters.get("runId") || config.runId;
  const surface =
    parameters.get("surface") === "preview" ? "preview" : "current";
  let selectedId: SelectionId | null = null;
  let selecting = false;
  const post = (message: object) => {
    if (window.parent !== window)
      window.parent.postMessage(message, config.shellOrigin);
  };
  const publishContext = () => {
    const element = selectedId
      ? document.querySelector<HTMLElement>(`[data-cutaway-id="${selectedId}"]`)
      : null;
    const rect = element?.getBoundingClientRect();
    post({
      protocol: 1,
      type: "context",
      context: {
        protocol: 1,
        runId,
        targetId: "fieldnote",
        targetRevision: config.revision,
        route: location.pathname,
        eventId,
        selected:
          selectedId && rect
            ? {
                id: selectedId,
                ...bindings[selectedId],
                rect: {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height,
                },
              }
            : null,
        surface,
      },
    });
  };
  const select = (id: SelectionId | null) => {
    document
      .querySelectorAll("[data-cutaway-selected]")
      .forEach((el) => el.removeAttribute("data-cutaway-selected"));
    selectedId = id;
    if (id)
      document
        .querySelector(`[data-cutaway-id="${id}"]`)
        ?.setAttribute("data-cutaway-selected", "true");
    publishContext();
  };
  const restored = () =>
    post({
      protocol: 1,
      type: "restored",
      runId,
      revision: config.revision,
      eventId,
    });
  const onMessage = (event: MessageEvent<unknown>) => {
    if (event.source !== window.parent || event.origin !== config.shellOrigin)
      return;
    if (!event.data || typeof event.data !== "object") return;
    const message = event.data as Record<string, unknown>;
    if (message.protocol !== 1 || message.runId !== runId) return;
    if (message.type === "select" && typeof message.enabled === "boolean") {
      selecting = message.enabled;
      document.body.classList.toggle("cutaway-selecting", selecting);
    } else if (
      message.type === "restore" &&
      message.eventId === eventId &&
      typeof message.route === "string" &&
      /^\/(?!\/)[a-zA-Z0-9/_-]*$/.test(message.route) &&
      (message.selectedId === null || isSelection(message.selectedId))
    ) {
      history.replaceState(null, "", `${message.route}${location.search}`);
      select(message.selectedId);
      restored();
    }
  };
  const onClick = (event: MouseEvent) => {
    if (!selecting || !(event.target instanceof Element)) return;
    const element = event.target.closest<HTMLElement>("[data-cutaway-id]");
    const id = element?.dataset.cutawayId;
    if (!isSelection(id)) return;
    event.preventDefault();
    event.stopPropagation();
    selecting = false;
    document.body.classList.remove("cutaway-selecting");
    select(id);
  };
  window.addEventListener("message", onMessage);
  document.addEventListener("click", onClick, true);
  post({ protocol: 1, type: "hello", runId, revision: config.revision });
  publishContext();
  restored();
  return {
    open: () => post({ protocol: 1, type: "open", runId }),
    disconnect: () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("click", onClick, true);
      document.body.classList.remove("cutaway-selecting");
    },
  };
}
