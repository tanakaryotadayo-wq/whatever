# Akashic Agent Operating Layer

Akashic is the control-semantics layer for durable AI-agent work. It does not replace GitHub, Temporal, Drive/R2, Vercel, or agent runtimes. It defines how they cooperate without context explosion, stale input revival, or ambiguous side effects.

## Canonical completion path

```text
ChatGPT / MCP
      ↓
Vercel Gateway
      ↓
Temporal Control Server
      ↓
RunAgentTask Workflow
      ↓
CompileContext → RunAgentTurn → INPUT_REQUIRED
      ↑                    ↓
      └── CAS Update ──────┘
      ↓
Verify immutable candidate → fenced adoption
      ↓
Drive/R2 artifact and evidence plane
```

The canonical integration branch is `akashic/v0.7-canonical-temporal-final`.

## Run

```bash
make bootstrap
make doctor
make test
make test-p0
```

The official Codex binary acceptance is deliberately separate because it requires a self-hosted machine with an authenticated Codex subscription session:

```bash
make test-codex-live
```

A normal CI pass is not evidence that the live Codex gate passed.

## Authorities

- GitHub: source, review, CI, provenance
- Temporal: workflow lifecycle, wait/retry/replay/cancel/task queues
- Drive/R2: immutable context, artifact, evidence, and handoff bytes
- Vercel: thin ChatGPT MCP ingress
- Akashic: routing, context negotiation/compilation, capability policy, effect identity, verification, and adoption
