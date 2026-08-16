# ADR-0009 — Vercel Workflow `RunAgentTask` Adapter

**Status:** ACCEPTED FOR BOUNDED EXPERIMENT  
**Date:** 2026-08-16  
**Source dependency:** `workflow@4.6.0`  
**Source revision:** `vercel/workflow@822197c886e0b98bd1e99f01544a9685104cd9bd`

## Decision

Implement the existing backend-neutral Akashic `RunAgentTask` contract on Vercel Workflow without replacing Akashic control semantics or selecting Vercel as Workflow Authority yet.

The imported Vercel mechanisms are:

- `"use workflow"` for durable orchestration;
- `"use step"` for retryable Node.js execution boundaries;
- deterministic Hooks plus `getConflict()` for active-run ownership;
- an authenticated custom `resumeHook()` route for `ContextPacketDelta` delivery;
- native `Run.cancel()`;
- stable `stepId` as the provider idempotency input for external effects;
- native deployment-version retention for already-running workflows;
- workflow streams as compact read projections.

Akashic retains:

- `task_id`, `context_id`, `logical_attempt_id`, `request_id`, `expected_seq`, and `delta_id` semantics;
- context-delta CAS validation before state mutation;
- receiver-driven context negotiation;
- Agent routing and provider-session policy;
- Effect identity and fencing;
- verification before artifact adoption;
- backend-neutral TaskSnapshot and ArtifactRef contracts.

## Why stable `4.6.0`

`createHook().getConflict()` is available from `workflow@4.5.0`. Version `4.6.0` is a stable Apache-2.0 release and is pinned exactly. The unreleased v5 beta is not required for this slice.

## Runtime topology

```text
ChatGPT / MCP
      │
      ▼
Vercel Next.js Gateway
      │
      ▼
workflow@4.6.0 RunAgentTask
      │
      ├─ compileContext step
      ├─ runAgentTurn step
      ├─ Context Hook wait/resume
      ├─ verifyCandidate step
      └─ adoptArtifact step
```

The current Agent and artifact implementations are deterministic fixtures. They prove the contract and orchestration boundary, not official Codex execution or a production artifact-store effect.

## Security boundary

- Mutation routes remain disabled by default.
- Enabling mutations without an authentication mode is rejected.
- Bearer mode requires `AKASHIC_GATEWAY_BEARER_TOKEN` and validates every request.
- Context input is delivered only through the authenticated custom route; public token-only webhooks are not used.
- The route validates the complete Context Delta CAS before calling `resumeHook()`.
- The workflow validates the same payload again and ignores invalid payloads without mutating its TaskSnapshot.

## Known gap: post-terminal task idempotency

A deterministic Hook owns a `task_id` while its workflow is active. In stable v4 the token is released when the workflow ends. Therefore this adapter proves active-run duplicate convergence, but does not yet prove that a repeated submission after terminal completion reuses the original run forever.

This gap is explicit in the bake-off. It must be closed by a native retained-domain-key mechanism or a narrowly scoped immutable task-to-run index. It must not be solved by introducing a second authoritative TaskStore.

## Acceptance gates for this ADR

1. Next.js build discovers and compiles the workflow and step functions.
2. Exact dependency graph installs with `npm ci`.
3. Stale Context Delta fails before `resumeHook()` and does not mutate the snapshot.
4. A valid Delta resumes the same `logical_attempt_id` and advances `context_seq` once.
5. Candidate artifacts cannot reach `COMPLETED` without verification and adoption steps.
6. Native cancellation is exposed through an authenticated API and projected as `CANCELED`.
7. Snapshot streams remain compact and contain refs/control metadata rather than repository or artifact bodies.
8. Live Vercel fault evidence is kept separate from fixture/contract evidence.

## Rollback

Remove:

- `workflow@4.6.0` and `next.config.mjs` integration;
- `workflows/run-agent-task.js`;
- Vercel Workflow API/MCP tools.

Keep all backend-neutral Akashic contracts and the Temporal reference implementation unchanged.
