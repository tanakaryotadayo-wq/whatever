# Codex A2A Worker

This repository includes a bounded A2A-style gateway for running Codex tasks from another agent or orchestrator.

The implementation is intentionally small:

- `agents/codex.agent-card.json` describes the worker.
- `tools/codex_a2a_worker.py` serves a minimal HTTP JSON-RPC endpoint.
- `schemas/codex_task.schema.json` defines accepted task input.
- `schemas/codex_result.schema.json` defines the expected Codex output contract.
- `examples/codex_a2a.request.json` shows a request envelope.

## Execution model

The gateway executes by default. This follows the cognitive compiler model: the compiler (Shinon) has already reasoned about the task and emitted a bounded Task Capsule. The executor (Codex) follows the capsule.

To opt in to preview mode (returns planned command and prompt without executing):

```bash
export CODEX_A2A_MODE=preview
```

Without that variable, the worker executes immediately.

## Codex authentication model

Codex CLI can be used through a signed-in ChatGPT account that includes Codex access. An API key is optional, not the default requirement.

Recommended local setup:

```bash
codex
# First run prompts browser/account authentication.
# Sign in with the ChatGPT account that has Codex access.
```

The A2A worker inherits whatever authentication the local `codex` CLI already has. Do not commit ChatGPT session data, access tokens, API keys, or local Codex config into this repository.

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

## Send a task

```bash
curl -sS \
  -H 'Content-Type: application/json' \
  --data @examples/codex_a2a.request.json \
  http://127.0.0.1:8765/a2a | jq
```

## Preview mode

To run in preview mode (no execution), set:

```bash
export CODEX_A2A_MODE=preview
python3 tools/codex_a2a_worker.py --host 127.0.0.1 --port 8765
```

Execution requires `codex` on PATH or `CODEX_BIN` pointing to the executable. It also requires the local Codex CLI to already be authenticated, usually by signing in with your ChatGPT account on first run.

```bash
# One-time interactive login, if not already done:
codex

# Then start the gateway (executes by default):
export CODEX_A2A_TIMEOUT_SEC=1800
python3 tools/codex_a2a_worker.py --host 127.0.0.1 --port 8765
```

If you intentionally want API-key auth instead of ChatGPT-account auth, configure it in the runtime environment outside this repository.

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

## Cognitive compiler model

Shinon (GPT-5.5 Pro) acts as the **cognitive compiler**: it ingests context via RAG and Sovereign Search, reasons about the task, and emits a **Task Capsule** — a self-contained, bounded execution plan.

This worker is the **executor**: it receives the Task Capsule and runs Codex inside a sandboxed workspace. The executor does not re-derive intent.

See [cognitive_compiler.md](cognitive_compiler.md) for the full architecture.

## Recommended orchestration

Use this worker as a bounded implementation/review node within the cognitive compiler pipeline.

```text
User Intent
  → Shinon (cognitive compiler)
    → RAG + Sovereign Search
    → Emit Task Capsule
  → Codex A2A Worker (executor)
  → Human gate for merge, deploy, deletion, and secret-affecting actions
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
