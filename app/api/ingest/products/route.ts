import { NextResponse } from 'next/server';
import { checkIngestToken } from '@/lib/auth/ingestToken';
import { listActiveProducts } from '@/lib/oms/products';

// Sales-CRM bridge: lets the Sales FMS "Confirm Order → OMS" form build real line items
// against the OMS catalogue. Auth is the shared INGEST_TOKEN (Bearer).
export async function GET(req: Request) {
  if (!checkIngestToken(req)) {
    return NextResponse.json({ ok: false, msg: 'Unauthorized.' }, { status: 401 });
  }
  try {
    const products = await listActiveProducts();
    return NextResponse.json({
      ok: true,
      products: products.map((p) => ({
        productId: p.productId, sku: p.sku, name: p.name, unit: p.unit, category: p.category,
      })),
    });
  } catch (err) {
    console.error('GET /api/ingest/products failed:', err);
    return NextResponse.json({ ok: false, msg: 'Failed to load catalogue.' }, { status: 500 });
  }
}
