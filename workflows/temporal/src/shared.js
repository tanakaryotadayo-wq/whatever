import { defineQuery, defineUpdate } from "@temporalio/workflow";
import { TASK_QUEUES, taskQueue } from "./task-queues.js";

export { TASK_QUEUES, taskQueue };
export const submitTask = defineUpdate("akashic.submitTask");
export const applyContextDelta = defineUpdate("akashic.applyContextDelta");
export const requestCancel = defineUpdate("akashic.requestCancel");
export const getTaskSnapshot = defineQuery("akashic.getTaskSnapshot");
