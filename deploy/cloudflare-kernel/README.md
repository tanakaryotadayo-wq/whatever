# Akashic Cloudflare Durable Kernel scaffold

This is the **durable Control Plane candidate**, not the first deployment target.
It stores one task per Durable Object and exposes a small HTTP domain API. The
actual Codex/Claude/local-model runner remains external until a Sandbox/Container
binding is configured.

## Why Cloudflare

- Durable Object identity maps naturally to `task_id` or `context_id`.
- Worker handles public HTTPS routing and authentication.
- Workflows/Queues can later drive retries and replay.
- R2 can become the CAS/Data Plane.
- Sandbox SDK combines Workers, Durable Objects, and isolated Linux containers.

## Deploy safely

```bash
npm install
npx wrangler secret put AKASHIC_CONTROL_TOKEN
npm test
npm run deploy
```

Use the generated `workers.dev` hostname first. Do not add a custom domain until
that endpoint works. A Worker Custom Domain requires an active Cloudflare zone
and cannot be attached to a hostname that already has a conflicting CNAME.

## Deliberate limits

- No MCP endpoint is claimed yet.
- No provider credentials are embedded.
- No automatic task execution is claimed.
- State transition API is intended for an authenticated runner only.
