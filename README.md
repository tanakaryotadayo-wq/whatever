# Akashic Agent Operating Layer

Akashic decides **who executes what, with which context and authority, and which result is adopted as verified evidence**. It sits above replaceable durable workflow and Agent runtimes.

## Canonical authority split

- **GitHub**: source, CI, review, and provenance.
- **Akashic**: routing, ContextNeed/ContextPacketDelta, context compilation, policy, handoff, effect identity, verification, and adoption.
- **Temporal**: current reference/high-control workflow implementation.
- **Vercel Workflow**: bounded `RunAgentTask` adapter and bake-off candidate, not yet the selected authority.
- **Cloudflare Workflows**: third bounded comparison candidate, not a parallel authority.
- **Drive/R2**: content-addressed artifact, context, evidence, and projection storage.
- **ChatGPT + authenticated MCP/Actions**: operator and command surfaces.

## Codex mode

Cross-session entry:

```text
codexモード起動
```

Progressive loading:

```text
Pointer → Current State → Active Handoff → Stable Spec → Selected Evidence
```

Commands:

```text
codexモード 状態
codexモード 続行
codexモード 診断
codexモード 証拠
codexモード 計画
codexモード 引継ぎ
codexモード 終了
```

Canonical files:

```text
docs/modes/CODEX_MODE_POINTER.md
docs/modes/CODEX_MODE_STATE.json
docs/modes/CODEX_MODE_HANDOFF.json
docs/modes/CODEX_MODE.md
docs/modes/MANIFEST_CODEX_MODE_20260816.json
```

The operating pipeline is semantic, not a second orchestration system:

```text
SUPERVISOR → Work Packet
EXECUTOR   → Result Packet
VERIFIER   → Adoption verdict
```

State is a snapshot. `reconciled_against_main_head` is checked as ancestor-or-equal, avoiding a self-referential SHA. Provider state is fail-closed: fixture PASS, workflow green, or a receipt file existing does not equal official provider certification.

```bash
npm run codex:status
```

## Private GPT Actions surface

`gpts/codex-mode/` contains a Builder-ready private GPT package:

```text
GPT_INSTRUCTIONS.md
GPT_BUILDER_CONFIG.md
KNOWLEDGE_INDEX.md
openapi.json
EVALS.jsonl
GPT_PACKAGE.json
PREVIEW_ACCEPTANCE.md
```

The GPT is a conversational client, not an authority. It boots current status through `/api/codex-mode/*` Actions and performs authenticated workflow mutations through the existing `/api/workflows/tasks/*` routes. The deployed Builder schema is served from `/codex-mode-openapi.json`, and the privacy policy from `/privacy/codex-mode`.

```bash
node scripts/validate-codex-mode-gpt.mjs
```

## Existing-first engineering

Before adding infrastructure, Akashic searches official standards, official implementations, official samples, and mature OSS. Imported mechanisms require an immutable source revision, license/version when applicable, conformance tests, rollback, and a machine-readable adoption receipt.

```text
knowledge/external-adoption-policy.json
knowledge/adoption-receipts/
.agents/skills/akashic-existing-first-adoption/
```

## Current workflow slice

Both workflow adapters implement:

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

The Vercel adapter imports stable `workflow@4.6.0` primitives but does not replace Akashic Context CAS, effect fencing, verification, or adoption semantics.

## Verify

```bash
npm ci
npm run doctor
npm run codex:status
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
