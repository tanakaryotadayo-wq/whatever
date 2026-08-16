# ADR-0005 — Temporal Worker Deployments and Role Task Queues

Status: ACCEPTED FOR v0.8 RC  
Date: 2026-08-16  
Packet: KPK-009

## Decision

Adopt Temporal's current Worker Deployment Versioning instead of the deprecated `buildId + useVersioning` API. Every production worker process uses one Deployment Version composed of:

```text
deployment_name = akashic-agent-operating-layer
build_id        = immutable source/build identity, normally the Git commit SHA
behavior        = PINNED
```

The same Deployment Version is used by four distinct Task Queues:

```text
akashic-workflow-v1  — deterministic Workflow code only
akashic-context-v1   — CompileContext / MergeContextDelta
akashic-agent-v1     — one RunAgentTurn Activity
akashic-assurance-v1 — VerifyCandidate / AdoptArtifact
```

This follows Temporal's Worker Deployment model and official worker-specific Task Queue pattern rather than inventing an Akashic deployment router.

## Why PINNED

Running `RunAgentTask` executions must keep processing on workflow code compatible with the history they started on. New versions can be activated and ramped separately. Old Worker Deployment Versions remain available until their pinned executions drain or are deliberately moved/reset.

## Production environment

```bash
export AKASHIC_TEMPORAL_VERSIONING=1
export AKASHIC_TEMPORAL_DEPLOYMENT_NAME=akashic-agent-operating-layer
export AKASHIC_TEMPORAL_BUILD_ID="$GITHUB_SHA"
```

Temporal Worker Controller environments are accepted directly:

```text
TEMPORAL_DEPLOYMENT_NAME
TEMPORAL_WORKER_BUILD_ID
```

After the new workers are polling, activate or ramp the version with the Temporal CLI:

```bash
temporal worker deployment describe --name akashic-agent-operating-layer

temporal worker deployment set-ramping-version \
  --deployment-name akashic-agent-operating-layer \
  --build-id "$AKASHIC_TEMPORAL_BUILD_ID" \
  --percentage 5

temporal worker deployment set-current-version \
  --deployment-name akashic-agent-operating-layer \
  --build-id "$AKASHIC_TEMPORAL_BUILD_ID"
```

## Boundaries

- Development and time-skipping tests remain unversioned unless explicitly enabled.
- All `@temporalio/*` packages are pinned to one exact SDK version.
- A Task Queue is an execution routing boundary, not an authority boundary. Temporal remains the single workflow authority.
- Provider-specific session affinity can later use a more specific agent queue, but the Workflow contract remains provider-neutral.
- Do not delete an old worker version merely because a new version is current; verify drainage first.

## Evidence sources

- Temporal Worker Versioning GA announcement, 2026-03-30.
- Temporal official `Configure a Worker for Versioning` TypeScript example.
- Temporal official `Roll out and pin Workflows` runbook.
- `temporalio/samples-typescript/worker-specific-task-queues`.
- `@temporalio/worker` 1.21.1, current at adoption time.
