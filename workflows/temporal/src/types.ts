export type TaskState =
  | 'SUBMITTED'
  | 'COMPILING_CONTEXT'
  | 'WORKING'
  | 'INPUT_REQUIRED'
  | 'VERIFYING'
  | 'ADOPTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELED';

export interface ArtifactRef {
  schema: 'akashic.artifact-ref/v1';
  media_type: string;
  digest: `sha256:${string}`;
  size: number;
  uri: string;
  artifact_type?: string;
}

export interface TaskCapsule {
  schema: 'akashic.task-capsule/v1';
  task_id: string;
  context_id: string;
  logical_attempt_id: string;
  goal: string;
  acceptance: string[];
  agent: 'fixture' | 'codex' | 'claude' | 'local';
  idempotency_key: string;
  context_refs?: ArtifactRef[];
  policy?: Record<string, unknown>;
}

export interface ContextNeed {
  schema: 'akashic.context-need/v1';
  task_id: string;
  request_id: string;
  logical_attempt_id: string;
  expected_seq: number;
  need: string[];
  known: string[];
  max_tokens: number;
  reason?: string;
}

export interface ContextDelta {
  schema: 'akashic.context-packet-delta-ref/v1';
  task_id: string;
  delta_id: string;
  request_id: string;
  logical_attempt_id: string;
  expected_seq: number;
  delta_ref: ArtifactRef;
}

export interface Snapshot {
  schema: 'akashic.task-snapshot/v1';
  task_id: string;
  temporal_run_id: string | null;
  logical_attempt_id: string;
  activity_attempt: number | null;
  agent_session_id: string | null;
  request_id: string | null;
  context_seq: number;
  turn_no: number;
  state: TaskState;
  terminal: boolean;
  artifact_refs: ArtifactRef[];
  error: Record<string, unknown> | null;
}

export interface TurnInput {
  task_id: string;
  logical_attempt_id: string;
  turn_no: number;
  agent: string;
  agent_session_id: string | null;
  task_capsule: TaskCapsule;
  compiled_context_ref: ArtifactRef;
  context_delta_ref: ArtifactRef | null;
  idempotency_key: string;
}

export type TurnOutput =
  | { outcome: 'INPUT_REQUIRED'; agent_session_id: string; context_need: ContextNeed }
  | { outcome: 'COMPLETED'; agent_session_id: string; candidate_artifact_refs: ArtifactRef[]; compact_result: string }
  | { outcome: 'FAILED'; agent_session_id: string | null; retryable: boolean; failure_code: string; compact_result: string };

export interface Verification {
  verdict: 'PASS' | 'FAIL' | 'NEEDS_APPROVAL';
  subject_digest: string;
  report_ref: ArtifactRef;
}
