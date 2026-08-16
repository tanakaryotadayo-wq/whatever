# ADR-0011 — Existing-First External Adoption

**Status:** ACCEPTED  
**Date:** 2026-08-16  
**Renumbered from:** ADR-0010

## Decision

Akashic must search for and evaluate an existing standard, official implementation, official sample, or mature OSS mechanism before authoring a new infrastructure primitive.

The search order is:

1. official standard;
2. official implementation;
3. official sample;
4. mature OSS;
5. community pattern;
6. custom implementation.

An external mechanism is not adopted from a feature list. Adoption requires:

- immutable source revision or exact dependency version;
- license when code is imported;
- explicit responsibility and failure matrix;
- integration point in Akashic;
- conformance and fault tests;
- replaced or avoided custom code;
- risks and rollback path;
- machine-readable adoption receipt.

## Boundary

External standards may define the public compatibility surface while Akashic keeps stronger internal invariants. No import may weaken Context Delta CAS, effect fencing, policy, provenance, verification, or the one-authority-per-responsibility rule.

Experimental forks are pattern sources by default, not production dependencies. New TaskStores, memory authorities, or workflow engines are rejected unless the current authority is deliberately replaced through the fixed bake-off and migration plan.

## Enforcement

- `knowledge/external-adoption-policy.json` is the machine policy.
- `knowledge/adoption-receipts/*.json` records each decision.
- `scripts/validate-external-adoption-policy.mjs` is part of canonical CI.
- `.agents/skills/akashic-existing-first-adoption/SKILL.md` applies the discipline to Agent work.
