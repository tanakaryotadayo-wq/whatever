import * as driveModule from "@googleapis/drive";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

export async function createGoogleDriveClient({
  authClient,
  credentials,
  keyFile,
  scopes = [DRIVE_SCOPE]
} = {}) {
  const provider = authClient ?? new driveModule.auth.GoogleAuth({
    ...(credentials ? { credentials } : {}),
    ...(keyFile ? { keyFile } : {}),
    scopes
  });
  const authorizedClient = typeof provider.getClient === "function" ? await provider.getClient() : provider;
  return {
    authClient: authorizedClient,
    drive: driveModule.drive({ version: "v3", auth: authorizedClient })
  };
}
