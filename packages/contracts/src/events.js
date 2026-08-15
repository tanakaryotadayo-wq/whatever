const TRACEPARENT = /^[\da-f]{2}-[\da-f]{32}-[\da-f]{16}-[\da-f]{2}$/;
export function validateTraceparent(value) {
  if (typeof value !== "string" || !TRACEPARENT.test(value)) throw new TypeError("invalid W3C traceparent");
  const [version, traceId, parentId] = value.split("-");
  if (version === "ff" || /^0+$/.test(traceId) || /^0+$/.test(parentId)) throw new TypeError("invalid W3C traceparent identifiers");
  return value;
}
export function makeCloudEvent(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("CloudEvent input must be an object");
  for (const key of ["id", "source", "type", "subject"]) if (typeof input[key] !== "string" || input[key].length === 0) throw new TypeError(`CloudEvent ${key} is required`);
  const event = { specversion: "1.0", id: input.id, source: input.source, type: input.type, subject: input.subject, time: new Date(input.time ?? Date.now()).toISOString(), datacontenttype: input.datacontenttype ?? "application/json", data: structuredClone(input.data ?? null) };
  if (input.dataschema !== undefined) event.dataschema = input.dataschema;
  if (input.traceparent !== undefined) event.traceparent = validateTraceparent(input.traceparent);
  if (input.tracestate !== undefined) { if (typeof input.tracestate !== "string" || input.tracestate.length > 512) throw new TypeError("invalid tracestate"); event.tracestate = input.tracestate; }
  return event;
}
export function taskEventSubject(taskId) { if (typeof taskId !== "string" || taskId.length === 0) throw new TypeError("taskId is required"); return `tasks/${encodeURIComponent(taskId)}`; }
