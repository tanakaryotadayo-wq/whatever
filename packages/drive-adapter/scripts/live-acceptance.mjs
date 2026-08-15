import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createGoogleDriveClient, getDriveStartPageToken, projectTaskSnapshot, publishMailboxEnvelope, putImmutableArtifact } from "../src/index.js";

if (process.env.AKASHIC_DRIVE_LIVE !== "1") {
  console.log(JSON.stringify({ status: "SKIPPED", reason: "set AKASHIC_DRIVE_LIVE=1", exit_code: 77 }));
  process.exit(77);
}
const required = ["AKASHIC_DRIVE_ARTIFACT_FOLDER_ID", "AKASHIC_DRIVE_STAGING_FOLDER_ID", "AKASHIC_DRIVE_PROJECTION_FOLDER_ID", "AKASHIC_DRIVE_MAILBOX_INBOX_FOLDER_ID"];
for (const name of required) if (!process.env[name]) throw new Error(`missing ${name}`);
const { drive, authClient } = await createGoogleDriveClient();
const taskId = `drive-live-${Date.now()}`;
const bytes = Buffer.from(JSON.stringify({ task_id: taskId, nonce: randomUUID() }));
const ref = { media_type: "application/json", digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`, size: bytes.length, uri: "memory://drive-live", artifact_type: "akashic.drive-live-fixture/v1" };
const common = { drive, authorizedRequest: authClient.request.bind(authClient), artifactFolderId: process.env.AKASHIC_DRIVE_ARTIFACT_FOLDER_ID, stagingFolderId: process.env.AKASHIC_DRIVE_STAGING_FOLDER_ID, artifactRef: ref, bytes, taskId };
const first = await putImmutableArtifact(common); const second = await putImmutableArtifact(common);
assert.equal(first.artifact_ref.uri, second.artifact_ref.uri); assert.equal(second.idempotent_replay, true);
const projection = await projectTaskSnapshot({ drive, projectionFolderId: process.env.AKASHIC_DRIVE_PROJECTION_FOLDER_ID, snapshot: { task_id: taskId, state_seq: 1, state: "COMPLETED", result_refs: [first.artifact_ref] } });
const stale = await projectTaskSnapshot({ drive, projectionFolderId: process.env.AKASHIC_DRIVE_PROJECTION_FOLDER_ID, snapshot: { task_id: taskId, state_seq: 0, state: "WORKING" } });
assert.equal(stale.stale, true);
const mailbox = await publishMailboxEnvelope({ drive, laneFolderIds: { inbox: process.env.AKASHIC_DRIVE_MAILBOX_INBOX_FOLDER_ID }, envelope: { schema: "akashic.drive-mailbox-envelope/v1", message_id: `message-${taskId}`, task_id: taskId, lane: "inbox", created_at: new Date().toISOString(), producer: "drive-live-acceptance", payload_ref: first.artifact_ref, correlation: {} } });
const startPageToken = await getDriveStartPageToken({ drive });
console.log(JSON.stringify({ status: "PASS", task_id: taskId, artifact: first.artifact_ref, idempotent_replay: second.idempotent_replay, projection, stale_projection_rejected: stale.stale, mailbox, changes_start_page_token_present: Boolean(startPageToken) }, null, 2));
