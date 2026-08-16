import { Readable } from "node:stream";
import { createHash, randomUUID } from "node:crypto";
import { validateArtifactRef } from "@akashic/contracts";
import { createResumableDriveFile } from "./resumable.js";
import { withDriveRetry } from "./retry.js";

const DEFAULT_RESUMABLE_THRESHOLD = 5 * 1024 * 1024;
const FILE_FIELDS = "id,name,mimeType,size,appProperties,parents,createdTime,modifiedTime";

export class DriveArtifactConflict extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "DriveArtifactConflict";
    this.code = "DRIVE_ARTIFACT_CONFLICT";
    this.details = details;
  }
}

function digestHex(ref) {
  validateArtifactRef(ref);
  return ref.digest.slice("sha256:".length);
}
function sha256(buffer) { return createHash("sha256").update(buffer).digest("hex"); }
function clip(value, max = 120) { return String(value ?? "").slice(0, max); }
function escapeDriveLiteral(value) { return String(value).replaceAll("\\", "\\\\").replaceAll("'", "\\'"); }

function metadataToRef(ref, file, artifactFolderId) {
  return {
    ...ref,
    uri: `gdrive://file/${file.id}`,
    annotations: {
      ...(ref.annotations ?? {}),
      drive_file_id: String(file.id),
      drive_parent_id: String(artifactFolderId),
      drive_immutable: "true"
    }
  };
}

function assertFileMatches(file, ref) {
  const hex = digestHex(ref);
  const size = Number(file.size);
  if (file.appProperties?.akashic_sha256 !== hex) throw new DriveArtifactConflict("Drive file digest metadata does not match", { file_id: file.id });
  if (Number.isFinite(size) && size !== ref.size) throw new DriveArtifactConflict("Drive file size does not match ArtifactRef", { file_id: file.id, expected: ref.size, actual: size });
  if (file.mimeType && file.mimeType !== ref.media_type) throw new DriveArtifactConflict("Drive file media type does not match ArtifactRef", { file_id: file.id, expected: ref.media_type, actual: file.mimeType });
}

export function immutableArtifactName(ref) { return `sha256-${digestHex(ref)}.blob`; }

export async function findImmutableArtifact({ drive, artifactFolderId, artifactRef, retryOptions }) {
  const hex = digestHex(artifactRef);
  const q = [
    `'${escapeDriveLiteral(artifactFolderId)}' in parents`,
    "trashed = false",
    `appProperties has { key='akashic_sha256' and value='${escapeDriveLiteral(hex)}' }`,
    "appProperties has { key='akashic_immutable' and value='true' }"
  ].join(" and ");
  const response = await withDriveRetry(() => drive.files.list({
    q,
    spaces: "drive",
    pageSize: 20,
    orderBy: "createdTime asc,name",
    fields: `files(${FILE_FIELDS})`,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  }), retryOptions);
  const files = response?.data?.files ?? [];
  if (files.length === 0) return null;
  const file = files[0];
  assertFileMatches(file, artifactRef);
  return metadataToRef(artifactRef, file, artifactFolderId);
}

async function deleteStagingFile(drive, fileId, retryOptions) {
  try {
    await withDriveRetry(() => drive.files.delete({ fileId, supportsAllDrives: true }), { maxAttempts: 3, ...(retryOptions ?? {}) });
  } catch {
    // Best-effort compensation. A sweeper may retry orphan cleanup later.
  }
}

export async function putImmutableArtifact({
  drive,
  authorizedRequest,
  artifactFolderId,
  stagingFolderId,
  artifactRef,
  bytes,
  taskId,
  artifactKind = artifactRef?.artifact_type ?? "artifact",
  schemaVersion = "v1",
  resumableThreshold = DEFAULT_RESUMABLE_THRESHOLD,
  retryOptions
}) {
  if (!drive?.files) throw new Error("DRIVE_CLIENT_REQUIRED");
  if (!artifactFolderId || !stagingFolderId) throw new Error("DRIVE_ARTIFACT_AND_STAGING_FOLDERS_REQUIRED");
  const ref = validateArtifactRef(artifactRef);
  const payload = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const actualHex = sha256(payload);
  const expectedHex = digestHex(ref);
  if (actualHex !== expectedHex) throw new DriveArtifactConflict("Artifact bytes do not match digest", { expected: expectedHex, actual: actualHex });
  if (payload.length !== ref.size) throw new DriveArtifactConflict("Artifact bytes do not match declared size", { expected: ref.size, actual: payload.length });

  const existing = await findImmutableArtifact({ drive, artifactFolderId, artifactRef: ref, retryOptions });
  if (existing) return { artifact_ref: existing, idempotent_replay: true, uploaded: false };

  const appProperties = {
    akashic_sha256: expectedHex,
    akashic_schema: clip(schemaVersion),
    akashic_task_id: clip(taskId),
    akashic_artifact_kind: clip(artifactKind),
    akashic_immutable: "true",
    akashic_publish_state: "staging"
  };
  const requestBody = {
    name: `.staging-${clip(taskId, 48)}-${randomUUID()}`,
    parents: [stagingFolderId],
    mimeType: ref.media_type,
    appProperties
  };

  let staged;
  try {
    if (payload.length >= resumableThreshold) {
      staged = await createResumableDriveFile({ authorizedRequest, requestBody, mediaType: ref.media_type, bytes: payload, fields: FILE_FIELDS, retryOptions });
    } else {
      const response = await withDriveRetry(() => drive.files.create({
        requestBody,
        media: { mimeType: ref.media_type, body: Readable.from([payload]) },
        fields: FILE_FIELDS,
        supportsAllDrives: true
      }), retryOptions);
      staged = response?.data;
    }
    if (!staged?.id) throw new Error("DRIVE_STAGING_FILE_ID_MISSING");

    const publishedResponse = await withDriveRetry(() => drive.files.update({
      fileId: staged.id,
      addParents: artifactFolderId,
      removeParents: stagingFolderId,
      requestBody: {
        name: immutableArtifactName(ref),
        appProperties: { ...appProperties, akashic_publish_state: "published" }
      },
      fields: FILE_FIELDS,
      supportsAllDrives: true
    }), retryOptions);
    const published = publishedResponse?.data;
    if (!published?.id) throw new Error("DRIVE_PUBLISHED_FILE_ID_MISSING");
    assertFileMatches(published, ref);
    return { artifact_ref: metadataToRef(ref, published, artifactFolderId), idempotent_replay: false, uploaded: true };
  } catch (error) {
    if (staged?.id) await deleteStagingFile(drive, staged.id, retryOptions);
    throw error;
  }
}
