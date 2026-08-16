# ADR-0012 — Codex Mode Progressive Bootstrap and Lifecycle UX

**Status:** ACCEPTED  
**Date:** 2026-08-16

## Problem

The original Codex mode had a useful activation phrase and a complete operating document, but it loaded too much context, duplicated mutable status inside prose, lacked machine validation, and described the provider gate as `NOT RUN` after real BLOCKED/FAILED attempts had occurred.

A Drive object named `final evidence` also contained only `NO_RESULT`, proving that naming and storage location were not constrained by state.

## Imported structures

Akashic imports mechanisms, not product identity:

1. **Skill-style progressive disclosure** — a small description/pointer is always available; full instructions and Evidence load only on invocation or need.
2. **Custom agent profile** — name, description, bounded responsibility, tool/permission boundary, and predictable entry point are kept in versioned repository files.
3. **Lifecycle hooks** — activation, pre-mutation, post-mutation, failure, and stop have explicit deterministic checks.
4. **Plan/execute separation** — planning commands are read-only; mutation is explicit.
5. **Task-board projection** — DRAFT/ACTIVE/BLOCKED/READY/DONE/FAILED/ARCHIVED improve visibility without creating a second Task Authority.
6. **Plugin composition** — reusable instructions and optional external apps/tools are separated; external permissions remain authoritative.

## Sources

- GitHub Copilot custom agents and repository instructions:
  - https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/create-custom-agents
  - https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-copilot-overview
- Claude Code Skills, subagents, and hooks:
  - https://code.claude.com/docs/en/features-overview
  - https://code.claude.com/docs/en/sub-agents
  - https://code.claude.com/docs/en/hooks
- Replit Agent task system:
  - https://docs.replit.com/core-concepts/agent/task-system
- OpenAI Skills and Plugins:
  - https://help.openai.com/en/articles/20001066
  - https://help.openai.com/en/articles/20001256-plugins-in-codexOpenAI

## Decision

Use four read layers:

```text
Pointer → Current State → Stable Spec → Selected Evidence
```

Add a machine-readable state file and schema. Activation re-fetches current heads and PR status rather than trusting stored SHA values.

Expose a compact command surface:

```text
起動 / 状態 / 続行 / 診断 / 証拠 / 計画 / 終了
```

Use deterministic lifecycle checks:

```text
on_activate
pre_mutation
post_mutation
on_failure
on_stop
```

Provider attempt results are append-only. `FAILED`, `BLOCKED`, and `NO_RESULT` artifacts are kept outside `releases/`. Only a valid exactly-three-run official Codex receipt can set `CERTIFIED`.

## Non-goals

- A new TaskStore
- A new workflow engine
- Autonomous provider credential creation
- Loading all protocol traces at activation
- Treating a GitHub custom agent profile as the only supported runtime

## Rollback

Remove v1.1 State/validator/Skill/profile and restore the v1 specification. Evidence and provider attempts remain intact; no runtime authority is changed.
