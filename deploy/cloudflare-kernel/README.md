# Cloudflare Task Contract Conformance Experiment

This directory is retained as an alternative implementation of the Akashic task-state contract. It is **not** the canonical v0.7 workflow authority.

## Canonical authority

- Temporal owns durable workflow state, waiting, retries, replay, cancellation, and task queues.
- This Durable Object implementation exists to test whether the public task contract is portable.
- Never route production mutations to Temporal and this Durable Object at the same time.

## Allowed uses

- Run state-machine and stale-delta conformance tests.
- Compare operational cost and semantics with Temporal.
- Explore Cloudflare edge ingress, R2, rate limiting, and auth.

## Forbidden claims

- Do not claim Codex/Claude execution from this scaffold.
- Do not treat a Durable Object snapshot as the canonical Temporal history.
- Do not deploy it as a second writer for an existing `task_id`.

## Test

```bash
npm install
npm test
```

A future backend replacement must pass the same Akashic contract suite and a migration/fencing review before it can become authoritative.
