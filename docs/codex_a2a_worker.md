# Codex execution boundary — v0.7

The old task-wide `codex exec` HTTP wrapper is retired. It blocked until completion and duplicated lifecycle authority now owned by Temporal.

## Current components

### Temporal control server

```text
workflows/temporal/src/control-server.ts
```

Accepts the compatibility methods:

```text
tasks/send
tasks/get
tasks/update
tasks/cancel
```

These map to Update-With-Start, Query, validated Update, and cancellation Update.

### One-turn Codex worker

```text
workers/codex/stateful_turn_worker.py
```

A request is identified by:

```text
{task_id}:{logical_attempt_id}:{turn_no}
```

It provides:

- nonblocking submit;
- SQLite WAL state and event records;
- idempotent replay and conflict rejection;
- process-group cancellation;
- timeout handling;
- restart fail-closed for unconfirmed `WORKING` turns.

It does not wait for ContextPacketDelta. An `INPUT_REQUIRED` turn ends; the Workflow waits and later schedules the next turn.

### Official Codex live acceptance

```bash
AKASHIC_LIVE_CODEX=1 \
python3 scripts/codex_live_two_turn.py \
  --evidence-dir .akashic-evidence/codex-live
```

The gate requires the official authenticated `codex app-server`, one persistent thread, an `INPUT_REQUIRED` first turn, a Delta-only second turn, and a `COMPLETED` result. Full JSONL transcript and SHA-256 evidence are retained.

## Provider session classification

Codex app-server is treated as `PERSISTENT_WITH_RECONCILIATION`, not as perfectly durable. Temporal stores the thread reference, while completion is reconciled from persisted thread state and evidence after missing notifications or process restart.
