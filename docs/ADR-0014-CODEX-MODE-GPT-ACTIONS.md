# ADR-0014 — Codex Mode as a Private GPT with Actions

**Status:** PROPOSED  
**Date:** 2026-08-16

## Problem

Codex Mode already has a deterministic cross-session bootstrap, machine-readable Current State, Handoff, evidence gates and a conversation command grammar. However, a normal Chat session still relies on the model to interpret the grammar and decide when to invoke connected tools.

The next UX step is to make the operation surface executable without making the GPT itself a new state authority.

## External mechanism

OpenAI custom GPTs provide:

- persistent GPT Instructions;
- uploaded Knowledge for reference material;
- custom Actions defined by OpenAPI and authenticated with API key or OAuth;
- Preview testing and GPT version history.

A single GPT cannot use both Apps and Actions simultaneously. This design therefore chooses Actions and places all live GitHub/Drive/workflow access behind one Akashic HTTPS Action domain.

Official references:

- https://help.openai.com/en/articles/8554397-creating-and-editing-gpts-with-actions
- https://help.openai.com/en/articles/9442513

## Decision

Create a private GPT named `Akashic Codex Mode`.

```text
GPT
= command grammar, stable policy, status presentation

GPT Actions
= typed HTTP calls to Akashic Gateway

Akashic Gateway
= authentication, validation and mutation enforcement

GitHub
= Source / Mode State / Handoff / CI authority

Google Drive
= Artifact / Evidence / Manifest mirror
```

### Stable versus live data

- Stable Mode rules are GPT Instructions and a small Knowledge set.
- Current State is never uploaded as GPT Knowledge.
- Boot/status/evidence are read through Actions on every new GPT conversation.
- The GPT does not use saved memory as authority.

### Authentication

v1 is private and single-owner:

```text
GPT Action auth = API key / Bearer
Gateway auth    = AKASHIC_GATEWAY_AUTH_MODE=bearer
Mutation gate   = AKASHIC_MUTATIONS_ENABLED=true
```

Public or multi-user use requires OAuth and a published privacy policy.

### Initial Action surface

Read:

- gateway health;
- Codex Mode boot;
- compact status;
- provider evidence;
- workflow status.

Mutation:

- start workflow;
- apply exact ContextPacketDelta;
- cancel workflow.

Generic `continue`, `repair`, `close` and certification publication are not exposed until each has a bounded backend contract and idempotency/effect rule.

## Operational activation gate

The repository package is `BUILDER_READY`, not `OPERATIONAL`, until the routes are deployed, Bearer authentication is configured, mutation readiness is intentional, Preview evals pass, and one bounded workflow round trip succeeds. GPT creation in the ChatGPT Builder remains a UI action because the current connected tool surface does not expose a GPT-create API.

## Consequences

### Gains

- the GPT boots from live authority rather than conversation memory;
- action selection is described by explicit operation IDs;
- mutating operations are authenticated and server-enforced;
- Preview evals can test action choice and non-overclaiming;
- the same GPT can be called from a fresh conversation without restating history.

### Constraints

- Apps/Connectors are unavailable inside this GPT while Actions are configured;
- Drive/GitHub connector behavior must be wrapped by the Action backend;
- Actions are not available in ChatGPT's Pro model mode, so the GPT must use a current non-Pro model that supports Actions;
- the GPT remains a ChatGPT-native UI, not an embeddable external application.

## Rollback

Remove the GPT configuration and new read routes. Existing MCP, Vercel Workflow, Temporal, GitHub and Drive contracts remain unchanged.
