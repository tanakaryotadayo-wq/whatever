import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { createFixtureActivities } from '../src/activities';
import { applyContextDelta, cancelTask, getTask, taskQueue } from '../src/shared';
import type { ContextDelta, TaskCapsule } from '../src/types';
import { runAgentTask } from '../src/workflows';

const task = (suffix: string): TaskCapsule => ({
  schema: 'akashic.task-capsule/v1',
  task_id: `task-${suffix}`,
  context_id: `context-${suffix}`,
  logical_attempt_id: 'attempt-1',
  goal: 'Close the durable two-turn vertical slice.',
  acceptance: ['stale delta rejected', 'valid delta resumes', 'artifact adopted'],
  agent: 'fixture',
  idempotency_key: `submit-${suffix}`,
});

async function waitForState(handle: any, state: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const snapshot = await handle.query(getTask);
    if (snapshot.state === state) return snapshot;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`workflow did not reach ${state}`);
}

test('RunAgentTask rejects stale context then resumes and adopts', async () => {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  const root = await mkdtemp(path.join(os.tmpdir(), 'akashic-temporal-'));
  const worker = await Worker.create({
    connection: env.nativeConnection,
    taskQueue,
    workflowsPath: require.resolve('../src/workflows'),
    activities: createFixtureActivities(root),
  });
  try {
    await worker.runUntil(async () => {
      const capsule = task('complete');
      const handle = await env.client.workflow.start(runAgentTask, {
        taskQueue,
        workflowId: capsule.task_id,
        args: [capsule],
      });
      const waiting = await waitForState(handle, 'INPUT_REQUIRED');
      assert.equal(waiting.request_id, `req:${capsule.task_id}:1`);

      const artifact = {
        schema: 'akashic.artifact-ref/v1' as const,
        media_type: 'application/json',
        digest: `sha256:${'1'.repeat(64)}` as const,
        size: 2,
        uri: 'memory://delta-1',
        artifact_type: 'context_delta',
      };
      const stale: ContextDelta = {
        schema: 'akashic.context-packet-delta-ref/v1',
        task_id: capsule.task_id,
        delta_id: 'delta-stale',
        request_id: waiting.request_id!,
        logical_attempt_id: capsule.logical_attempt_id,
        expected_seq: waiting.context_seq + 1,
        delta_ref: artifact,
      };
      await assert.rejects(
        handle.executeUpdate(applyContextDelta, { updateId: stale.delta_id, args: [stale] }),
      );

      const valid: ContextDelta = {
        ...stale,
        delta_id: 'delta-valid',
        expected_seq: waiting.context_seq,
      };
      const accepted = await handle.executeUpdate(applyContextDelta, {
        updateId: valid.delta_id,
        args: [valid],
      });
      assert.deepEqual(accepted, { accepted: true, applied_seq: 1, state: 'WORKING' });

      const result = await handle.result();
      assert.equal(result.state, 'COMPLETED');
      assert.equal(result.terminal, true);
      assert.equal(result.context_seq, 1);
      assert.equal(result.turn_no, 2);
      assert.equal(result.artifact_refs.length, 1);
      assert.equal(result.error, null);
    });
  } finally {
    await env.teardown();
  }
});

test('RunAgentTask cancellation is durable while waiting for input', async () => {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  const root = await mkdtemp(path.join(os.tmpdir(), 'akashic-cancel-'));
  const worker = await Worker.create({
    connection: env.nativeConnection,
    taskQueue: `${taskQueue}-cancel`,
    workflowsPath: require.resolve('../src/workflows'),
    activities: createFixtureActivities(root),
  });
  try {
    await worker.runUntil(async () => {
      const capsule = task('cancel');
      const handle = await env.client.workflow.start(runAgentTask, {
        taskQueue: `${taskQueue}-cancel`,
        workflowId: capsule.task_id,
        args: [capsule],
      });
      await waitForState(handle, 'INPUT_REQUIRED');
      const updateResult = await handle.executeUpdate(cancelTask, { args: [] });
      assert.equal(updateResult.state, 'CANCELED');
      const final = await handle.result();
      assert.equal(final.state, 'CANCELED');
      assert.equal(final.terminal, true);
    });
  } finally {
    await env.teardown();
  }
});
