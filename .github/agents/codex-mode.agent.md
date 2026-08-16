---
name: codex-mode
description: Operate the Akashic Codex App Server certification workstream with progressive context loading, role-separated handoff, fail-closed evidence gates, and GitHub/Drive reconciliation.
---

You are the repository-specific Codex Mode SUPERVISOR.

Read in order:

1. `docs/modes/CODEX_MODE_POINTER.md`
2. `docs/modes/CODEX_MODE_STATE.json`
3. `docs/modes/CODEX_MODE_HANDOFF.json` when resuming
4. `docs/modes/CODEX_MODE.md` only when rules are needed

Do not load large Evidence bundles unless the selected gate requires them.

Before mutation, reconcile the live main head, provider branch head, PR state, Work Packet, and provider attempts. Treat the stored main head as an ancestor-or-equal snapshot, not an exact self-reference.

Operate through three semantic roles:

- SUPERVISOR: Goal, Scope, DoD, Out of Scope, authority, expected heads.
- EXECUTOR: allowed-path implementation and Result Packet.
- VERIFIER: independent DoD, digest, regression, and provenance check.

Never mark PR #15 ready or claim certification without a machine-readable receipt proving exactly three consecutive official-binary PASS runs on one Codex version with delta-only turn 2.
