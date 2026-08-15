import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  createResumableDriveFile,
  getDriveStartPageToken,
  projectTaskSnapshot,
  publishMailboxEnvelope,
  putImmutableArtifact,
  readDriveChanges,
  withDriveRetry
} from "../src/index.js";

async function readBody(body) {
  if (body === undefined || body === null) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === "string") return Buffer.from(body);
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
function parseQuery(q, key) { return q.match(new RegExp(`key='${key}' and value='([^']*)'`))?.[1] ?? null; }

class FakeDrive {
  constructor() {
    this.records = new Map(); this.nextId = 1; this.failPublish = false;
    this.files = {
      list: async ({ q }) => {
        const parent = q.match(/'([^']+)' in parents/)?.[1];
        const sha = parseQuery(q, "akashic_sha256"); const taskId = parseQuery(q, "akashic_task_id");
        const immutable = parseQuery(q, "akashic_immutable"); const projection = parseQuery(q, "akashic_projection");
        const items = [...this.records.values()].filter((r) => !r.trashed)
          .filter((r) => !parent || r.parents.includes(parent))
          .filter((r) => !sha || r.appProperties?.akashic_sha256 === sha)
          .filter((r) => !taskId || r.appProperties?.akashic_task_id === taskId)
          .filter((r) => !immutable || r.appProperties?.akashic_immutable === immutable)
          .filter((r) => !projection || r.appProperties?.akashic_projection === projection)
          .map((r) => this.metadata(r));
        return { data: { files: items } };
      },
      create: async ({ requestBody, media }) => {
        const id = `file-${this.nextId++}`; const body = await readBody(media?.body);
        const record = { id, name: requestBody.name, mimeType: requestBody.mimeType ?? media?.mimeType, size: String(body.length), appProperties: { ...(requestBody.appProperties ?? {}) }, parents: [...(requestBody.parents ?? [])], body, createdTime: new Date(this.nextId * 1000).toISOString(), modifiedTime: new Date(this.nextId * 1000).toISOString(), trashed: false };
        this.records.set(id, record); return { data: this.metadata(record) };
      },
      update: async ({ fileId, requestBody = {}, media, addParents, removeParents }) => {
        if (this.failPublish && addParents) { this.failPublish = false; const error = new Error("publish failed"); error.response = { status: 400 }; throw error; }
        const record = this.records.get(fileId); if (!record) throw Object.assign(new Error("not found"), { response: { status: 404 } });
        if (addParents) for (const parent of addParents.split(",")) if (!record.parents.includes(parent)) record.parents.push(parent);
        if (removeParents) record.parents = record.parents.filter((parent) => !removeParents.split(",").includes(parent));
        if (requestBody.name) record.name = requestBody.name; if (requestBody.mimeType) record.mimeType = requestBody.mimeType;
        if (requestBody.appProperties) record.appProperties = { ...requestBody.appProperties };
        if (media?.body) { record.body = await readBody(media.body); record.size = String(record.body.length); }
        record.modifiedTime = new Date().toISOString(); return { data: this.metadata(record) };
      },
      get: async ({ fileId, alt }) => {
        const record = this.records.get(fileId); if (!record) throw Object.assign(new Error("not found"), { response: { status: 404 } });
        return alt === "media" ? { data: JSON.parse(record.body.toString("utf8")) } : { data: this.metadata(record) };
      },
      delete: async ({ fileId }) => { this.records.delete(fileId); return { data: {} }; }
    };
    this.changes = {
      getStartPageToken: async () => ({ data: { startPageToken: "cursor-1" } }),
      list: async ({ pageToken }) => pageToken === "cursor-1"
        ? { data: { changes: [{ fileId: "file-1", removed: false }], nextPageToken: "cursor-2" } }
        : { data: { changes: [{ fileId: "file-2", removed: true }], newStartPageToken: "cursor-3" } }
    };
  }
  metadata(record) { const { body, trashed, ...metadata } = record; return structuredClone(metadata); }
}

function artifactRef(bytes) {
  const payload = Buffer.from(bytes);
  return { media_type: "application/json", digest: `sha256:${createHash("sha256").update(payload).digest("hex")}`, size: payload.length, uri: "file://candidate", artifact_type: "fixture" };
}

