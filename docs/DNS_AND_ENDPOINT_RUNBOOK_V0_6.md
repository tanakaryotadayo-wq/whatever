# Endpoint Runbook — v0.7

## Endpoints

| Endpoint | Purpose | Public |
|---|---|---|
| Vercel `/api/health` | gateway configuration health | yes, non-secret |
| Vercel `/api/mcp` | ChatGPT MCP ingress | yes, authenticated by ChatGPT/App policy |
| Temporal control `/healthz` | control bridge health | restricted |
| Temporal control `/a2a` | tasks/send|get|update|cancel compatibility bridge | restricted, bearer auth |
| Temporal Service `7233` | Workflow client/worker connection | never exposed as public HTTP |

## Bring-up order

1. Start Temporal local development server or connect to Temporal Cloud.
2. Start the Workflow Worker on task queue `akashic-v07`.
3. Start the authenticated Temporal Control Server.
4. Verify control `/healthz` from the Vercel execution environment.
5. Set `AKASHIC_CONTROL_URL`, token, and host allowlist in Vercel preview.
6. Keep `AKASHIC_MUTATIONS_ENABLED=false`; connect ChatGPT and verify read-only status.
7. Enable mutations only for an authenticated preview and submit a bounded fixture task.
8. Promote only after query, Context Delta Update, cancellation, and artifact evidence pass.

## DNS policy

- Use platform-generated hostnames before custom DNS.
- The Vercel hostname is the only required public endpoint for ChatGPT.
- The control service should use private networking, authenticated tunnel, or a narrowly exposed HTTPS hostname.
- Do not publish a local Codex Worker port.
- Do not point the Gateway at both Temporal and Cloudflare Task kernels.

## Rollback

1. Set `AKASHIC_MUTATIONS_ENABLED=false`.
2. Revert Vercel to the prior deployment.
3. Leave Temporal histories intact for diagnosis.
4. Stop Activity Workers if an external side effect is suspected.
5. Reconcile effect ledger, artifact digests, and adoption generation before retry.
