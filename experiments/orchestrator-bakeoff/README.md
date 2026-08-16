# Akashic Orchestrator Bake-off

This experiment imports KPK-026. It prevents architecture selection by feature-list debate.

Backends under test:

- Temporal
- Vercel Workflows
- Cloudflare Workflows

Every backend must emit `akashic.orchestrator-bakeoff-result/v1` for the same `RunAgentTask` scenario. Run:

```bash
npm test
node score.mjs /path/to/backend-result.json
```

A backend is qualified only if all mandatory gates pass, evidence refs carry SHA-256 digests, and no disqualifier is present. Operational simplicity adds only a small bonus and can never compensate for a correctness failure.
