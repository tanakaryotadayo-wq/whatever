# Akashic v0.7 — Canonical Completion Architecture

## Product definition

Akashic is an **AI Agent Operating Layer**. It decides who may perform work, which context is visible, how missing context is negotiated, what evidence is required, and when a candidate artifact becomes adopted output.

Akashic is not a workflow engine, source-control system, blob store, chat UI, or model runtime.

## End-to-end path

```text
ChatGPT Project / MCP Client
            │
            ▼
Vercel Gateway
  auth + bounded MCP tools
            │
            ▼
Temporal Control Server
  Update-With-Start / Query / Update / Cancel
            │
            ▼
RunAgentTask Workflow
  CompileContext Activity
            │
  RunAgentTurn Activity ───► INPUT_REQUIRED
            │                    │
            │       applyContextDelta Update
            ◄────────────────────┘
            │
  VerifyCandidate Activity
            │
  Fenced AdoptArtifact Activity
            │
            ▼
Drive/R2 immutable artifact and evidence plane
```

## Workflow state

```text
SUBMITTED
→ COMPILING_CONTEXT
→ WORKING
→ INPUT_REQUIRED
→ WORKING
→ VERIFYING
→ ADOPTING
→ COMPLETED / FAILED / CANCELED
```

## Identity model

- `task_id`: immutable Akashic task and Temporal Workflow ID.
- `temporal_run_id`: Temporal execution incarnation.
- `logical_attempt_id`: Akashic retry/session-reconstruction boundary.
- `activity_attempt`: Temporal Activity retry count.
- `agent_session_id`: Codex thread or equivalent provider session.
- `request_id`: one ContextNeed.
- `delta_id`: one ContextPacketDelta and Temporal Update ID.
- `context_seq`: monotonic CAS generation.
- `turn_no`: logical agent turn number.

The old unqualified `attempt_id` is not used in v0.7 contracts.

## Correctness rules

1. Task submission uses stable `task_id` and an idempotency/update key. Conflicting payloads fail closed.
2. `applyContextDelta` is accepted only while `INPUT_REQUIRED` and only when task, logical attempt, request, and expected sequence match.
3. One agent turn is one Activity. Activities never remain alive waiting for human or context input.
4. Activity retry may happen. A turn effect key is `{task_id}:{logical_attempt_id}:{turn_no}`.
5. Agent edits occur in an isolated workspace and produce immutable candidate artifacts.
6. Verification must bind to the exact candidate digest.
7. Adoption requires a PASS report, effect-key idempotency, and a current fencing generation.
8. Drive/R2 store bytes. Temporal stores compact references and lifecycle state.
9. Worker restart with an unconfirmed external process fails closed and requires reconciliation or a new logical attempt.
10. Ordinary CI is not official Codex live evidence.

## Workspace reconstruction

The repository is the workspace generator. Antigravity, Codex, Codespaces, and Cloud Workstations are replaceable frontends.

```bash
git clone <repository>
make bootstrap
make doctor
make test
make test-p0
```

Native subscription-auth and local-model tests remain on a trusted self-hosted worker.

## Exit criteria for v0.7

### Repository/core gate

- Contracts validate.
- Python runtime/worker/Drive adapter tests pass.
- Temporal time-skipping integration proves stale Update rejection, valid resume, two turns, verification, adoption, and cancel.
- Gateway builds and its hardened URL/mutation tests pass.
- Cloudflare conformance tests pass without being an authority.

### External acceptance gates

- Authenticated official Codex binary: same app-server thread, first turn `INPUT_REQUIRED`, Delta-only second turn `COMPLETED`, transcript digest saved.
- Live Drive: immutable digest reuse, metadata, upload retry, and projection behavior verified against the real folder IDs.
- ChatGPT/Vercel: authenticated MCP connection and one mutation round-trip to Temporal.

Until the external gates pass, the correct status is **CORE_CLOSED / EXTERNAL_ACCEPTANCE_OPEN**, not production complete.
