# ADR-0010 — Vercel Workflow Active-Run Idempotency and Turn Advancement

Status: ACCEPTED  
Date: 2026-08-16  
Renumbered from: ADR-0009 (duplicate ID)

## Evidence

The first live Vercel Workflow P0 run reached `INPUT_REQUIRED`, rejected a stale `ContextPacketDelta` with `STALE_SEQUENCE`, and accepted the valid delta on the same run. It then exposed two assumptions that fixture-only tests had not exercised:

1. `applyContextDeltaToVercelSnapshot()` already performs `INPUT_REQUIRED -> WORKING`; the next Agent turn must advance `turn_no` without attempting an illegal `WORKING -> WORKING` state transition.
2. Vercel hook tokens coordinate duplicate starts only while the owner hook is active. After a terminal run disposes its hook, the token is reusable. Completed-result idempotency requires a separate durable result index and is not provided by `start()` itself.

## Decision

- Add `beginAgentTurn()` as a non-state-changing turn event when the snapshot is already `WORKING`.
- Test duplicate submit while the original run is waiting in `INPUT_REQUIRED`, matching Vercel's documented active-run hook guarantee.
- Do not claim post-terminal duplicate reuse until Akashic has a selected authoritative completed-result index.
- Preserve Effect Ledger fencing for external side effects; run-start idempotency and effect idempotency remain separate concerns.
