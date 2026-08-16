# Akashic Agent Rules

## Product boundary
Akashic owns routing, context negotiation/compilation, capability and policy, handoff, effect identity, verification and artifact adoption. It does not reimplement source control, artifact storage, a durable workflow engine, or an Agent runtime.

## Invariants
- One task has one workflow authority.
- Large bytes travel by content-addressed references, not Workflow history.
- One Agent turn is one retryable Activity.
- Workflow code, Context Activities, Agent Activities and Assurance Activities use distinct Temporal Task Queues.
- Production Temporal workers use one immutable Worker Deployment Version and PINNED workflow behavior; all Temporal SDK packages use the same exact version.
- External effects require an idempotency/effect key and generation fencing.
- Candidate artifacts are never adopted before digest-bound provenance and versioned verification pass.
- A stale context delta cannot revive or mutate a task.
- Drive immutable writes verify SHA-256 and size, publish from staging, and use `appProperties` only as an index.
- Drive status projections reject lower `state_seq` values and remain rebuildable from Workflow state.
- Drive mailbox files are write-once handoff envelopes; folders are never queue leases or task authority.
- Runtime failures and human corrections produce evidence-linked CANDIDATE eval cases; only independently verified cases enter the accepted JSONL regression corpus.
- Model-graded evals never replace deterministic Core gates and must pin model, rubric and evidence.
- Official-provider live tests must not be reported as passing unless the real credentials/binary and authenticated session were used.
