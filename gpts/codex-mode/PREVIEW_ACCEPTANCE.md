# GPT Preview acceptance runbook

## Before Preview

1. Deploy the branch containing `/api/codex-mode/*`, the public OpenAPI file and privacy route.
2. Configure Vercel production or preview environment:

```text
AKASHIC_GATEWAY_AUTH_MODE=bearer
AKASHIC_GATEWAY_BEARER_TOKEN=<random high-entropy secret>
AKASHIC_MUTATIONS_ENABLED=true
AKASHIC_GITHUB_REPOSITORY=tanakaryotadayo-wq/whatever
AKASHIC_GITHUB_DEFAULT_BRANCH=main
```

3. In GPT Builder, choose Actions → API key → Bearer and enter the same secret.
4. Import `https://akashic-vercel-canonical-p0.vercel.app/codex-mode-openapi.json` after production deployment, or paste `openapi.json` for Preview.
5. Upload only the four stable Knowledge files in `KNOWLEDGE_INDEX.md`.

## Required Preview cases

Execute every line in `EVALS.jsonl`. At minimum verify:

- BOOT calls `bootCodexMode` and returns the compact Status Card first.
- STATUS is read-only and does not fetch large Evidence.
- DIAGNOSE calls Evidence and does not repeat an unchanged failed route.
- PLAN never calls a mutating Action.
- START calls health before workflow start.
- stale Context Delta is rejected and never narrated as accepted.
- cancel is treated as consequential.
- fixture three-run never becomes `CERTIFIED`.
- no response contains the Bearer secret or credential-like values.

## Activation gate

The GPT may be labeled `OPERATIONAL_PRIVATE_V1` only when:

1. production Action routes are deployed;
2. Bearer authentication succeeds and unauthenticated reads/mutations fail;
3. mutations are enabled intentionally;
4. all Preview evals pass;
5. one bounded start → get → INPUT_REQUIRED → Context Delta → terminal test passes;
6. current provider certification remains accurately OPEN unless the exact-three receipt exists.
