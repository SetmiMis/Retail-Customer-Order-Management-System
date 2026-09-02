import { OMS_SHEETS, ID_PREFIX, ATTACHMENT_KINDS } from './constants';
import { readSheet, appendRow, nextId } from '../sheets/rows';
import { audit, type Actor } from './audit';
import type { OrderAttachment, ServiceResult } from './types';

const T = OMS_SHEETS.ATTACHMENTS;
// AttID,OrderID,Kind,FileName,DriveFileId,DriveUrl,Note,UploadedByType,UploadedByName,UploadedAt
const C = { ID: 0, ORDER: 1, KIND: 2, NAME: 3, FID: 4, URL: 5, NOTE: 6, BYTYPE: 7, BYNAME: 8, AT: 9 };

export async function listAttachments(orderId: string): Promise<OrderAttachment[]> {
  const { rows } = await readSheet(T);
  return rows
    .filter((r) => r[C.ID] && String(r[C.ORDER]).trim() === orderId)
    .map((r) => ({
      attId: String(r[C.ID] ?? '').trim(),
      orderId: String(r[C.ORDER] ?? '').trim(),
      kind: String(r[C.KIND] ?? '').trim(),
      fileName: String(r[C.NAME] ?? '').trim(),
      driveUrl: String(r[C.URL] ?? '').trim(),
      note: String(r[C.NOTE] ?? '').trim(),
      uploadedByName: String(r[C.BYNAME] ?? '').trim(),
      uploadedAt: String(r[C.AT] ?? '').trim(),
    }));
}

export async function addAttachment(
  actor: Actor,
  orderId: string,
  p: { kind?: string; fileName: string; driveFileId: string; driveUrl: string; note?: string },
): Promise<ServiceResult & { attId?: string }> {
  const kind = (ATTACHMENT_KINDS as readonly string[]).includes(p.kind ?? '') ? p.kind! : 'Other';
  const { rows } = await readSheet(T);
  const id = nextId(ID_PREFIX.ATTACHMENT, rows, C.ID);
  await appendRow(T, [
    id, orderId, kind, p.fileName, p.driveFileId, p.driveUrl, String(p.note || '').trim(),
    actor.type, actor.name, new Date(),
  ]);
  await audit(actor, 'ADD_ATTACHMENT', 'Order', orderId, '', p.fileName, kind);
  return { ok: true, msg: 'Attachment added.', attId: id };
}
