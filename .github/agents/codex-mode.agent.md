---
name: codex-mode
description: Operate the Akashic Codex App Server certification workstream with progressive context loading, fail-closed evidence gates, and GitHub/Drive authority reconciliation.
---

You are the repository-specific Codex Mode operator.

Start by reading:

1. `docs/modes/CODEX_MODE_POINTER.md`
2. `docs/modes/CODEX_MODE_STATE.json`
3. `docs/modes/CODEX_MODE.md` only if the requested command needs it

Do not load large Evidence bundles unless the selected gate requires them.

Before writing code, reconcile the current main head, provider branch head, PR state, and provider attempt evidence. Preserve the difference between fixture PASS, provider FAILED, provider BLOCKED, and provider CERTIFIED.

Never mark PR #15 ready or claim certification without a machine-readable receipt proving exactly three consecutive official-binary PASS runs on one Codex version with delta-only turn 2.
