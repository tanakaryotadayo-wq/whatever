# ADR-0004 — Import External Knowledge Packets into Akashic Core

Status: **ACCEPTED FOR v0.8 INTEGRATION**  
Date: 2026-08-16

## Context

Akashic already has useful semantics and a working Temporal fixture slice. The library also contains two completed external-research assets:

- `akashic_external_knowledge_packets_2026-08-16.json` — 30 machine-readable packets;
- `Akashic Integration Knowledge Packet Set — 外部知識を取り込むための実装研究パケット` — implementation mapping and P0 gates.

The correct move is not to redesign Akashic or copy external frameworks wholesale. It is to import stable mechanisms that strengthen the existing boundary and to keep provider choices reversible.

## Decision

### Import into executable Core now

- MCP Tasks semantic projection, while keeping stronger internal CAS and authorization binding.
- Fast/durable lane routing with an auditable receipt.
- Policy-as-code with default-deny mutation behavior and executable test vectors.
- CloudEvents-compatible event projections plus W3C trace context validation.
- Agent provenance and versioned verification reports as adoption preconditions.
- Context zones and query-time cache identity.
- Provider session capability/recovery matrix.
- Stable effect records with generation fencing and idempotent completion.
- Agent Skills for routing, context negotiation, artifact adoption, and backend bake-off.
- A fixed orchestrator bake-off scenario and evidence scorecard.

### Keep existing imports

- Temporal Update validator/CAS for ContextPacketDelta.
- Update-With-Start for idempotent task submission.
- One Agent turn per Activity.
- Content-addressed ArtifactRef.
- Drive as artifact/context/evidence/projection storage, never Task authority.

### Do not import now

- A second live TaskStore.
- A blocking `tasks/result` dependency.
- Default multi-agent execution.
- Autonomous memory frameworks that replace immutable source refs.
- Transactional outbox before a real dual-write boundary exists.
- Continue-As-New before measured history pressure.

## Workflow authority

Temporal remains the P0 implementation backend. It is **provisional**, not axiomatic. Vercel Workflows and Cloudflare Workflows are compared only through the fixed `RunAgentTask` bake-off. The winner must satisfy stale-input safety, restart recovery, effect idempotency, version rollout, compact refs, and evidence requirements. Documentation feature counts do not select the winner.

## ChatGPT/Codex surface

OpenAI Plugins are the target packaging layer. The repository now carries reusable Skills. The authenticated Akashic MCP app remains the action/data surface. Plugin/app permissions and source-system permissions remain authoritative; prose in a Skill never grants a mutation.

## Consequences

- Knowledge becomes a versioned, machine-readable registry with code/test targets.
- Imported patterns are testable and reversible.
- MCP interoperability no longer forces Akashic to weaken internal correctness.
- Backend comparison can proceed without splitting the product into multiple authorities.
- Provider-specific live certification remains separate from Core correctness.
