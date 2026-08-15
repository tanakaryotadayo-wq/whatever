---
name: akashic-context-negotiation
description: Fulfil ContextNeed requests with compact refs-first ContextPacketDelta values while preserving strict CAS, SeenSet, lineage, and model-visible separation.
---

# Akashic Context Negotiation

Use when a task reaches `INPUT_REQUIRED`.

## Procedure

1. Read the current TaskSnapshot and ContextNeed.
2. Reject the operation unless all identities match:
   - `task_id`;
   - `logical_attempt_id`;
   - `request_id`;
   - `expected_seq == current context_seq`.
3. Resolve candidate source and artifact references inside allowed roots.
4. Exclude digests and references already present in Known/RecipientSeenSet.
5. Rank deterministically and pack to the receiver budget.
6. Preserve immutable source references and lineage; generate query-specific derived sections only.
7. Keep wire control metadata outside model-visible context.
8. Submit one `ContextPacketDeltaRefV1`; do not resend the full Task Capsule.
9. Mark content as seen only after the durable update is accepted.

## Context zones

- `TASK_SEMANTICS`: goal, acceptance, policy, output contract.
- `WORKING_MEMORY`: selected current implementation facts and constraints.
- `RECENT_EVIDENCE`: fresh logs, diffs, tests, and receipts.

## Invariants

- A stale Delta never revives a task.
- Context bodies travel through content-addressed refs when they are large.
- Recursive summaries are not the sole memory copy; immutable sources remain reachable.
