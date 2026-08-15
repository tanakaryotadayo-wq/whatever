# Akashic Agent Rules

## Product boundary
Akashic owns routing, context negotiation/compilation, capability and policy, handoff, effect identity, verification and artifact adoption. It does not reimplement source control, artifact storage, a durable workflow engine, or an Agent runtime.

## Invariants
- One task has one workflow authority.
- Large bytes travel by content-addressed references, not Workflow history.
- One Agent turn is one retryable Activity.
- External effects require an idempotency/effect key.
- Candidate artifacts are never adopted before verification.
- A stale context delta cannot revive or mutate a task.
- Drive mailbox folders are projections/offline bridges, never the task state authority.
- Official-provider live tests must not be reported as passing unless the real binary and authenticated session were used.
