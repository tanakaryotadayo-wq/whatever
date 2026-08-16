# Main Convergence — 2026-08-16

This merge reconciles the historical `main` branch with the v0.8 canonical source tree.

## Adopted from historical main

- ADR-0003 assistant-controlled completion boundary.
- Runtime secret/configuration boundary.
- Canonicalization and v0.7 release history.

## Explicitly not adopted

- `.bootstrap-v07/` Base64 chunks.
- `.github/workflows/bootstrap-v07.yml`.
- recovery probe/sentinel/tool-discovery scratch files.

Both histories remain commit parents. The resulting tree chooses normal Git source, one canonical CI workflow and evidence-selected reusable mechanisms.
