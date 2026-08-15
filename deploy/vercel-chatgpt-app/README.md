# Akashic ChatGPT Gateway — v0.7

This Next.js service is a thin MCP/HTTPS ingress. It does not execute agents or own task state.

```text
ChatGPT
  ↓ MCP
Vercel Gateway
  ↓ authenticated JSON-RPC
Temporal Control Server
```

## Environment

```text
AKASHIC_CONTROL_URL=https://control.example.com
AKASHIC_CONTROL_TOKEN=...
AKASHIC_CONTROL_HOST_ALLOWLIST=control.example.com
AKASHIC_MUTATIONS_ENABLED=false
```

`AKASHIC_RUNNER_URL` and `AKASHIC_RUNNER_TOKEN` remain temporary compatibility aliases.

## Safety defaults

- remote control URLs must use HTTPS;
- credentials inside URLs are rejected;
- optional hostname allowlist;
- redirects disabled;
- request timeout enforced;
- secrets removed from returned structures;
- mutations disabled unless explicitly enabled.

## Test and build

```bash
npm install
npm test
npm run build
```

A healthy gateway without `AKASHIC_CONTROL_URL` proves only that the ingress builds. It is not an end-to-end task execution result.
