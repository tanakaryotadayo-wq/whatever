# DNS and endpoint runbook v0.6

## Rule zero

Prove the native hosted URL first:

- Vercel: `https://<deployment>.vercel.app/api/health`
- Cloudflare: `https://<worker>.<subdomain>.workers.dev/healthz`
- Sites: generated production Site URL

Only add custom DNS after the endpoint and authentication work on the native URL.

## Vercel

1. Deploy and test `/api/health` and `/api/mcp` on `vercel.app`.
2. Add one hostname to one Vercel project.
3. Remove stale A/AAAA/CNAME records for that exact hostname.
4. Copy the project-specific record Vercel provides.
5. Check CAA only if certificate issuance fails.
6. Do not point the same hostname at Sites or Cloudflare simultaneously.

## Cloudflare Worker

Choose one mode:

- **Custom Domain:** Worker is the origin. Requires an active Cloudflare zone.
  Cloudflare creates the record and certificate. The hostname cannot already
  contain a conflicting CNAME.
- **Route:** Worker runs in front of an existing origin. A proxied DNS record must
  already exist; otherwise requests can fail before reaching the Worker.

For Akashic's first Cloudflare deployment, use `workers.dev`, then attach a new
subdomain such as `kernel.example.com` after removing conflicts.

## Sites

Use the generated Site URL first. When custom domains are available, Sites gives
specific DNS records. Copy those exact records and avoid reusing a hostname that
already belongs to Vercel or Cloudflare.

## Recommended hostnames

```text
console.example.com  -> ChatGPT Sites operator UI
mcp.example.com      -> Vercel ChatGPT MCP gateway
kernel.example.com   -> Cloudflare durable Kernel
runner.example.com   -> authenticated local/VM runner tunnel
```

Keeping one role per hostname avoids the CNAME collisions that commonly derail
multi-platform setups.
