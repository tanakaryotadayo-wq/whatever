# Cognitive Compiler Architecture

## Overview

The cognitive compiler model separates *thinking* from *executing*.

- **Compiler** (Shinon / GPT-5.5 Pro): Ingests context via RAG + Sovereign Search, reasons about the task, and emits a **Task Capsule** — a self-contained execution plan.
- **Executor** (Codex): Receives the Task Capsule and executes it inside a sandboxed workspace. Codex does not re-derive intent; it follows the capsule.

## Pipeline

```text
User Intent
  → Shinon (cognitive compiler)
    → RAG: recall relevant context from Akashic DB / neural_packets.db
    → Sovereign Search: discover public implementations with provenance
    → Emit Task Capsule (JSON)
  → Codex A2A Worker (executor)
    → Execute in sandboxed workspace
    → Return structured result
  → Human gate (merge / deploy / delete / secret-affecting)
```

## Task Capsule

A Task Capsule is the interface between compiler and executor:

```json
{
  "task_id": "string",
  "goal": "concrete, bounded implementation task",
  "workspace": "/path/to/workspace",
  "mode": "implement | review_diff | research_then_implement",
  "sandbox": "workspace-write",
  "constraints": ["list of structural constraints"],
  "provenance": ["sovereign search results, if any"],
  "use_sovereign_search": true
}
```

## Prohibited Vocabulary

These terms are banned from this architecture:

| Banned | Use Instead |
|---|---|
| minimal | bounded |
| safety-reduced | structurally constrained |
| dry-run default | execute default, preview explicit |
| API-key-first | subscription-authenticated |

## Adopted Vocabulary

| Term | Meaning |
|---|---|
| execution-first | Default is execute. Preview requires explicit opt-in. |
| subscription-authenticated | Codex authenticates via ChatGPT subscription login, not API keys. |
| structural integrity | Safety comes from structure (sandboxing, bounded tasks, provenance gates), not from weakening capability. |
| authority topology | Clear hierarchy: compiler thinks, executor acts, human gates critical operations. |

## Integration Points

- **AICLI**: Shinon's CLI surface for invoking Sovereign Search and emitting Task Capsules.
- **A2A Worker**: HTTP gateway that receives Task Capsules and runs Codex.
- **Sovereign Search**: Unified search engine over GitHub, Hugging Face, and Akashic DB.
- **Human Gate**: Merge, deploy, deletion, and secret-affecting actions require human approval.
