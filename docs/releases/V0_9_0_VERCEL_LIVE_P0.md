# Akashic v0.9 — Vercel Workflow Live P0 Acceptance

Status: **LIVE_P0_PASS / BACKEND_SELECTION_OPEN**  
Date: 2026-08-16

## Result

The canonical `RunAgentTask` Vercel Workflow was built from GitHub commit `b15973a77abb14e078f8fe1567da035740e93ea9` and executed on Vercel production infrastructure using `workflow@4.6.0`.

The Vercel compiler recognized **10 steps and 1 workflow**. The live run `wrun_01M045H7JGMDAH8ZK5CAS1YBCS` passed all eleven acceptance checks:

- reached `INPUT_REQUIRED`;
- rejected stale `ContextPacketDelta` as `STALE_SEQUENCE`;
- accepted the valid Delta;
- resumed the same Workflow run;
- advanced `context_seq` from 0 to 1;
- completed exactly two Agent turns;
- produced verification, provenance, and adoption references;
- suppressed a duplicate submit while the owner Workflow was active.

The complete machine evidence is stored in `evidence/vercel-live-p0-20260816.json` with SHA-256:

`c5509b59cfc839a46ddf1a33a777a54f45acdcb2386b7388929d12a6e02c75b2`

## Defects found by live execution

The first live attempt exposed a fixture-hidden defect: applying a valid Delta already performed `INPUT_REQUIRED -> WORKING`, after which the turn loop attempted an illegal `WORKING -> WORKING` transition. The repair adds `beginAgentTurn()`, which advances `turn_no` and `state_seq` without pretending that a new state transition occurred.

The first attempt also disproved an assumption about Vercel hook tokens. Hook conflicts provide duplicate suppression while the owner run is active. Once the run completes and disposes its hook, the token can be reused. Therefore post-terminal task-result reuse requires a separate durable result index and is not claimed here.

## Scope boundary

This evidence proves the Vercel Workflow backend contract with the fixture Agent adapter. It does **not** prove:

- official Codex App Server same-thread live two-turn;
- real Google Drive resumable upload and projection;
- post-terminal task-id result reuse;
- that Vercel has won the final Temporal / Vercel / Cloudflare bake-off.

The Workflow Authority selection remains open until the same measured failure matrix is executed across candidates.
