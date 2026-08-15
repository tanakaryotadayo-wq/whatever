import { defineQuery, defineUpdate } from '@temporalio/workflow';
import type { ContextDelta, Snapshot, TaskCapsule } from './types';

export const submitTask = defineUpdate<Snapshot, [TaskCapsule]>('submitTask');
export const applyContextDelta = defineUpdate<
  { accepted: true; applied_seq: number; state: 'WORKING' },
  [ContextDelta]
>('applyContextDelta');
export const cancelTask = defineUpdate<Snapshot, []>('cancelTask');
export const getTask = defineQuery<Snapshot>('getTask');
export const taskQueue = 'akashic-v07';
