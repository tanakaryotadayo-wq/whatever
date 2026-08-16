export const runtime = "nodejs";
export const dynamic = "force-static";

const body = `# Privacy policy — Akashic Codex Mode GPT

This private GPT sends user-approved Action requests to the user's Akashic Gateway.

The Gateway may process task identifiers, goals, acceptance criteria, workflow status, ContextNeed and ContextPacketDelta metadata, source/evidence references, and operational diagnostics.

The integration must not intentionally send or store passwords, API keys, authorization headers, cookies, or raw credential material in Action responses, GitHub, Google Drive evidence, or logs.

GitHub is the source/configuration authority. Google Drive is the artifact/evidence plane. Vercel hosts the Action API and workflow adapter.

For private single-owner use, requests are authenticated using a Bearer API key. Public or multi-user use requires a separate OAuth and privacy review.
`;

export async function GET() {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
