---
name: akashic-artifact-adoption
description: Adopt an agent-produced artifact only after provenance, versioned verification, expected-head checks, and a fenced idempotent effect commit all succeed.
---

# Akashic Artifact Adoption

Use before a candidate becomes a source, release, deployment, or other authoritative artifact.

## Procedure

1. Resolve the immutable candidate ArtifactRef and verify its SHA-256 digest and size.
2. Require AgentProvenanceV1 identifying source commit/tree, task, logical attempt, turn, provider adapter, context inputs, outputs, policy, sandbox, and evidence.
3. Execute the versioned Verification Plan. A required check may be `PASS`, `FAIL`, or `INCONCLUSIVE`.
4. Reject adoption unless every required check is `PASS`, the report subject digest equals the candidate digest, and provenance names the same digest.
5. Compare the expected source head/fencing token with the current value.
6. Claim a stable effect key. Activity attempt number is never the effect identity.
7. Commit with the current generation token. A stale owner or generation must fail.
8. Write an immutable AdoptionReceipt and return only its reference.

## Invariants

- Durable execution does not make external effects exactly-once.
- Verification text without evidence refs is not sufficient.
- A successful prior effect with the same subject is an idempotent replay; a different subject under the same key is a conflict.
