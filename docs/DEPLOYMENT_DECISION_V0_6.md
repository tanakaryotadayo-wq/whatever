# Deployment Decision — v0.7 Canonicalization

Status: **ADOPTED on integration branch**

## Authority split

| Plane | Authority |
|---|---|
| Source / CI / review | GitHub |
| Durable workflow lifecycle | Temporal |
| ChatGPT MCP / HTTPS ingress | Vercel |
| Agent execution | Codex / Claude / local workers on Titan Core or authenticated VM |
| Artifact / context / evidence bytes | Google Drive or R2 |
| Cognitive working set | ChatGPT Project Sources |
| Optional operator read model | Firebase / Firestore, rebuildable from Temporal |

## Decisions

1. Cloudflare Durable Objects are not a concurrent TaskStore. The existing scaffold is retained only as a contract-conformance experiment.
2. Drive mailbox folders are projections and offline handoff surfaces, not queue authority.
3. Agent turns are Activities. Waiting for ContextPacketDelta occurs inside the Workflow through a validated Update.
4. Vercel does not execute agents and does not hold long-running task state.
5. Artifact bodies stay out of Temporal history; workflows carry content-addressed references.
6. Candidate output is immutable, independently verified, then adopted under an effect key and fencing generation.

## Required completion gates

```text
contract freeze
→ fixture Temporal two-turn
→ stale CAS rejection
→ cancellation/restart/fault tests
→ official Codex same-thread live two-turn
→ Drive live adapter acceptance
→ Vercel/ChatGPT authenticated mutation path
```

A passing fixture or CI run must not be reported as proof of the official Codex, Drive, or production ChatGPT gates.
