import { withDriveRetry } from "./retry.js";

export async function getDriveStartPageToken({ drive, driveId, retryOptions }) {
  const response = await withDriveRetry(() => drive.changes.getStartPageToken({ ...(driveId ? { driveId } : {}), supportsAllDrives: true }), retryOptions);
  const token = response?.data?.startPageToken;
  if (!token) throw new Error("DRIVE_START_PAGE_TOKEN_MISSING");
  return token;
}

export async function readDriveChanges({ drive, pageToken, driveId, retryOptions, pageSize = 100 }) {
  if (!pageToken) throw new Error("DRIVE_PAGE_TOKEN_REQUIRED");
  const changes = [];
  let cursor = pageToken;
  let newStartPageToken = null;
  do {
    const response = await withDriveRetry(() => drive.changes.list({
      pageToken: cursor,
      pageSize,
      spaces: "drive",
      includeRemoved: true,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      ...(driveId ? { driveId, corpora: "drive" } : {}),
      fields: "nextPageToken,newStartPageToken,changes(fileId,removed,time,file(id,name,mimeType,size,appProperties,parents,modifiedTime,trashed))"
    }), retryOptions);
    changes.push(...(response?.data?.changes ?? []));
    cursor = response?.data?.nextPageToken ?? null;
    newStartPageToken = response?.data?.newStartPageToken ?? newStartPageToken;
  } while (cursor);
  return { changes, next_page_token: newStartPageToken ?? pageToken };
}
