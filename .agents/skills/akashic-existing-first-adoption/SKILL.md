---
name: akashic-existing-first-adoption
description: Discover, verify, adapt and adopt existing standards or implementations before authoring custom Akashic infrastructure.
---

# Existing-First Adoption

Use this Skill before adding a new runtime primitive, protocol, storage mechanism, workflow feature, policy engine or agent framework.

## Required sequence

1. Restate the exact unsolved responsibility and its acceptance/failure matrix.
2. Search in this order: official standard, official implementation, official sample, mature OSS, community pattern, custom implementation.
3. Compare the candidate with current Akashic contracts. Do not replace a stronger internal invariant with a weaker public standard.
4. Choose one import mode:
   - `STANDARD_CONTRACT`
   - `PATTERN_ONLY`
   - `PINNED_DEPENDENCY`
   - `REFERENCE_IMPLEMENTATION`
   - `BOUNDED_EXPERIMENT`
5. Record source URL and immutable revision/version. A moving `main` link alone is not sufficient for a dependency.
6. For dependencies, check license, maintenance, security history, rollback and version pinning.
7. Add conformance and fault tests before declaring adoption.
8. Delete or deprecate replaced custom code only after behavioral equivalence is proven.
9. Write an adoption receipt under `knowledge/adoption-receipts/`.
10. Reject or defer candidates that add a second authority, hide state, weaken provenance or require unbounded framework coupling.

## Non-negotiable rules

- A durable platform does not make external effects exactly once.
- An interoperability standard may be the public surface while Akashic keeps stricter internal CAS, policy and evidence.
- Experimental forks are pattern mines by default, not production dependencies.
- Never add a new TaskStore, memory authority or workflow engine merely because a framework provides one.
- Evidence beats feature lists. Competing backends run the same scenario and disqualifiers.
