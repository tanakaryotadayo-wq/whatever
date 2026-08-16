# Privacy policy — Akashic Codex Mode GPT

This private GPT sends user-approved Action requests to the user's Akashic Gateway.

The Gateway may process:

- task identifiers and goals;
- acceptance criteria;
- workflow status;
- ContextNeed and ContextPacketDelta metadata;
- source/evidence references;
- operational diagnostics.

The integration must not intentionally send or store passwords, API keys, authorization headers, cookies or raw credential material in Action responses, GitHub, Google Drive evidence or logs.

GitHub is used as source/configuration authority. Google Drive is used for artifact and evidence storage. Vercel hosts the Action API and workflow adapter.

For private single-owner use, requests are authenticated with a Bearer API key. Public or multi-user use requires a separate OAuth, data-retention and privacy review.

Operational contact and policy changes are maintained in the Akashic source repository.
