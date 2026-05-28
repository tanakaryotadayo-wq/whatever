# Codex A2A Worker

This repository includes a minimal A2A-style gateway for running bounded Codex tasks from another agent or orchestrator.

The implementation is intentionally small:

- `agents/codex.agent-card.json` describes the worker.
- `tools/codex_a2a_worker.py` serves a minimal HTTP JSON-RPC endpoint.
- `schemas/codex_task.schema.json` defines accepted task input.
- `schemas/codex_result.schema.json` defines the expected Codex output contract.
- `examples/codex_a2a.request.json` shows a request envelope.

## Safety default

The gateway starts in dry-run mode by default.

It does **not** execute Codex unless this environment variable is set:

```bash
export CODEX_A2A_ENABLE_EXEC=1
```

Without that variable, the worker returns the planned `codex exec` command and prompt preview only.

## Start the worker

```bash
python3 tools/codex_a2a_worker.py --host 127.0.0.1 --port 8765
```

Check health:

```bash
curl http://127.0.0.1:8765/healthz
```

Fetch the agent card:

```bash
curl http://127.0.0.1:8765/.well-known/agent.json
```

## Send a dry-run task

```bash
curl -sS \
  -H 'Content-Type: application/json' \
  --data @examples/codex_a2a.request.json \
  http://127.0.0.1:8765/a2a | jq
```

## Enable execution

Execution requires `codex` on PATH or `CODEX_BIN` pointing to the executable.

```bash
export OPENAI_API_KEY=...
export CODEX_A2A_ENABLE_EXEC=1
export CODEX_A2A_TIMEOUT_SEC=1800
python3 tools/codex_a2a_worker.py --host 127.0.0.1 --port 8765
```

The worker converts the task into:

```bash
codex exec \
  --json \
  --cd "$WORKSPACE" \
  --sandbox workspace-write \
  --output-schema schemas/codex_result.schema.json \
  -
```

The prompt is sent through stdin.

## Recommended orchestration

Use this worker as a bounded implementation/review node, not as a GitHub operator.

Recommended separation:

```text
AICLI / Shinon
  -> Codex A2A worker for local implementation and review
  -> Sovereign Search for public implementation discovery
  -> GitHub operator for PR creation and comments
  -> Human gate for merge, deploy, deletion, and secret-affecting actions
```

## Sovereign Search integration

A task can request public implementation discovery with:

```json
"use_sovereign_search": true
```

The current gateway does not directly call `sovereign_search` before Codex. Instead, it instructs Codex to use the available tool surface when the runtime exposes it.

For stricter orchestration, have AICLI run `tools/sovereign_search_tool.py` first, then pass summarized provenance to this worker.

## Notes

This is not a full A2A protocol implementation. It is a minimal, compatible-ish worker surface:

- `GET /.well-known/agent.json`
- `GET /healthz`
- `POST /a2a` with `message/send` or `tasks/send`

That is enough for local orchestration experiments and can be replaced by a full A2A server later.
