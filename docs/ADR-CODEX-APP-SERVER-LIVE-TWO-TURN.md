# ADR — Official Codex App Server Live Two-Turn Certification

Status: IMPLEMENTED / LIVE PROVIDER GATE PENDING  
Date: 2026-08-16

## Decision

Akashic's Codex provider boundary uses the official `codex app-server` JSONL
protocol over stdio. It does not use `codex exec resume`, the experimental
WebSocket listener, or a directly internet-exposed App Server.

The certification lifecycle is fixed to:

```text
initialize -> initialized
model/list
thread/start exactly once
turn/start #1 -> turn/completed -> INPUT_REQUIRED
ContextPacketDelta only
turn/start #2 on the same thread -> turn/completed -> COMPLETED
artifact digest verification
```

The installed binary generates its own protocol JSON Schema and TypeScript
artifacts with `codex app-server generate-json-schema` and `generate-ts`.
Hand-authored protocol guesses are not authority.

## Security boundary

- `experimentalApi` is false.
- approval policy is `never` and the fixture is designed not to need approval.
- any inbound App Server request is rejected and fails certification.
- sandbox mode is `workspace-write` in a temporary isolated workspace.
- only `TASK.md` and fixture README are copied into the workspace; expected
  bytes remain outside it.
- timeout invokes `turn/interrupt` before process termination.
- evidence is sanitized before persistence and credential-like values are
  scanned fail-closed.

## Certification rule

One Codex version must pass three consecutive runs. Every run must prove one
thread, two turns, both `turn/started` and `turn/completed`, exact ContextNeed
identity, no Task Capsule resend on turn two, exact `result.txt` bytes, and a
matching ArtifactRef.

## Upstream references

- `openai/codex` App Server README
- generated protocol at the installed Codex version
- stable V2 methods: `initialize`, `model/list`, `thread/start`, `turn/start`,
  `turn/interrupt`

Restart/resume after App Server process death is explicitly deferred to the
next fault-certification slice.
