# ADR-0005 — Existing-First External Adoption

Status: ACCEPTED  
Date: 2026-08-16

## Decision

Akashic will not create a custom runtime primitive until an explicit search has been performed for an official standard, official implementation/sample, or mature OSS solution. Existing solutions are imported at the smallest sound boundary: contract, pattern, pinned dependency, reference implementation, or bounded experiment.

This is not a blanket preference for third-party frameworks. Akashic retains stronger internal invariants when an external standard is weaker, and rejects dependencies that create a second authority, hide lifecycle state, erase provenance, or couple the Core to an experimental fork.

## Adoption gate

Every new external adoption must include:

- a precisely scoped problem and failure matrix;
- source URL plus revision/version identity;
- source classification and import mode;
- license/version/maintenance checks for dependencies;
- implementation paths;
- conformance and fault tests;
- replaced or avoided custom code;
- known risks and rollback path;
- a machine-readable adoption receipt.

The CI workflow `external-adoption-gate.yml` validates the policy and receipts. An imported feature without a receipt and conformance evidence is research, not adopted Core.

## Source priority

```text
official standard
→ official implementation
→ official sample
→ mature OSS
→ community pattern
→ custom implementation
```

The order may be overridden only when the higher-ranked option fails the fixed Akashic contract. The reason must be recorded in the receipt.

## Dependency rule

Prefer `PATTERN_ONLY` or `STANDARD_CONTRACT` over a dependency. A dependency is accepted only when its operational value exceeds its coupling cost and it is pinned, licensed, replaceable and tested behind an Akashic-owned interface.

## Consequences

- Good external work is reused instead of reimplemented.
- Experimental repos remain useful as pattern mines without becoming silent production foundations.
- Replaced custom code is removed only after equivalence evidence exists.
- Future agents can determine why a mechanism exists and where it came from without relying on conversation memory.
