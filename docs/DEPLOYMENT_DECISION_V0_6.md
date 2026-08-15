# Akashic deployment decision v0.6

**Decision:** split the public gateway, durable task authority, execution runner, source plane, and artifact plane. Do not force all five into one hosting product.

```text
ChatGPT / Sites
      │
      ▼
Vercel MCP gateway
      │
      ▼
Akashic runner registration
  ├─ local/VM runner: subscription-auth Codex / Claude / local AI
  └─ cloud sandbox runner: API-auth build/test
      │
      ▼
Cloudflare durable Kernel candidate
Durable Objects / Workflows / R2
      │
  ┌───┴────┐
  ▼        ▼
GitHub   Google Drive
source   artifacts/evidence
```

## Fixed roles

- **Vercel:** public HTTPS MCP/API ingress and optional sandbox build/test; not the sole durable TaskStore.
- **Cloudflare:** next durable Kernel target; Worker + Durable Objects + Workflows/Queues + R2 + Sandbox/Containers.
- **ChatGPT Sites:** operator console only, never the secret-bearing state authority.
- **GitHub:** source, review, commit/tree identities and CI; not a long-lived agent server.
- **Google Drive:** release/evidence/build-capsule mirror; not a transactional TaskStore.
- **WASM:** deterministic Context Plane utilities; not a CLI process supervisor.
- **local/VM:** subscription-authenticated provider workers.

## Deployment order

1. Deploy Vercel gateway to native `vercel.app` URL.
2. Keep mutations disabled until auth is explicit.
3. Register an authenticated runner URL.
4. Connect `/api/mcp` in ChatGPT Developer Mode.
5. Build Sites console against the gateway.
6. Deploy Cloudflare to `workers.dev`; custom DNS last.

A provider execution is not called live until the official binary/SDK completes a real round trip in that environment.
