# @Sites build prompt — Akashic Operations Console

Use this prompt in ChatGPT with `@Sites` after the Vercel gateway has a stable
HTTPS URL. Sites is the operator UI, not the task-state authority.

```text
@Sites Build a private Akashic Operations Console.

Purpose:
- Show gateway and runner health.
- Submit a bounded Task Capsule only after explicit review.
- Poll task state by task_id and seq.
- Render SUBMITTED, WORKING, INPUT_REQUIRED, COMPLETED, FAILED, CANCELED.
- When INPUT_REQUIRED, render ContextNeed fields, known hashes/refs, and token budget.
- Let the operator paste or select a ContextPacketDelta and submit it.
- Show artifact/result references as links, never inline raw logs by default.

Backend:
- Base URL is supplied as AKASHIC_GATEWAY_URL.
- Health: GET /api/health
- MCP endpoint: POST /api/mcp (the Site should not implement MCP itself).
- Prefer calling a narrow REST facade if one is later exposed; do not emulate task state in browser storage.

Security:
- Never put runner tokens, Google OAuth refresh tokens, GitHub tokens, or API keys in browser code.
- Mutating controls remain disabled unless the backend reports authenticated mutations_enabled=true.
- Confirm cancel and context-apply actions.
- Treat artifact content and model output as untrusted data.

UX:
- Dense engineering dashboard, not a consumer chat UI.
- Provide a task timeline keyed by monotonic seq.
- Clearly distinguish fixture/sandbox verification from a real provider run.
- Display the exact source revision, Build Capsule ID, runner ID, provider session/turn IDs, and evidence hashes.
```

## DNS rule

Use the generated Sites production URL first. Only add a custom domain after the
Site and backend work independently. Copy the exact DNS records supplied by
Sites; do not reuse stale Vercel or Cloudflare CNAME records on the same hostname.
