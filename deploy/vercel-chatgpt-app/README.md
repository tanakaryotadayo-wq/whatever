# Akashic ChatGPT Gateway + Vercel Workflow Adapter

This Next.js application exposes the ChatGPT-facing MCP surface and a bounded Vercel Workflow implementation of the Akashic `RunAgentTask` contract.

## Authority boundary

- Vercel Workflow owns one provider workflow run and its durable event history.
- Akashic owns routing, context negotiation/CAS, policy, effects, verification, and adoption semantics.
- GitHub remains source authority.
- Drive/R2 remain artifact/context/evidence stores and projections, never Task authority.
- Temporal remains the current reference/high-control candidate until the fixed bake-off selects one backend.

## Routes

```text
GET/POST /api/mcp
GET      /api/health
POST     /api/workflows/tasks
GET      /api/workflows/tasks/{run_id}
POST     /api/workflows/tasks/{run_id}/context
POST     /api/workflows/tasks/{run_id}/cancel
```

## Required mutation configuration

Mutations fail closed by default.

```text
AKASHIC_MUTATIONS_ENABLED=true
AKASHIC_GATEWAY_AUTH_MODE=bearer
AKASHIC_GATEWAY_BEARER_TOKEN=<secret>
```

The public Vercel Workflow webhook helper is intentionally not used for Context Delta delivery. The custom route authenticates the request, validates `task_id / logical_attempt_id / request_id / expected_seq / delta_id`, verifies Hook ownership, and only then calls `resumeHook()`.

## Verify

From the repository root:

```bash
npm ci
npm run test:gateway
WORKFLOW_TARGET_WORLD=local npm run build:gateway
```

## Evidence boundary

The current workflow uses deterministic Agent and Artifact fixtures. Passing tests prove the adapter contract and build integration only. They do not prove:

- official Codex App Server two-turn continuation;
- real Drive/R2 artifact effects;
- Vercel restart/cancellation/version-rollout fault behavior in production;
- that Vercel has won the Temporal/Vercel/Cloudflare bake-off.
