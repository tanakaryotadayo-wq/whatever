# ADR-0003 — Assistant-Controlled Execution Only

Status: ACCEPTED  
Date: 2026-08-16  
Scope: Akashic v0.7 canonical execution and completion path

## Decision

Akashic must not depend on Antigravity, a user-operated IDE, a local workspace managed manually by the user, or any other interactive development environment as a completion requirement.

Antigravity is not part of the architecture. Its earlier mention was only a clue that a reproducible cloud workspace can be useful.

The completion path is controlled through connected service APIs and automation that ChatGPT can operate directly.

## Canonical authority split

- GitHub = source authority, review, CI, provenance, reproducible workspace input.
- GitHub Actions = deterministic clean-room execution and validation for the canonical branch.
- Temporal = durable workflow authority when deployed; local/dev Temporal is exercised by automated tests.
- Vercel = thin ChatGPT-facing MCP/HTTPS ingress.
- Google Drive / R2 = immutable artifact, context, evidence, and projection storage; never workflow authority.
- Replit = OPTIONAL disposable cloud execution or external-agent provider only when it can be driven through a connector/API. It is never source authority and never required for completion.
- Akashic = routing, context negotiation/compilation, capability and policy, handoff, effect identity, verification, and artifact adoption.

## Provider boundary

The Akashic Core completion gate is provider-independent.

A provider-specific live test that requires credentials or a runtime not exposed through a connected tool is a provider certification gate, not a Core merge gate. This includes the subscription-authenticated official Codex binary when that binary is not directly invokable from the current ChatGPT tool surface.

Core acceptance requires the provider contract, deterministic fixture path, durable workflow semantics, ContextPacketDelta CAS, idempotent/fenced effects, verification/adoption gate, restart/failure behavior, and ingress/storage adapters to pass in automated environments controlled from this chat.

Provider certification may be added later without changing the Core contract.

## Operational rule

Do not ask the user to open an IDE, run commands, manage worktrees, or operate a local workspace in order to complete Akashic Core.

If a capability can only be reached through a manual environment, either:

1. replace it with an API/connector-controlled equivalent for Core validation, or
2. classify it as optional provider certification and keep the Core path closed without it.

## Consequence

The canonical development topology is now:

ChatGPT → GitHub / GitHub Actions / Vercel / Temporal / Drive (and optionally connector-controlled Replit)

not:

ChatGPT → user-operated IDE → local manual workspace.
