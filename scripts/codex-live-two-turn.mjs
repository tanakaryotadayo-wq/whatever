// Compatibility entrypoint. The certification now uses the official
// codex app-server JSONL protocol rather than `codex exec resume`.
await import("./codex-app-server-live-two-turn.mjs");
