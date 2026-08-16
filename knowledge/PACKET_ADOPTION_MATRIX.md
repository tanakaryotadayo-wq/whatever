# Akashic Knowledge Packet Adoption Matrix

Date: 2026-08-16  
Base: `akashic/v0.7-canonical-final` @ `134fb210e0e0f91d95e7b954f64088f223081b06`  
Target: `akashic/v0.8-knowledge-packet-import`

## Rule

Import mechanisms, not marketing claims. A packet is `IMPORTED` only with a concrete contract, implementation path and test.

## IMPORT_THIS_BRANCH

- KPK-001 — Private Plugin / Skills + MCP server: `.agents/skills/`, `plugins/akashic/`
- KPK-002 — MCP Tasks compatibility: `packages/contracts/src/mcp-tasks.js`
- KPK-008 — Provenance and verification/adoption gate: `packages/contracts/src/provenance.js`
- KPK-009 — Worker Deployment Versioning and role Task Queues: `workflows/temporal/src/{worker-deployment,task-queues,worker-topology}.js`, `docs/ADR-0005-*`
- KPK-010 — Drive immutable adapter and mailbox projection: `packages/drive-adapter/`, `schemas/v1/drive-mailbox-envelope.schema.json`, `docs/ADR-0006-*`
- KPK-011 — Three-zone context: `packages/contracts/src/context-memory.js`
- KPK-012 — Query-time selective memory: `packages/contracts/src/context-memory.js`
- KPK-013 — Policy-as-code: `packages/contracts/src/policy.js`
- KPK-014 — CloudEvents / W3C trace: `packages/contracts/src/events.js`
- KPK-016 — Unified lineage/provenance: `packages/contracts/src/provenance.js`
- KPK-019 — Fast/durable lane router: `packages/contracts/src/routing.js`
- KPK-022 — Evidence-linked JSONL regression flywheel: `packages/eval-flywheel/`, `schemas/v1/eval-{case,report}.schema.json`, `docs/ADR-0007-*`
- KPK-023 — Session capability matrix: `packages/contracts/src/sessions.js`

## HARDEN_THIS_BRANCH

- KPK-006 — Effect Ledger and fenced adoption: `packages/contracts/src/effects.js`, `workflows/temporal/src/activities.js`

## ALREADY_IMPLEMENTED

- KPK-003 — Temporal Update CAS
- KPK-004 — Update-With-Start
- KPK-007 — OCI-inspired ArtifactRef

## PARTIAL / PROVIDER GATES

- KPK-005 — one Codex turn per Activity; official binary live evidence remains open
- KPK-015 — A2A semantics through MCP Tasks projection
- KPK-017 — Codex lifecycle reconciliation deferred to provider gate
- KPK-020 — MCP elicitation deferred to client support
- KPK-021 — Multi-agent admission deferred until single-agent path is closed

## EXPERIMENT

- KPK-026 — fixed Temporal / Vercel / Cloudflare bake-off harness: `experiments/orchestrator-bakeoff/`

## DEFERRED BY EVIDENCE

- KPK-018 — Saga compensation registry. Temporal's official reverse-compensation pattern is accepted, but the current Drive staging/publish operation is one Activity with local cleanup. A durable registry is added only when at least two independently durable, reversible forward steps exist. See `docs/ADR-0008-SAGA-ADOPTION-BOUNDARY.md`.
- KPK-024 — Continue-As-New until measured history pressure
- KPK-025 — transactional outbox until a real dual-write boundary
- KPK-027 — reject duplicate external-payload layer; refs-first already exists
- KPK-028 — Codex exec-server transport
- KPK-029 — autonomous memory repository
- KPK-030 — parallel/agent-triggered compaction

## Acceptance gates

1. Deterministic mapping, policy, trace, provenance, stale-fence and queue-isolation tests pass.
2. Drive tests prove digest verification, staging compensation, dedup, stale-projection rejection, mailbox write-once behavior, Changes cursor paging and bounded retry.
3. Eval tests run accepted JSONL cases against real Core capabilities; Candidate cases remain skipped until evidence-linked verification.
4. Existing Temporal CAS and Update-With-Start remain green across distinct role queues.
5. All Temporal SDK packages and `@googleapis/drive` are pinned to exact versions.
6. Live provider tests remain explicit, credential-gated and fail-closed.
7. A workflow backend does not win by documentation comparison.
8. All KPK-001 through KPK-030 remain represented in this matrix and `packet-registry.json`.
