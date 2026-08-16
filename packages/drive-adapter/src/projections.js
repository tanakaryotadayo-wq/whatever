import { Readable } from "node:stream";
import { canonicalJson, sha256 } from "@akashic/contracts";
import { withDriveRetry } from "./retry.js";

const FIELDS = "id,name,mimeType,size,appProperties,parents,createdTime,modifiedTime";
function escapeDriveLiteral(value) { return String(value).replaceAll("\\", "\\\\").replaceAll("'", "\\'"); }
function snapshotBytes(snapshot) { return Buffer.from(`${canonicalJson(snapshot)}\n`); }

async function findProjection({ drive, projectionFolderId, taskId, retryOptions }) {
  const response = await withDriveRetry(() => drive.files.list({
    q: [
      `'${escapeDriveLiteral(projectionFolderId)}' in parents`,
      "trashed = false",
      `appProperties has { key='akashic_task_id' and value='${escapeDriveLiteral(taskId)}' }`,
      "appProperties has { key='akashic_projection' and value='true' }"
    ].join(" and "),
    pageSize: 10,
    orderBy: "createdTime asc",
    fields: `files(${FIELDS})`,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  }), retryOptions);
  return response?.data?.files?.[0] ?? null;
}

async function readProjection(drive, fileId, retryOptions) {
  const response = await withDriveRetry(() => drive.files.get({ fileId, alt: "media", supportsAllDrives: true }), retryOptions);
  if (Buffer.isBuffer(response?.data)) return JSON.parse(response.data.toString("utf8"));
  if (typeof response?.data === "string") return JSON.parse(response.data);
  return response?.data;
}

export async function projectTaskSnapshot({ drive, projectionFolderId, snapshot, retryOptions }) {
  if (!drive?.files) throw new Error("DRIVE_CLIENT_REQUIRED");
  if (!projectionFolderId) throw new Error("DRIVE_PROJECTION_FOLDER_REQUIRED");
  if (!snapshot || typeof snapshot.task_id !== "string" || !Number.isSafeInteger(snapshot.state_seq)) throw new Error("INVALID_TASK_SNAPSHOT_PROJECTION");
  const currentFile = await findProjection({ drive, projectionFolderId, taskId: snapshot.task_id, retryOptions });
  if (currentFile) {
    const current = await readProjection(drive, currentFile.id, retryOptions);
    const currentSeq = Number(current?.state_seq ?? -1);
    if (currentSeq > snapshot.state_seq) return { file_id: currentFile.id, uri: `gdrive://file/${currentFile.id}`, applied: false, stale: true, current_state_seq: currentSeq };
    if (currentSeq === snapshot.state_seq && canonicalJson(current) === canonicalJson(snapshot)) return { file_id: currentFile.id, uri: `gdrive://file/${currentFile.id}`, applied: false, stale: false, idempotent_replay: true, current_state_seq: currentSeq };
  }

  const bytes = snapshotBytes(snapshot);
  const requestBody = {
    name: `${snapshot.task_id}.status.json`,
    mimeType: "application/json",
    appProperties: {
      akashic_projection: "true",
      akashic_authority: "temporal",
      akashic_task_id: snapshot.task_id.slice(0, 120),
      akashic_state_seq: String(snapshot.state_seq),
      akashic_projection_sha256: sha256(canonicalJson(snapshot))
    }
  };
  const response = currentFile
    ? await withDriveRetry(() => drive.files.update({ fileId: currentFile.id, requestBody, media: { mimeType: "application/json", body: Readable.from([bytes]) }, fields: FIELDS, supportsAllDrives: true }), retryOptions)
    : await withDriveRetry(() => drive.files.create({ requestBody: { ...requestBody, parents: [projectionFolderId] }, media: { mimeType: "application/json", body: Readable.from([bytes]) }, fields: FIELDS, supportsAllDrives: true }), retryOptions);
  const fileId = response?.data?.id;
  if (!fileId) throw new Error("DRIVE_PROJECTION_FILE_ID_MISSING");
  return { file_id: fileId, uri: `gdrive://file/${fileId}`, applied: true, stale: false, idempotent_replay: false, state_seq: snapshot.state_seq };
}
