# ADR-0008 — Saga Compensation Adoption Boundary

Status: DEFERRED BY EVIDENCE  
Date: 2026-08-16  
Packet: KPK-018

## Imported pattern

Temporal's official TypeScript Saga sample registers each compensation immediately after its corresponding forward step succeeds, executes compensations in reverse order, and treats compensation failures separately. Cloudflare Workflows offers a similar rollback primitive at the Workflow-step level.

## Current Akashic decision

Do not create a generic compensation registry yet.

The only current reversible multi-part candidate is Drive artifact publication. In v0.8, staging upload and final publish occur inside one retryable Activity and the Activity performs best-effort staging cleanup on failure. There is no durable boundary between two independently committed forward steps, so a Workflow-level compensation registry would duplicate local cleanup without improving recovery.

## Trigger for adoption

KPK-018 becomes implementation work when all are true:

1. At least two forward effects commit independently across Workflow steps.
2. Each effect has an idempotent compensation Activity.
3. The compensation can be represented by a compact serializable descriptor, not a closure.
4. Irreversible effects such as merged commits or external publication are explicitly excluded from fake rollback.
5. Fault injection proves reverse-order compensation after Worker/process failure.

## Likely first use

```text
Create isolated worktree
  -> Upload staging artifact
  -> Reserve adoption generation
  -> Verify
  -> Publish/adopt
```

Only the first three are plausible compensatable effects. A merged commit or external publication requires policy/approval and a corrective forward action, not a fictional rollback.

## Consequence

This is not a rejection of Saga. It is adoption of the established pattern at the correct transaction boundary rather than importing a framework before the boundary exists.
