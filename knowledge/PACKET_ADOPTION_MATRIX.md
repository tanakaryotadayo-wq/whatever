# Akashic Knowledge Packet Adoption Matrix

Date: 2026-08-16  
Base: `akashic/v0.7-canonical-final` @ `134fb210e0e0f91d95e7b954f64088f223081b06`  
Target: `akashic/v0.8-knowledge-packet-import`

## Rule

This registry imports mechanisms, not marketing claims. A packet is only `IMPORTED` when it has a concrete contract, implementation path, and test. Platform-specific packets remain experiments until the same Akashic scenario passes with evidence.

## This branch imports

- MCP Tasks semantic projection without adopting blocking `tasks/result` behavior.
- Deterministic fast/durable routing receipts.
- Policy-as-code with executable test vectors and default-deny mutation behavior.
- CloudEvents-compatible projection envelopes and W3C trace context validation.
- Agent provenance, versioned verification reports, and adoption precondition checks.
- Three-zone context sections and deterministic query-time cache keys.
- Provider session capability and fail-closed recovery decisions.
- Stable effect identity, generation fencing, and idempotent completion contracts.
- Skills that make the routing, context, verification, and adoption discipline reusable.
- A bounded orchestrator bake-off scenario and scorecard.

## Explicit non-imports

- No second authoritative TaskStore.
- No Drive folder-move queue.
- No large bodies in workflow history.
- No default multi-agent topology.
- No autonomous memory rewrite.
- No claim that Vercel, Temporal, or Cloudflare has won before the fixed bake-off completes.

## IMPORT_THIS_BRANCH

| Packet | Mechanism | Target |
|---|---|---|
| KPK-001 | Akashic Private Plugin: Skills + MCP server | `.agents/skills/`<br>`knowledge/PACKET_ADOPTION_MATRIX.md` |
| KPK-002 | MCP Tasks compatibility surface | `packages/contracts/src/mcp-tasks.js` |
| KPK-008 | Agent provenance plus verification/adoption gate | `packages/contracts/src/provenance.js` |
| KPK-011 | Three-zone context workspace | `packages/contracts/src/context-memory.js` |
| KPK-012 | Query-time selective memory construction | `packages/contracts/src/context-memory.js` |
| KPK-013 | Policy-as-code with executable test vectors | `packages/contracts/src/policy.js` |
| KPK-014 | CloudEvents projections plus W3C trace context | `packages/contracts/src/events.js` |
| KPK-016 | OpenLineage-inspired context and artifact lineage | `packages/contracts/src/provenance.js` |
| KPK-019 | Fast lane versus durable lane router | `packages/contracts/src/routing.js` |
| KPK-023 | Agent session capability matrix | `packages/contracts/src/sessions.js` |

## HARDEN_THIS_BRANCH

| Packet | Mechanism | Target |
|---|---|---|
| KPK-006 | Stable Effect Ledger and fenced artifact adoption | `packages/contracts/src/effects.js`<br>`workflows/temporal/src/activities.js` |

## ALREADY_IMPLEMENTED

| Packet | Mechanism | Target |
|---|---|---|
| KPK-003 | Temporal Update CAS for ContextPacketDelta | `workflows/temporal/src/workflows.js` |
| KPK-004 | Update-With-Start for idempotent submit | `apps/temporal-runner/src/rpc.js` |
| KPK-007 | OCI-inspired ArtifactRefV1 | `packages/contracts/src/index.js` |

## PARTIAL_VIA_MCP_TASKS

| Packet | Mechanism | Target |
|---|---|---|
| KPK-015 | A2A semantic compatibility without full binding | `packages/contracts/src/mcp-tasks.js` |

## PARTIAL_PROVIDER_GATE

| Packet | Mechanism | Target |
|---|---|---|
| KPK-005 | One Codex turn per Activity with session reconciliation | `workflows/temporal/src/workflows.js`<br>`scripts/codex-live-acceptance.sh` |

## IMPORT_EXPERIMENT_HARNESS

| Packet | Mechanism | Target |
|---|---|---|
| KPK-026 | Temporal versus Vercel/Cloudflare orchestrator bake-off | `experiments/orchestrator-bakeoff/` |

## NEXT_IMPLEMENTATION

| Packet | Mechanism | Target |
|---|---|---|
| KPK-009 | Pinned workflow versions and independent Activity task queues | `knowledge/PACKET_ADOPTION_MATRIX.md` |
| KPK-010 | Drive immutable artifact adapter and mailbox projection | `knowledge/PACKET_ADOPTION_MATRIX.md` |
| KPK-018 | Saga compensation registry | `knowledge/PACKET_ADOPTION_MATRIX.md` |
| KPK-022 | Verification flywheel from traces and corrections | `knowledge/PACKET_ADOPTION_MATRIX.md` |

## DEFER_PROVIDER_GATE

| Packet | Mechanism | Target |
|---|---|---|
| KPK-017 | Codex lifecycle reconciliation loop | `knowledge/PACKET_ADOPTION_MATRIX.md` |

## DEFER_CLIENT_SUPPORT

| Packet | Mechanism | Target |
|---|---|---|
| KPK-020 | MCP elicitation mode split | `knowledge/PACKET_ADOPTION_MATRIX.md` |

## DEFER_AFTER_SINGLE_AGENT

| Packet | Mechanism | Target |
|---|---|---|
| KPK-021 | Multi-agent admission control and explicit handoff contracts | `knowledge/PACKET_ADOPTION_MATRIX.md` |

## DEFER_UNTIL_HISTORY_PRESSURE

| Packet | Mechanism | Target |
|---|---|---|
| KPK-024 | Context checkpoints plus Continue-As-New | `knowledge/PACKET_ADOPTION_MATRIX.md` |

## DEFER_UNTIL_DUAL_WRITE

| Packet | Mechanism | Target |
|---|---|---|
| KPK-025 | Transactional outbox only at real dual-write boundaries | `knowledge/PACKET_ADOPTION_MATRIX.md` |

## REJECT_DUPLICATE_REFS_FIRST

| Packet | Mechanism | Target |
|---|---|---|
| KPK-027 | Temporal external payload storage | `knowledge/PACKET_ADOPTION_MATRIX.md` |

## DEFER

| Packet | Mechanism | Target |
|---|---|---|
| KPK-028 | Codex exec-server transport | `knowledge/PACKET_ADOPTION_MATRIX.md` |
| KPK-029 | Autonomous memory repository and reflection | `knowledge/PACKET_ADOPTION_MATRIX.md` |
| KPK-030 | Parallel and agent-triggered context compaction | `knowledge/PACKET_ADOPTION_MATRIX.md` |

## Acceptance gates

1. Contract tests prove deterministic mapping, default-deny policy, trace validation, provenance subject matching, and stale-fence rejection.
2. Existing Temporal CAS and Update-With-Start tests remain green.
3. Skills contain no provider secrets and never authorize mutations by prose alone.
4. Bake-off results are stored as evidence; a platform does not win by documentation comparison.
5. `packet-registry.json` remains the machine-readable adoption record.
