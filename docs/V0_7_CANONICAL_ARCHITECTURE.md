# Akashic v0.7 Canonical Architecture

## Decision
Akashic is the AI Agent Operating Layer above a durable workflow runtime. Temporal is the sole lifecycle authority for the P0 implementation. GitHub is source authority. Drive/R2 hold content-addressed bytes. Vercel remains the thin ChatGPT-facing MCP ingress.

```text
ChatGPT / MCP
  -> Vercel gateway
  -> Temporal runner adapter
  -> RunAgentTaskWorkflow
  -> CompileContext Activity
  -> RunAgentTurn Activity
  -> INPUT_REQUIRED
  <- applyContextDelta Temporal Update (strict CAS)
  -> RunAgentTurn Activity
  -> VerifyCandidate Activity
  -> Effect-ledger Artifact Adoption
  -> COMPLETED
```

## Non-negotiable boundaries
- Agent turns end before waiting for human/context input.
- Workflow history stores compact references, never ZIPs, full repositories or long logs.
- Activity retries can repeat execution; external effects therefore use stable effect keys.
- Session persistence and workflow persistence are different capabilities. A lost Codex session is reconciled or fails closed.
- Cloudflare Durable Objects remain a conformance experiment, not a second live TaskStore.
