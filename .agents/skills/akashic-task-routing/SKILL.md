---
name: akashic-task-routing
description: Route Akashic work to a fast interactive lane or a durable workflow lane using an explicit, auditable RoutingDecisionV1 receipt.
---

# Akashic Task Routing

Use this skill before dispatching an agent task.

## Procedure

1. Identify the stable `task_id` and expected acceptance criteria.
2. Choose the **durable lane** when any of these apply:
   - expected duration exceeds the configured threshold;
   - the task may wait for human, policy, or context input;
   - restart recovery is required;
   - execution occurs on a remote worker;
   - artifact adoption or an external mutation is possible;
   - more than one agent participates;
   - a policy gate must survive process loss.
3. Otherwise choose the **fast lane** for bounded interactive work.
4. Emit `akashic.routing-decision/v1` with the automatic lane, selected lane, reasons, threshold, and policy version.
5. An operator override is allowed, but the receipt must retain the automatically detected durable reasons.

## Invariants

- Do not put every coding edit through a durable workflow.
- Do not bypass durability for a task that can enter `INPUT_REQUIRED` or mutate adopted artifacts.
- Routing is policy, not model intuition; the decision must be reproducible from inputs.
