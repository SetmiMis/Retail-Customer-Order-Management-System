import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guard';
import { staffActor } from '@/lib/oms/audit';
import { listAttachments, addAttachment } from '@/lib/oms/attachments';
import { uploadOmsFile, MAX_ATTACHMENT_BYTES, ALLOWED_ATTACHMENT_TYPES } from '@/lib/drive/upload';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireStaff();
  if (!g.ok) return g.response;
  const { id } = await params;
  return NextResponse.json({ ok: true, attachments: await listAttachments(id) });
}

/** multipart/form-data: file, kind, note */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireStaff();
  if (!g.ok) return g.response;
  const { id } = await params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, msg: 'Expected multipart/form-data.' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ ok: false, msg: 'No file.' }, { status: 400 });
  if (file.size > MAX_ATTACHMENT_BYTES) return NextResponse.json({ ok: false, msg: 'File is larger than 15 MB.' }, { status: 400 });
  if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
    return NextResponse.json({ ok: false, msg: 'Only images, PDF or text files are allowed.' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const safeName = `${id}-${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`.slice(0, 180);

  let uploaded;
  try {
    uploaded = await uploadOmsFile(buf, safeName, file.type);
  } catch (e) {
    return NextResponse.json({ ok: false, msg: e instanceof Error ? e.message : 'Upload failed.' }, { status: 500 });
  }

  const result = await addAttachment(staffActor(g.user), id, {
    kind: String(form.get('kind') || 'Other'),
    fileName: file.name,
    driveFileId: uploaded.id,
    driveUrl: uploaded.url,
    note: String(form.get('note') || ''),
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
