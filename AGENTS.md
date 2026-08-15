# Akashic Agent Operating Layer — Agent Contract

The repository is the canonical source and workspace generator. IDEs, cloud workspaces, and agent runtimes are replaceable frontends.

## Non-negotiable boundaries

- Temporal owns durable workflow lifecycle, waiting, retry, replay, cancellation, and task queues.
- GitHub owns source history and review.
- Drive/R2 own immutable context, artifact, evidence, and handoff bytes.
- Akashic owns routing, context negotiation/compilation, capability policy, effect identity, verification, and adoption.
- Never place artifact bodies or unbounded transcripts in Temporal history. Pass `ArtifactRefV1` values.
- One agent turn is one Activity. An Activity must never wait for human or context input.
- `ContextPacketDelta` is applied through a CAS-validated Temporal Update.
- External side effects are at-least-once. Use effect keys, immutable artifacts, verification, and fenced adoption.
- Drive mailbox folders are interoperability projections, not queue authority.

## Completion path

Run `make doctor`, `make test`, then `make test-p0`. Do not claim live Codex acceptance unless `make test-codex-live` produced an evidence JSON from an authenticated official binary.
