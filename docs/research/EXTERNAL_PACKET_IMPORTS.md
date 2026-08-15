# External Knowledge Packet Imports — v0.7

This document records which externally researched mechanisms were imported into code. The complete source packet archive remains in Google Drive under `research/akashic_external_knowledge_packets_2026-08-16/`.

| Packet | Decision | v0.7 integration |
|---|---|---|
| KPK-001 — shared ChatGPT/Codex capability surface | ADAPT | Gateway exposes a small MCP command surface; repository carries agent rules. Private Plugin packaging remains a later distribution step. |
| KPK-002 — MCP Tasks compatibility | ADAPT | Public methods remain `tasks/send|get|update|cancel`; strict internal state/CAS is Temporal-owned. |
| KPK-003 — Temporal Update CAS | IMPORT | `applyContextDelta` validator checks state, task, logical attempt, request, and expected sequence. |
| KPK-004 — Update-With-Start | IMPORT | submit client uses stable Workflow ID and update idempotency key. |
| KPK-005 — one Codex turn per Activity | IMPORT | `StatefulCodexTurnWorker` is a one-turn, effect-keyed, cancelable executor; Workflow owns waiting. |
| KPK-006 — effect ledger and fencing | IMPORT | runtime rejects conflicting effect keys and stale adoption generations. |
| KPK-007 — OCI-style ArtifactRef | IMPORT | artifact contracts carry media type, digest, size, URI, type, and annotations. |
| KPK-008 — provenance / verification / adoption | IMPORT | verification binds to candidate digest before fenced adoption. |
| KPK-009 — workflow/task-queue version discipline | PARTIAL | v0.7 uses a dedicated task queue; production Worker Deployment versioning remains an external rollout gate. |
| KPK-010 — Drive immutable adapter / projection | IMPORT | digest reuse and appProperties are modeled; Task status is append-only projection, not queue state. |

## Kept from Akashic because it remains stronger

- receiver-driven ContextNeed rather than indiscriminate context replication;
- request/logical-attempt/sequence CAS beyond a generic task API;
- SeenSet and lineage-aware context compilation;
- fail-closed provider-session recovery;
- explicit verification and artifact adoption semantics.

## Deferred

- full A2A v1 public binding;
- vector retrieval and provider-native tokenizer precision;
- multi-agent graph routing;
- Firebase operator UI;
- Cloudflare backend competition;
- high concurrency and long-history Continue-As-New policy.

These are deferred until the single durable vertical slice passes its external acceptance gates.
