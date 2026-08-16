# ADR-0003 — Assistant-Controlled Execution Only

Status: ACCEPTED  
Date: 2026-08-16  
Scope: Akashic canonical execution and completion path

## Decision

Akashic must not depend on Antigravity, a user-operated IDE, a manually managed local workspace, or any other interactive development environment as a completion requirement.

Antigravity is not part of the architecture. Its earlier mention was only a clue that a reproducible cloud workspace can be useful.

The completion path is controlled through connected service APIs and automation that ChatGPT can operate directly.

## Canonical authority split

- GitHub = source authority, review, CI, provenance and reproducible workspace input.
- GitHub Actions = deterministic clean-room execution and validation.
- Temporal = current durable P0 workflow authority and reference implementation.
- Vercel = ChatGPT-facing MCP/HTTPS ingress and workflow comparison candidate.
- Google Drive / R2 = immutable artifact, context, evidence and projection storage; never workflow authority.
- Replit = optional disposable cloud execution or external-Agent provider only when connector/API controlled. It is never source authority and never required.
- Akashic = routing, context negotiation/compilation, capability and policy, handoff, effect identity, verification and artifact adoption.

## Provider boundary

The Akashic Core completion gate is provider-independent. A provider-specific live test requiring credentials or a runtime not exposed through a connected tool is a provider certification gate, not a Core merge gate.

Core acceptance requires provider-neutral contracts, deterministic fixtures, durable workflow semantics, ContextPacketDelta CAS, idempotent/fenced effects, verification/adoption, restart/failure behavior and ingress/storage adapters to pass in automated environments controlled from this chat.

## Operational rule

Do not ask the user to open an IDE, run commands, manage worktrees or operate a local workspace to complete Akashic Core. Replace manual-only dependencies with API/connector-controlled equivalents or classify them as optional provider certification.
