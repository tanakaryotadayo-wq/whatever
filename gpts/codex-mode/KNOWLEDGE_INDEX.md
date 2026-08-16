# Knowledge upload index

GPT Knowledge is static reference, not current state.

Upload no more than these four text-forward files:

1. `docs/modes/CODEX_MODE.md`
   - stable operating rules, lifecycle and certification DoD.
2. `docs/modes/CODEX_MODE_POINTER.md`
   - authority locations and progressive read order.
3. `docs/ADR-0012-CODEX-MODE-UX.md`
   - progressive bootstrap and command UX rationale.
4. `docs/ADR-0013-CODEX-MODE-HANDOFF-STATE-INTEGRITY.md`
   - Supervisor/Executor/Verifier and Handoff integrity.

Do **not** upload as Knowledge:

- `CODEX_MODE_STATE.json`;
- provider `latest.json` files;
- manifests that change frequently;
- live logs, traces, ZIPs or patches;
- credentials.

Those must be fetched through Actions so a new GPT conversation cannot mistake stale embedded material for live authority.

The GPT package itself (`GPT_PACKAGE.json`, OpenAPI and evals) is Builder configuration, not Knowledge.
