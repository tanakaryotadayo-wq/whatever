# Akashic ChatGPT Gateway v0.6

A stateless ChatGPT-facing MCP gateway for the Akashic execution kernel.

- MCP endpoint: `/api/mcp`
- Health endpoint: `/api/health`
- Durable task state stays in the external Akashic runner.
- Mutating tools are disabled by default.
- Configure `AKASHIC_RUNNER_URL`, `AKASHIC_RUNNER_TOKEN`, and only then set `AKASHIC_MUTATIONS_ENABLED=true` behind authentication.

Deploy the `deploy/vercel-chatgpt-app` directory as a Next.js project. Use the native `vercel.app` URL before custom DNS.
