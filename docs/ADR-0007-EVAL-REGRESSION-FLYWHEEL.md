# ADR-0007 — Evaluation Regression Flywheel

Status: ACCEPTED FOR v0.8 RC  
Date: 2026-08-16  
Packet: KPK-022

## Decision

Adopt the mature JSONL-dataset plus grader pattern used by OpenAI Evals, but keep Akashic Core CI deterministic and provider-independent.

Every accepted regression case is one JSON object per line and contains:

```text
case_id
capability
input
expected deterministic grader
source_refs
verification_ref for trace-derived cases
case_digest
```

## Failure-to-eval flow

```text
runtime trace / fault evidence / human correction
  -> immutable ArtifactRefs
  -> CANDIDATE EvalCase
  -> independent verification/adoption
  -> ACCEPTED JSONL corpus
  -> deterministic CI grader
  -> content-addressed EvalReport
```

A failure or correction never silently edits the accepted corpus. It creates a candidate tied to immutable evidence; a separate verification step promotes it.

## Grader order

1. Exact or subset JSON checks.
2. Expected error codes.
3. Ordered lifecycle/effect checks.
4. Optional hosted/model-based grading only for semantics that cannot be made deterministic.

Model judges are not a Core merge dependency. If used later, their model/version/rubric and evidence must be pinned in a separate report.

## Initial regression corpus

The v0.8 corpus covers:

- remote work routes to durable execution;
- short interactive work remains on the fast lane;
- mutations default to forbidden and reads default to allowed;
- lost sessions fail closed;
- Context cache invalidates on corpus revision;
- MCP Task projection exposes `input_required`;
- stale ContextPacketDelta is rejected;
- stale effect owners are fenced;
- terminal Tasks cannot reopen.

## Existing implementation reused

The runner invokes the real `@akashic/contracts` capabilities. It does not copy their logic into an eval-only shadow implementation.

## Evidence sources

- OpenAI Evals repository JSONL datasets and deterministic Match/FuzzyMatch grader conventions.
- OpenAI evaluation guidance: define task-specific datasets and graders, run continuously, and add cases from observed failures.
