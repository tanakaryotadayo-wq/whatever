# Akashic subagent workstreams v0.6

The Kernel should treat “subagents” as independently accountable workers, not as
characters sharing a giant conversation.

## Default lanes

1. `research` — current platform/spec facts, no writes.
2. `protocol` — schemas, compatibility maps, conformance tests.
3. `builder` — isolated worktree implementation.
4. `critic` — patch/evidence review, no workspace mutation.
5. `release` — hashes, manifest, Drive upload and index update.

## Handoff contract

```json
{
  "context_id": "ctx-feature-123",
  "from_task_id": "task-builder-123",
  "to_task_id": "task-critic-123",
  "goal": "Review the bounded patch",
  "known_refs": ["artifact://sha256/..."],
  "budget": {"max_tokens": 2400, "tokenizer": "receiver-native"},
  "acceptance": ["No unverified claims", "Focused tests are sufficient"]
}
```

## Loop guards

- max agent hops: 4
- max Context negotiation rounds per task: 3
- path record must not contain the next recipient already
- critic cannot delegate back to itself
- release lane cannot change source code

## Evidence rule

A lane may report success only with machine evidence or an explicit `SKIPPED`
reason. A fixture pass is not rewritten as a live provider pass.
