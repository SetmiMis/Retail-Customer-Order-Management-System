import { NextResponse } from 'next/server';
import { checkIngestToken } from '@/lib/auth/ingestToken';
import { ingestOrder, type IngestOrderPayload } from '@/lib/oms/ingest';

// Sales-CRM bridge: Sales FMS POSTs a confirmed enquiry here to open an OMS order.
// Auth is the shared INGEST_TOKEN (Bearer), not a staff cookie.
export async function POST(req: Request) {
  if (!checkIngestToken(req)) {
    return NextResponse.json({ ok: false, msg: 'Unauthorized.' }, { status: 401 });
  }

  let body: IngestOrderPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, msg: 'Invalid JSON body.' }, { status: 400 });
  }

  try {
    const res = await ingestOrder(body);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err) {
    console.error('POST /api/ingest/order failed:', err);
    return NextResponse.json({ ok: false, msg: 'Order ingest failed.' }, { status: 500 });
  }
}
