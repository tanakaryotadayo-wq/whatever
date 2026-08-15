# Akashic Agent Operating Layer

Akashic decides **who executes what, with which context and authority, and which result is adopted as verified evidence**. It sits above replaceable durable workflow and Agent runtimes.

## Canonical authority split

- GitHub: source, CI, review and provenance.
- Akashic: routing, ContextNeed/ContextPacketDelta, context compilation, policy, handoff, effect identity, verification and adoption.
- Temporal: provisional P0 workflow authority.
- Vercel Workflows and Cloudflare Workflows: bounded comparison candidates, not parallel authorities.
- Drive/R2: content-addressed artifact, context and evidence storage/projections.
- ChatGPT + authenticated MCP: operator and command surface.

## Imported knowledge

The library-backed registry at `knowledge/packet-registry.json` tracks 30 external Knowledge Packets and their exact adoption state. v0.8 adds executable contracts for MCP Tasks projection, fast/durable routing, policy-as-code, CloudEvents/W3C trace context, context cache identity, provider session recovery, effect fencing, provenance and versioned verification. Reusable operating discipline lives under `.agents/skills/`.

## Verify

```bash
npm install
npm run doctor
npm run test:schemas
npm run test:knowledge
npm run test:core
npm run test:p0
```

The real Codex provider certification remains a separate fail-closed test because fixture success is not provider proof.
