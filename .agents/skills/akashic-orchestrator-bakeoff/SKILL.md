---
name: akashic-orchestrator-bakeoff
description: Compare Temporal, Vercel Workflows, and Cloudflare Workflows with one fixed Akashic scenario and evidence-based scoring instead of feature-list arguments.
---

# Akashic Orchestrator Bake-off

Use only for the bounded workflow-authority decision.

## Fixed scenario

Each backend must execute the same `RunAgentTask` contract:

1. start idempotently with one `task_id`;
2. compile initial context;
3. execute turn 1;
4. enter `INPUT_REQUIRED`;
5. reject a stale input without mutating observable state;
6. accept the valid input;
7. execute turn 2 using the same logical attempt;
8. verify a candidate;
9. adopt via an idempotent effect;
10. complete and expose compact state.

## Required fault evidence

- duplicate start;
- worker/process restart while waiting;
- retry after an Activity/step side effect boundary;
- cancellation;
- stale context sequence;
- missing provider session;
- artifact upload succeeded but acknowledgement was lost;
- workflow code rollout/version behavior.

## Scoring rules

- Use measured results, not marketing claims.
- A missing requirement scores zero; a workaround must be counted in operational complexity.
- The winning backend becomes the only Task lifecycle authority.
- Drive, R2, GitHub, or a Durable Object must not silently become a second authority during the comparison.
