# Akashic Agent Operating Layer

Akashic decides **who executes what, with which context and authority, and which result is adopted as verified evidence**. It sits above replaceable durable workflow and Agent runtimes.

## Canonical authority split

- **GitHub**: source, CI, review, and provenance.
- **Akashic**: routing, ContextNeed/ContextPacketDelta, context compilation, policy, handoff, effect identity, verification, and adoption.
- **Temporal**: current reference/high-control workflow implementation.
- **Vercel Workflow**: bounded `RunAgentTask` adapter and bake-off candidate, not yet the selected authority.
- **Cloudflare Workflows**: third bounded comparison candidate, not a parallel authority.
- **Drive/R2**: content-addressed artifact, context, evidence, and projection storage.
- **ChatGPT + authenticated MCP**: operator and command surface.

## Codex mode

The cross-session operating entry point is:

```text
codexモード起動
```

Codex mode uses progressive disclosure instead of loading the entire project history:

```text
Pointer → Current State → Stable Spec → Selected Evidence
```

Available commands:

```text
codexモード 状態
codexモード 続行
codexモード 診断
codexモード 証拠
codexモード 計画
codexモード 終了
```

Canonical files:

```text
docs/modes/CODEX_MODE_POINTER.md
docs/modes/CODEX_MODE_STATE.json
docs/modes/CODEX_MODE.md
```

Provider state is fail-closed. Fixture PASS, workflow green, or a found receipt does not equal official provider certification. `CERTIFIED` requires exactly three consecutive official-binary PASS runs on one Codex version.

## Existing-first engineering

Before adding infrastructure, Akashic searches official standards, official implementations, official samples, and mature OSS. Imported mechanisms require an immutable source revision, license/version when applicable, conformance tests, rollback, and a machine-readable adoption receipt.

```text
knowledge/external-adoption-policy.json
knowledge/adoption-receipts/
.agents/skills/akashic-existing-first-adoption/
```

## Current workflow slice

Both workflow adapters implement the same Akashic invariants:

```text
SUBMITTED
→ COMPILING_CONTEXT
→ WORKING
→ INPUT_REQUIRED
→ WORKING
→ VERIFYING
→ ADOPTING
→ COMPLETED / FAILED / CANCELED
```

The Vercel adapter imports stable `workflow@4.6.0` primitives:

- `"use workflow"` and `"use step"`;
- deterministic Hook ownership and Context Delta resume;
- native run cancellation and deployment version retention;
- stable step IDs for effect idempotency inputs;
- compact workflow-stream projections.

It does **not** replace Akashic Context CAS, effect fencing, verification, or adoption semantics.

## Verify

```bash
npm ci
npm run doctor
npm run test:schemas
npm run test:knowledge
npm run test:core
npm run test:p0
WORKFLOW_TARGET_WORLD=local npm run build:gateway
```

## Evidence boundary

Provider-independent fixture and contract evidence is not provider proof. These gates remain open until live evidence is attached:

- official authenticated Codex App Server same-thread two-turn;
- real Drive credential/folder behavior;
- authenticated ChatGPT → Vercel mutation;
- Vercel restart/cancellation/deployment-rollout fault tests;
- measured Temporal/Vercel/Cloudflare bake-off and selection of exactly one Workflow Authority.
