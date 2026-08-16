# ADR-0013 — Codex Mode State Integrity and Role-Separated Handoff

**Status:** ACCEPTED  
**Date:** 2026-08-16

## Problem

Codex Mode v1.1 fixed stale prose by separating Current State from the stable specification. Two reflection gaps remained:

1. `observed_main_head` was stored inside a file committed to `main`. Updating that file changes `main`, so an exact equality check makes the state stale by construction.
2. The existing operating pattern “Codex App = coordinator, codexcli = implementer” was documented elsewhere but not represented as a machine-readable Work Packet and Handoff.

The v1.0 bootstrap Manifest also omitted Current State and no longer matched the v1.1 files.

## Imported structures

Akashic imports mechanisms rather than product identity:

- repository custom agents with bounded responsibility and tool scope;
- reusable Agent Skills;
- isolated task execution followed by explicit review/apply;
- subagents with independent context and permissions;
- lifecycle hooks and permission boundaries;
- plugin composition that separates reusable instructions from external app authority.

Internal precedent: `codex_dual_operating_mode.md` supplies the Goal/Scope/DoD/Out-of-Scope and Result/Handoff contracts.

## Decision

### Snapshot head semantics

Replace `observed_main_head` with:

```text
reconciled_against_main_head
main_head_relation = ANCESTOR_OR_EQUAL
```

The value means “the main commit against which this snapshot was reconciled before the snapshot write.” Activation always fetches the live head.

### Role pipeline

```text
SUPERVISOR → Work Packet
EXECUTOR   → Result Packet
VERIFIER   → Adoption verdict
SUPERVISOR → State/Handoff persistence
```

The roles are semantic. They do not require three services or another TaskStore.

### Handoff

Add `docs/modes/CODEX_MODE_HANDOFF.json` with:

- Goal, Scope, DoD, Out of Scope
- authority and expected heads
- allowed/protected paths
- attempt ledger
- do-not-repeat conditions
- next executable action
- executor return contract
- verification/adoption verdict

### Integrity Manifest

The Codex Mode Manifest must hash the active Spec, Pointer, State, Handoff, schemas, validators, Skill, custom agent, ADRs, and audit records. CI validates bytes and SHA-256.

## UX consequence

A new session can answer `状態` from L0/L1, resume from L1.5, and load Evidence only for the selected gate. The user no longer has to restate the work, and the Agent cannot silently confuse planning, execution, verification, and adoption.

## Non-goals

- another workflow engine
- another Task Authority
- autonomous credential acquisition
- forcing separate physical agents for the three roles
- deleting historical branches without an explicit archival review

## Rollback

Remove Handoff/role files and revert to v1.1. Provider Evidence and runtime authorities remain unchanged.
