import { Readable } from 'node:stream';
import { driveApi } from '../sheets/client';

/**
 * Uploads a file to the fixed Shared Drive folder in DRIVE_OMS_FOLDER_ID and
 * returns its id + view link. A service account can't own files in a personal
 * My Drive, so a Shared Drive folder is required (same constraint as web/).
 * Files are shared "anyone with the link — reader" to match the CRM's behaviour.
 */
export async function uploadOmsFile(buffer: Buffer, filename: string, mimeType: string): Promise<{ id: string; url: string }> {
  const folderId = process.env.DRIVE_OMS_FOLDER_ID;
  if (!folderId) {
    throw new Error('Missing DRIVE_OMS_FOLDER_ID env var — set it to the Shared Drive folder ID for order attachments.');
  }
  const drive = driveApi();
  const { data: file } = await drive.files.create({
    requestBody: { name: filename, parents: [folderId], mimeType },
    media: { mimeType, body: Readable.from(buffer) },
    supportsAllDrives: true,
    fields: 'id, webViewLink',
  });
  if (!file.id) throw new Error('Drive upload did not return a file id.');
  await drive.permissions.create({
    fileId: file.id,
    supportsAllDrives: true,
    requestBody: { role: 'reader', type: 'anyone' },
  });
  return { id: file.id, url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view` };
}

export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // 15 MB
export const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf', 'text/plain',
]);
