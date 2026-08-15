# Akashic v0.7 Asset Adoption Plan

## Adopted directly

- Git history and source tree from `main`.
- Vercel MCP gateway and deployment scaffolding from v0.6.
- Security hardening rooted at commit `7eb276effee7b3ea56afbcc0ffdf44363ac4e640`.
- Existing Cloudflare state-machine tests as a non-authoritative conformance implementation.

## Adapted rather than copied

The Drive v0.6 Stateful Worker proved nonblocking task state, event durability, idempotency, cancel, fail-closed restart, ContextNeed/Delta, context compilation, and app-server fixture behavior. v0.7 preserves those properties but changes the decomposition:

```text
v0.6 Task-wide Worker authority
              ↓
v0.7 Temporal Workflow authority
    + one-turn Activity worker
    + immutable ArtifactRef
    + verification/adoption gate
```

This is why the v0.6 patch remains evidence instead of being blindly applied.

## Superseded

- `subprocess.run` task-wide Codex execution.
- Drive `running/` folder as execution truth.
- Cloudflare Durable Object as the next automatic TaskStore.
- unqualified `attempt_id`.
- Context Delta sent as an unacknowledged Signal.
- candidate file edits directly adopted into the source tree.

## Imported external patterns

- Temporal Update validator for Context CAS.
- Update-With-Start for duplicate-safe submit.
- one turn per Activity.
- OCI descriptor-style content-addressed artifact references.
- idempotent effect ledger and fencing generation.
- verification bound to candidate digest.
- Drive appProperties and append-only projections.
- repository as reconstructible workspace generator.

## Merge discipline

The v0.7 branch is mergeable only after core CI passes. Production completion additionally requires separate evidence from:

1. authenticated official Codex app-server same-thread two-turn run;
2. real Drive immutable upload/projection run;
3. authenticated ChatGPT → Vercel → Temporal mutation round-trip.

The PR must remain draft while any code-level failure exists. External gates may remain explicitly open without misrepresenting core closure.
