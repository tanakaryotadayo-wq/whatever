---
name: codex-mode
description: Activate, resume, diagnose, hand off, or close the Akashic Codex App Server workstream with progressive loading and evidence-gated adoption.
---

# Codex Mode Skill v1.2

## Bootstrap

1. Read `docs/modes/CODEX_MODE_POINTER.md`.
2. Read `docs/modes/CODEX_MODE_STATE.json`.
3. Re-fetch current main/provider heads and PR state.
4. For RESUME/HANDOFF, read `docs/modes/CODEX_MODE_HANDOFF.json`.
5. Read `docs/modes/CODEX_MODE.md` only when operating rules are needed.
6. Load only Evidence referenced by the selected workstream.

Do not ask the user to repeat prior project history.

## Intent normalization

- `codexモード起動` → BOOT
- `codexモード 状態` → STATUS
- `codexモード 続行` → RESUME
- `codexモード 診断` → DIAGNOSE
- `codexモード 証拠` → EVIDENCE
- `codexモード 計画` → PLAN
- `codexモード 引継ぎ` → HANDOFF
- `codexモード 終了` → CLOSE

Ambiguous requests default to STATUS.

## Role pipeline

1. `SUPERVISOR` creates or refreshes the Work Packet.
2. `EXECUTOR` changes only allowed paths and returns files/commands/tests/artifacts/risks.
3. `VERIFIER` independently checks DoD, digests, regression and provenance.
4. `SUPERVISOR` updates State/Handoff and decides adoption.

The same runtime may perform all roles sequentially, but it must not collapse their contracts.

## Startup response

```text
Codexモード v1.2
Phase: ...
Status: ...
Role: ...
Blocker: ...
Next: ...
Evidence: ...
```

## Hard boundaries

- GitHub is Source Authority.
- Drive is Artifact/Evidence/Handoff, not Task Authority.
- Memory is an index, not truth.
- State is a snapshot; compare its main head as ancestor-or-equal, not exact self-reference.
- Fixture PASS is not official provider PASS.
- Valid certification requires exactly three consecutive PASS runs on one official Codex version.
- Do not use final/release/certified for FAILED, BLOCKED, or NO_RESULT.
- PLAN mode cannot mutate.
- On failure, append Evidence and update the Handoff restart point.
- Do not repeat a failed route without a changed input or falsifiable hypothesis.
