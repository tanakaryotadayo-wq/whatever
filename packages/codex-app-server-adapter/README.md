# `@akashic/codex-app-server-adapter`

Provider adapter for the official Codex App Server JSONL protocol.

Core guarantees:

- initialize/initialized before any other RPC;
- visible model selection from `model/list`;
- one `thread/start` and two `turn/start` calls on the same thread;
- `turn/completed` is the completion authority;
- outputSchema-constrained `INPUT_REQUIRED` and `COMPLETED` results;
- delta-only second turn;
- `turn/interrupt` on timeout;
- fail-closed handling of approvals or any other inbound server request;
- version-matched generated protocol schema and sanitized evidence.

The provider-live gate requires a self-hosted runner with an authenticated
official `codex` binary. Fixture tests do not count as provider certification.
