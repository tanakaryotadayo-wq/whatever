# Akashic Agent Rules

## Product boundary
Akashic owns routing, context negotiation/compilation, capability and policy, handoff, effect identity, verification, provenance and artifact adoption. It does not reimplement source control, artifact storage, a durable workflow engine, or an Agent runtime.

## Invariants
- One task has one workflow authority.
- Large bytes travel by content-addressed references, not Workflow history.
- One Agent turn is one retryable Activity.
- External effects require a stable effect key and generation fencing.
- Candidate artifacts are never adopted before subject-matching provenance and versioned verification PASS.
- A stale context delta cannot revive or mutate a task.
- Drive mailbox folders are projections/offline bridges, never the task state authority.
- Mutations default to forbidden unless policy explicitly allows or prompts.
- Fast/durable routing produces a machine-readable receipt; an override never erases automatic risk reasons.
- Imported Knowledge Packets are versioned in `knowledge/packet-registry.json` and must identify a code, Skill, experiment or deferred target.
- Community repositories supply patterns, not automatic production dependencies.
- Official-provider live tests must not be reported as passing unless the real binary and authenticated session were used.
