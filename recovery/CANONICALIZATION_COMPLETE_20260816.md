# Akashic v0.7 Canonicalization Completion Record

Date: 2026-08-16
Branch: `akashic/v0.7-canonical-temporal`
PR: #3

## Closed in this branch

- Recovered the Drive v0.6 Stateful Worker and Context Compiler into GitHub source control.
- Preserved the v0.6 cloud gateway and detached hardening lineage.
- Established GitHub as source/workspace authority and Temporal as the only durable workflow authority.
- Added ref-first contracts, content-addressed artifacts, effect ledger, verification/adoption gate, and separated identifier semantics.
- Implemented the fixture `RunAgentTask` vertical slice with validated ContextPacketDelta CAS.
- Added one-Codex-turn-per-Activity adapters and provider session capability classification.
- Demoted the Cloudflare kernel to a conformance implementation rather than a competing state authority.
- Reconstructed the canonical overlay from 167 CRC/size/path-validated ZIP local entries.
- Re-cloned this public branch into a clean directory and passed doctor, schema validation, Python compile/tests, Vercel tests, Cloudflare conformance tests, and Temporal unit/integration tests.
- Published source, evidence, manifest, SHA-256 checksums, and the provider gate record to the Google Drive `releases/` plane.

## Sole external provider gate

The official Codex live two-turn acceptance remains `SKIPPED_FAIL_CLOSED` until run on a host containing the user's subscription-authenticated official Codex binary. Required proof:

1. Turn 1 reaches `INPUT_REQUIRED`.
2. `ContextPacketDelta` resumes the same `logical_attempt_id` and provider thread.
3. Turn 2 reaches `COMPLETED` without resending the full Task Capsule.
4. Machine-generated transcript, process metadata, artifact hashes, and verification evidence are attached.

Tracking issue: #4.

Fixture success is not provider proof.
