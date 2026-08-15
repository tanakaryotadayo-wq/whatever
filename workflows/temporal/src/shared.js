import { defineQuery, defineUpdate } from "@temporalio/workflow";

export const taskQueue = "akashic-agent-task-v1";
export const submitTask = defineUpdate("akashic.submitTask");
export const applyContextDelta = defineUpdate("akashic.applyContextDelta");
export const requestCancel = defineUpdate("akashic.requestCancel");
export const getTaskSnapshot = defineQuery("akashic.getTaskSnapshot");