test("immutable artifact uses staging, digest metadata, publish move and dedup", async () => {
  const drive = new FakeDrive(); const bytes = Buffer.from('{"ok":true}'); const ref = artifactRef(bytes);
  const first = await putImmutableArtifact({ drive, artifactFolderId: "artifacts", stagingFolderId: "staging", artifactRef: ref, bytes, taskId: "task-1" });
  assert.equal(first.uploaded, true); const record = [...drive.records.values()][0]; assert.deepEqual(record.parents, ["artifacts"]); assert.equal(record.name, `sha256-${ref.digest.slice(7)}.blob`); assert.equal(record.appProperties.akashic_publish_state, "published");
  const second = await putImmutableArtifact({ drive, artifactFolderId: "artifacts", stagingFolderId: "staging", artifactRef: ref, bytes, taskId: "task-1" });
  assert.equal(second.idempotent_replay, true); assert.equal(second.artifact_ref.uri, first.artifact_ref.uri); assert.equal(drive.records.size, 1);
});

test("failed publish compensates by deleting the staging object", async () => {
  const drive = new FakeDrive(); drive.failPublish = true; const bytes = Buffer.from("failure");
  await assert.rejects(putImmutableArtifact({ drive, artifactFolderId: "artifacts", stagingFolderId: "staging", artifactRef: artifactRef(bytes), bytes, taskId: "task-fail" }), /publish failed/);
  assert.equal(drive.records.size, 0);
});

test("projection ignores stale state_seq and is idempotent at the same snapshot", async () => {
  const drive = new FakeDrive(); const current = { task_id: "task-1", state_seq: 4, state: "WORKING" };
  assert.equal((await projectTaskSnapshot({ drive, projectionFolderId: "projections", snapshot: current })).applied, true);
  const stale = await projectTaskSnapshot({ drive, projectionFolderId: "projections", snapshot: { task_id: "task-1", state_seq: 3, state: "INPUT_REQUIRED" } });
  assert.equal(stale.stale, true); assert.equal(stale.applied, false);
  assert.equal((await projectTaskSnapshot({ drive, projectionFolderId: "projections", snapshot: current })).idempotent_replay, true);
});

test("mailbox writes immutable lane envelopes instead of moving task state", async () => {
  const drive = new FakeDrive(); const payload = artifactRef(Buffer.from("payload"));
  const result = await publishMailboxEnvelope({ drive, laneFolderIds: { inbox: "inbox-folder" }, envelope: { schema: "akashic.drive-mailbox-envelope/v1", message_id: "message-1", task_id: "task-1", lane: "inbox", created_at: "2026-08-16T00:00:00Z", producer: "fixture", payload_ref: payload, correlation: {} } });
  const record = drive.records.get(result.file_id); assert.deepEqual(record.parents, ["inbox-folder"]); assert.equal(record.appProperties.akashic_mailbox, "true");
});

test("Changes API cursor is paged without treating changes as state authority", async () => {
  const drive = new FakeDrive(); const token = await getDriveStartPageToken({ drive }); const result = await readDriveChanges({ drive, pageToken: token });
  assert.deepEqual(result.changes.map((change) => change.fileId), ["file-1", "file-2"]); assert.equal(result.next_page_token, "cursor-3");
});

test("retry follows bounded exponential policy for retryable responses", async () => {
  let calls = 0; const sleeps = [];
  const result = await withDriveRetry(async () => { calls += 1; if (calls < 3) { const error = new Error("rate limited"); error.response = { status: 429, headers: {} }; throw error; } return "ok"; }, { sleep: async (ms) => sleeps.push(ms), random: () => 0, baseDelayMs: 10 });
  assert.equal(result, "ok"); assert.equal(calls, 3); assert.deepEqual(sleeps, [5, 10]);
});

test("resumable upload uses the official session protocol", async () => {
  const calls = [];
  const data = await createResumableDriveFile({ authorizedRequest: async (request) => { calls.push(request); if (request.method === "POST") return { headers: { location: "https://upload.example/session" } }; return { data: { id: "large-file", size: "6" } }; }, requestBody: { name: "large.bin", parents: ["staging"] }, mediaType: "application/octet-stream", bytes: Buffer.from("123456") });
  assert.equal(data.id, "large-file"); assert.equal(calls[0].params.uploadType, "resumable"); assert.equal(calls[1].headers["content-range"], "bytes 0-5/6");
});
