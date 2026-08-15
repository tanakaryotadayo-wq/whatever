---
trigger: always_on
---

# Akashic repository rule

1. Read `AGENTS.md`, `akashic.workspace.json`, and `docs/architecture/CANONICAL_V07.md` before changing architecture.
2. Do not create a second Task Authority. Temporal is canonical for v0.7.
3. Do not put large context, logs, diffs, or artifacts into Workflow history. Store immutable bytes and pass `ArtifactRefV1`.
4. One agent turn is one Activity. Return `INPUT_REQUIRED`; never block an Activity waiting for input.
5. Preserve `task_id`, `logical_attempt_id`, `request_id`, `delta_id`, `context_seq`, and `turn_no` as distinct identities.
6. Treat all external effects as at-least-once. Use effect keys, digest verification, and fencing.
7. Never directly adopt an agent-edited workspace. Produce candidate → verify → adopt.
8. Run `make doctor`, `make test`, and `make test-p0` before claiming core completion.
9. Run `make test-codex-live` only on an authenticated official Codex host and retain its evidence.
10. Do not report fixture, mock Drive, or preview Gateway evidence as production acceptance.
