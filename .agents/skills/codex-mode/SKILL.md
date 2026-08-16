---
name: codex-mode
description: Activate or resume the Akashic Codex App Server workstream. Use when the user says "codexモード起動" or asks for Codex mode status, continuation, diagnosis, evidence, planning, or closeout.
---

# Codex Mode Skill

## Bootstrap

1. Read `docs/modes/CODEX_MODE_POINTER.md`.
2. Read `docs/modes/CODEX_MODE_STATE.json`.
3. Re-fetch current GitHub main/provider heads and PR state.
4. Read `docs/modes/CODEX_MODE.md` only when the requested command needs operating rules.
5. Load only the Evidence referenced by the selected workstream.

Do not ask the user to repeat prior project history.

## Intent normalization

- `codexモード起動` → BOOT
- `codexモード 状態` → STATUS
- `codexモード 続行` → RESUME
- `codexモード 診断` → DIAGNOSE
- `codexモード 証拠` → EVIDENCE
- `codexモード 計画` → PLAN
- `codexモード 終了` → CLOSE

Ambiguous requests default to STATUS, not mutation.

## Startup response

Return the compact Status Card first:

```text
Codexモード v1.1
Phase: ...
Status: ...
Blocker: ...
Next: ...
Evidence: ...
```

## Hard boundaries

- GitHub is source authority.
- Drive is Artifact/Evidence/Handoff, not Task authority.
- Memory is an index, not truth.
- Fixture PASS is not official provider PASS.
- A valid receipt must prove exactly three consecutive PASS runs on one official Codex version.
- Do not reuse the words final, release, or certified for FAILED, BLOCKED, or NO_RESULT attempts.
- In PLAN mode, do not mutate.
- On failure, append evidence and preserve the next restart point.
