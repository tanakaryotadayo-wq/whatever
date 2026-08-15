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
- Published source, evidence, manifest, SHA-256 checksums, and provider-gate evidence to the Google Drive `releases/` plane.
- Removed all user-operated IDE/workspace dependencies from the Core completion path via ADR-0003.

## Provider certification boundary

Akashic Core is considered closed by provider-independent automated evidence. A provider-specific live runtime that is not exposed through a connected ChatGPT tool is not allowed to block Core completion.

The subscription-authenticated official Codex live two-turn test is therefore an OPTIONAL PROVIDER CERTIFICATION while that binary is not directly invokable from this chat. When the runtime becomes connector/API-accessible, certification should prove:

1. Turn 1 reaches `INPUT_REQUIRED`.
2. `ContextPacketDelta` resumes the same `logical_attempt_id` and provider thread.
3. Turn 2 reaches `COMPLETED` without resending the full Task Capsule.
4. Machine-generated transcript, process metadata, artifact hashes, and verification evidence are attached.

Tracking issue: #4 may remain open as provider certification work, but it is not a Core merge blocker.

Fixture success is Core contract evidence, not provider-specific proof.
