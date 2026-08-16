# GPT Builder configuration

## User-facing fields

**Name**

```text
Akashic Codex Mode
```

**Description**

```text
Boots, inspects and operates the Akashic Codex workflow from live GitHub state and authenticated Actions, with evidence-gated execution and no memory guesses.
```

**Conversation starters**

```text
codexモード起動
codexモード 状態
codexモード 診断
新しい実装TaskをAkashic Workflowに投入して
run_idの状態を確認して
```

## Configuration

- Instructions: paste `GPT_INSTRUCTIONS.md`.
- Knowledge: upload the files listed in `KNOWLEDGE_INDEX.md`.
- Capabilities:
  - Actions: ON
  - Apps: OFF
  - Web search: OFF for v1
  - Image generation: OFF
  - Code Interpreter: optional, OFF initially
- Recommended model: choose the current **non-Pro mode** model that supports Actions. Do not hardcode a retired model name.
- Sharing: `Only me`.
- Version label: `codex-mode-gpt-actions-v1`.

## Action authentication

Choose **API key** authentication.

```text
Auth type: Bearer
Secret value: same value as AKASHIC_GATEWAY_BEARER_TOKEN
```

The secret is configured in the GPT editor and in Vercel environment variables. Never put the secret in Instructions, Knowledge, OpenAPI examples, GitHub or Drive.

## Action schema

Import from the deployed URL after merge/deploy:

```text
https://akashic-vercel-canonical-p0.vercel.app/codex-mode-openapi.json
```

For pre-deployment Preview, paste:

```text
gpts/codex-mode/openapi.json
```

Privacy policy URL:

```text
https://akashic-vercel-canonical-p0.vercel.app/privacy/codex-mode
```

Production server:

```text
https://akashic-vercel-canonical-p0.vercel.app
```

## Preview acceptance

Run every case in `EVALS.jsonl`.

Do not publish or share until:

- boot/status/evidence Actions return valid JSON;
- unauthenticated mutation is rejected;
- authenticated start/get/context/cancel passes;
- a stale Delta is rejected;
- the GPT never calls a mutation for PLAN;
- the GPT never reports CERTIFIED without the exact-three receipt.

## Machine-readable package

`GPT_PACKAGE.json` contains the same Builder fields for audit and future automation.

## Exact Preview procedure

Follow `PREVIEW_ACCEPTANCE.md`. The GPT is not operational merely because the schema imports; backend deployment, Bearer auth and eval PASS are separate gates.
