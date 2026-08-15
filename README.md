# Akashic Agent Operating Layer

Akashic decides **who executes what, with which context and authority, and which result is adopted as verified evidence**. It sits above replaceable durable-workflow and Agent runtimes.

## Authority split

- **GitHub** — source, CI, review and provenance.
- **Akashic** — routing, ContextNeed/ContextPacketDelta, context compilation, policy, handoff, effect identity, verification and adoption.
- **Temporal** — current P0 workflow authority and reference implementation.
- **Vercel Workflows / Cloudflare Workflows** — bounded comparison candidates, never parallel authorities for the same Task.
- **Drive / R2** — content-addressed artifact, context and evidence storage plus rebuildable projections.
- **ChatGPT + authenticated MCP** — operator and command surface.

## What is already executable

- durable `RunAgentTask` with Update-With-Start and CAS-validated context input;
- one Agent turn per retryable Activity;
- separate Workflow, Context, Agent and Assurance Task Queues;
- current Temporal Worker Deployment Versioning with pinned workflow behavior;
- OCI-style ArtifactRef, effect-generation fencing, provenance and verification-gated adoption;
- Google Drive immutable artifact/projection/mailbox adapter using official Drive APIs;
- MCP Tasks projection, policy-as-code, fast/durable routing and session-recovery contracts;
- evidence-linked JSONL evaluation flywheel;
- fixed Temporal/Vercel/Cloudflare comparison scenario.

The 30-packet machine registry lives at `knowledge/packet-registry.json`. Reusable operating discipline lives under `.agents/skills/`.

## Reproduce

```bash
npm ci
npm audit --audit-level=high
npm run doctor
npm run test:schemas
npm run test:knowledge
npm run test:core
npm run test:p0
npm run test:gateway
npm run test:cloudflare
```

## Non-claims

Fixture and contract success are not provider certification. Authenticated official Codex App Server two-turn, real Drive credentials/folders, authenticated ChatGPT→Vercel mutation and the measured workflow-backend bake-off remain explicit live gates.
