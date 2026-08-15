import { withDriveRetry } from "./retry.js";

function readHeader(headers, name) {
  if (!headers) return undefined;
  return headers.get?.(name) ?? headers[name] ?? headers[name.toLowerCase()];
}

export async function createResumableDriveFile({
  authorizedRequest,
  requestBody,
  mediaType,
  bytes,
  fields = "id,name,mimeType,size,appProperties,parents,createdTime,modifiedTime",
  retryOptions
}) {
  if (typeof authorizedRequest !== "function") throw new Error("AUTHORIZED_REQUEST_REQUIRED");
  const payload = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return withDriveRetry(async () => {
    const start = await authorizedRequest({
      url: "https://www.googleapis.com/upload/drive/v3/files",
      method: "POST",
      params: { uploadType: "resumable", supportsAllDrives: true, fields },
      headers: {
        "content-type": "application/json; charset=UTF-8",
        "x-upload-content-type": mediaType,
        "x-upload-content-length": String(payload.length)
      },
      data: requestBody
    });
    const location = readHeader(start.headers, "location");
    if (!location) throw new Error("DRIVE_RESUMABLE_LOCATION_MISSING");
    const uploaded = await authorizedRequest({
      url: location,
      method: "PUT",
      headers: {
        "content-type": mediaType,
        "content-length": String(payload.length),
        "content-range": `bytes 0-${Math.max(0, payload.length - 1)}/${payload.length}`
      },
      data: payload
    });
    if (!uploaded?.data?.id) throw new Error("DRIVE_RESUMABLE_FILE_ID_MISSING");
    return uploaded.data;
  }, retryOptions);
}
