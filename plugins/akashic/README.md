# Akashic Plugin Packaging Plan

OpenAI Plugins are the target workflow package for ChatGPT and Codex. The canonical repository currently supplies reusable Skills under `.agents/skills/` and an MCP surface through the Vercel gateway.

The future private Akashic Plugin should bundle:

- skills: task routing, context negotiation, verification/adoption, orchestrator bake-off;
- app/MCP dependency: the authenticated Akashic MCP endpoint;
- action controls: read tools allowed by policy, mutation tools default-denied or confirmation-gated;
- source-system permissions: never broaden GitHub or Drive access.

This directory deliberately does **not** invent an unverified plugin manifest. Packaging is completed against the current OpenAI Plugin/App template schema available to the target workspace. Skills remain useful independently of that packaging step.
