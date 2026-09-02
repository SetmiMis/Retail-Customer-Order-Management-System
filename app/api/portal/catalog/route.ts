import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/auth/guard';
import { searchCatalog } from '@/lib/oms/products';

/** Customer-safe catalogue. Never exposes pfmsItemId / internal status / any price. */
export async function GET(req: Request) {
  const g = await requireCustomer();
  if (!g.ok) return g.response;
  const q = new URL(req.url).searchParams.get('q') || '';
  const products = await searchCatalog(q);
  return NextResponse.json({
    ok: true,
    products: products.map((p) => ({
      productId: p.productId,
      sku: p.sku,
      name: p.name,
      category: p.category,
      subcategory: p.subcategory,
      description: p.description,
      specifications: p.specifications,
      unit: p.unit,
      imageUrl: p.imageUrl,
      availabilityNote: p.availabilityNote,
    })),
  });
}
