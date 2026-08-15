import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ArtifactRef, TaskCapsule, TurnInput, TurnOutput, Verification } from './types';

const digest = (body: Buffer) => `sha256:${createHash('sha256').update(body).digest('hex')}` as const;

export interface Activities {
  compileContext(task: TaskCapsule): Promise<ArtifactRef>;
  runAgentTurn(input: TurnInput): Promise<TurnOutput>;
  verifyCandidate(ref: ArtifactRef, task: TaskCapsule): Promise<Verification>;
  adoptArtifact(ref: ArtifactRef, verification: Verification, effectKey: string): Promise<ArtifactRef>;
}

export function createFixtureActivities(root: string): Activities {
  async function put(artifactType: string, value: unknown, mediaType = 'application/json'): Promise<ArtifactRef> {
    const body = Buffer.from(JSON.stringify(value));
    const bodyDigest = digest(body);
    const file = path.join(root, bodyDigest.slice(7, 9), bodyDigest.slice(7));
    await mkdir(path.dirname(file), { recursive: true });
    try {
      const previous = await readFile(file);
      if (!previous.equals(body)) throw new Error('digest_collision');
    } catch (error: any) {
      if (error.code === 'ENOENT') await writeFile(file, body);
      else throw error;
    }
    return {
      schema: 'akashic.artifact-ref/v1',
      media_type: mediaType,
      digest: bodyDigest,
      size: body.length,
      uri: `file://${file}`,
      artifact_type: artifactType,
    };
  }

  return {
    async compileContext(task) {
      return put('compiled_context', { task_id: task.task_id, goal: task.goal, refs: task.context_refs ?? [] });
    },

    async runAgentTurn(input) {
      if (input.turn_no === 1) {
        return {
          outcome: 'INPUT_REQUIRED',
          agent_session_id: `fixture:${input.task_id}`,
          context_need: {
            schema: 'akashic.context-need/v1',
            task_id: input.task_id,
            request_id: `req:${input.task_id}:1`,
            logical_attempt_id: input.logical_attempt_id,
            expected_seq: 0,
            need: ['missing acceptance evidence'],
            known: ['task capsule'],
            max_tokens: 512,
          },
        };
      }
      const candidate = await put('candidate', {
        task_id: input.task_id,
        turn_no: input.turn_no,
        delta: input.context_delta_ref?.digest ?? null,
        complete: true,
      });
      return {
        outcome: 'COMPLETED',
        agent_session_id: input.agent_session_id ?? `fixture:${input.task_id}`,
        candidate_artifact_refs: [candidate],
        compact_result: 'fixture completed',
      };
    },

    async verifyCandidate(ref) {
      const report = await put('verification_report', {
        verdict: 'PASS',
        subject_digest: ref.digest,
        checks: ['digest', 'acceptance'],
      });
      return { verdict: 'PASS', subject_digest: ref.digest, report_ref: report };
    },

    async adoptArtifact(ref, verification, effectKey) {
      if (verification.verdict !== 'PASS' || verification.subject_digest !== ref.digest) {
        throw new Error('adoption_rejected');
      }
      await put('effect_receipt', {
        effect_key: effectKey,
        subject_digest: ref.digest,
        result_digest: ref.digest,
      });
      return ref;
    },
  };
}
