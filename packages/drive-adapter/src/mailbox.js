import { Readable } from "node:stream";
import { canonicalJson, validateArtifactRef } from "@akashic/contracts";
import { withDriveRetry } from "./retry.js";

export const MAILBOX_LANES = Object.freeze(["inbox", "outbox", "receipts", "dead_letter"]);

export async function publishMailboxEnvelope({ drive, laneFolderIds, envelope, retryOptions }) {
  if (!drive?.files) throw new Error("DRIVE_CLIENT_REQUIRED");
  if (!envelope || envelope.schema !== "akashic.drive-mailbox-envelope/v1") throw new Error("INVALID_MAILBOX_ENVELOPE");
  if (!MAILBOX_LANES.includes(envelope.lane)) throw new Error("INVALID_MAILBOX_LANE");
  if (!envelope.message_id || !envelope.task_id || !envelope.created_at) throw new Error("MAILBOX_IDENTITY_REQUIRED");
  validateArtifactRef(envelope.payload_ref);
  const folderId = laneFolderIds?.[envelope.lane];
  if (!folderId) throw new Error(`MAILBOX_FOLDER_REQUIRED:${envelope.lane}`);
  const bytes = Buffer.from(`${canonicalJson(envelope)}\n`);
  const response = await withDriveRetry(() => drive.files.create({
    requestBody: {
      name: `${envelope.message_id}.json`,
      parents: [folderId],
      mimeType: "application/json",
      appProperties: {
        akashic_mailbox: "true",
        akashic_mailbox_lane: envelope.lane,
        akashic_message_id: String(envelope.message_id).slice(0, 120),
        akashic_task_id: String(envelope.task_id).slice(0, 120),
        akashic_payload_sha256: envelope.payload_ref.digest.slice("sha256:".length)
      }
    },
    media: { mimeType: "application/json", body: Readable.from([bytes]) },
    fields: "id,name,mimeType,size,appProperties,parents,createdTime",
    supportsAllDrives: true
  }), retryOptions);
  const fileId = response?.data?.id;
  if (!fileId) throw new Error("DRIVE_MAILBOX_FILE_ID_MISSING");
  return { message_id: envelope.message_id, lane: envelope.lane, file_id: fileId, uri: `gdrive://file/${fileId}`, immutable: true };
}
