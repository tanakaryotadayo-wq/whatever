export const NONTERMINAL = new Set(["SUBMITTED", "WORKING", "INPUT_REQUIRED"]);
export const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELED"]);
export const TRANSITIONS = new Map([
  ["SUBMITTED", new Set(["WORKING", "FAILED", "CANCELED"])],
  ["WORKING", new Set(["INPUT_REQUIRED", "COMPLETED", "FAILED", "CANCELED"])],
  ["INPUT_REQUIRED", new Set(["WORKING", "FAILED", "CANCELED"])],
  ["COMPLETED", new Set()],
  ["FAILED", new Set()],
  ["CANCELED", new Set()],
]);

export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

export async function sha256Text(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function validateTask(task) {
  if (!task || typeof task !== "object" || Array.isArray(task)) throw new Error("task must be an object");
  for (const key of ["task_id", "context_id", "attempt_id", "goal"]) {
    if (typeof task[key] !== "string" || !task[key].trim()) throw new Error(`task.${key} is required`);
  }
  if (!Array.isArray(task.acceptance) || task.acceptance.length === 0) {
    throw new Error("task.acceptance must be a non-empty array");
  }
  return structuredClone(task);
}

export function validateTransition(from, to) {
  const allowed = TRANSITIONS.get(from);
  if (!allowed || !allowed.has(to)) throw new Error(`illegal transition ${from} -> ${to}`);
}

export function appendEvent(snapshot, kind, toState, patch = {}) {
  validateTransition(snapshot.state, toState);
  const seq = snapshot.seq + 1;
  const event = {
    schema: "akashic.task-event/v1",
    task_id: snapshot.task_id,
    seq,
    kind,
    from_state: snapshot.state,
    to_state: toState,
    at: new Date().toISOString(),
    patch,
  };
  const next = {
    ...snapshot,
    ...patch,
    state: toState,
    seq,
    terminal: TERMINAL.has(toState),
    updated_at: event.at,
    events: [...snapshot.events, event].slice(-256),
  };
  return { event, snapshot: next };
}
