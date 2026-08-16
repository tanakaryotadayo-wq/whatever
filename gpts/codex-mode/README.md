# Akashic Codex Mode GPT — Actions package v1

This package turns the existing `codexモード` operating contract into a private custom GPT that can call the Akashic Vercel Gateway rather than relying on the model to remember and imitate the workflow.

## Product boundary

```text
Custom GPT
= conversational command surface and policy-following client

GPT Actions
= authenticated HTTP calls

Akashic Vercel Gateway
= enforcement, live-state reads and durable workflow commands

GitHub
= source, Mode Spec, Current State, Handoff, tests and CI authority

Google Drive
= artifact, evidence, manifest and handoff mirror

Temporal / Vercel Workflow
= replaceable durable execution backends
```

The GPT is not a TaskStore, source authority, credential vault or durable workflow engine.

## First usable version

The action schema exposes:

- live Codex Mode boot/status from GitHub authority;
- provider-attempt evidence from the active provider branch;
- Vercel Workflow task start;
- compact workflow status;
- exact ContextPacketDelta resume;
- native workflow cancellation;
- gateway health.

This is deliberately a **private GPT using API-key/Bearer authentication**. OAuth and public distribution are later migrations, not prerequisites.

## Builder inputs

1. Paste `GPT_INSTRUCTIONS.md` into Instructions.
2. Upload only the files listed in `KNOWLEDGE_INDEX.md`.
3. Import `openapi.json` under Actions.
4. Configure API-key authentication as Bearer.
5. Use the current non-Pro ChatGPT model that supports Actions.
6. Keep sharing set to **Only me** for v1.
7. Follow `PREVIEW_ACCEPTANCE.md` and test every case in `EVALS.jsonl`.

## Required server configuration

```text
AKASHIC_GATEWAY_AUTH_MODE=bearer
AKASHIC_GATEWAY_BEARER_TOKEN=<random secret>
AKASHIC_MUTATIONS_ENABLED=true
```

Read routes may run with auth mode `none`, but production v1 should still use Bearer authentication so the same GPT cannot accidentally call a different unprotected deployment.

## Deployment assets

- `GPT_PACKAGE.json` — machine-readable Builder configuration.
- `codex-mode-openapi.json` — deployed public schema copy.
- `/privacy/codex-mode` — privacy-policy endpoint.
- `/api/codex-mode/boot|status|evidence` — live read Actions.
- existing `/api/workflows/tasks/*` — authenticated mutation Actions.

## Current limitations

- GPT Actions cannot use ChatGPT Apps in the same GPT.
- Google Drive/GitHub connector access is therefore not assumed inside the GPT. Those resources must be read or mutated behind the Action API.
- Provider certification remains open until a valid exact-three official Codex receipt exists.
- `continue`, `repair`, state persistence and certification publication are not exposed as generic mutation endpoints in v1. They remain bounded backend operations until their capability contracts are explicit.
