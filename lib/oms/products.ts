import { OMS_SHEETS, ID_PREFIX } from './constants';
import { readSheet, appendRow, setCells, nextId } from '../sheets/rows';
import { audit, staffActor } from './audit';
import type { Product, ServiceResult } from './types';
import type { StaffSession } from '../auth/session';

const T = OMS_SHEETS.PRODUCTS;
// ProductID,SKU,Name,Category,Subcategory,Description,Specifications,Unit,ImageUrl,AvailabilityNote,PfmsItemId,Status,CreatedAt,UpdatedAt
const C = {
  ID: 0, SKU: 1, NAME: 2, CAT: 3, SUBCAT: 4, DESC: 5, SPECS: 6, UNIT: 7,
  IMG: 8, AVAIL: 9, PFMS: 10, STATUS: 11, CREATED: 12, UPDATED: 13,
};

function toProduct(r: unknown[]): Product {
  return {
    productId: String(r[C.ID] ?? '').trim(),
    sku: String(r[C.SKU] ?? '').trim(),
    name: String(r[C.NAME] ?? '').trim(),
    category: String(r[C.CAT] ?? '').trim(),
    subcategory: String(r[C.SUBCAT] ?? '').trim(),
    description: String(r[C.DESC] ?? '').trim(),
    specifications: String(r[C.SPECS] ?? '').trim(),
    unit: String(r[C.UNIT] ?? '').trim() || 'Pcs',
    imageUrl: String(r[C.IMG] ?? '').trim(),
    availabilityNote: String(r[C.AVAIL] ?? '').trim(),
    pfmsItemId: String(r[C.PFMS] ?? '').trim(),
    status: String(r[C.STATUS] ?? '').trim() || 'Active',
  };
}

/** Active products only — what the customer catalog and order builder see. */
export async function listActiveProducts(): Promise<Product[]> {
  const { rows } = await readSheet(T);
  return rows.filter((r) => r[C.ID] && String(r[C.STATUS]).trim() !== 'Inactive').map(toProduct);
}

/** Every product (any status) — staff product management. */
export async function listAllProducts(): Promise<Product[]> {
  const { rows } = await readSheet(T);
  return rows.filter((r) => r[C.ID]).map(toProduct);
}

export async function searchCatalog(q: string): Promise<Product[]> {
  const term = String(q || '').trim().toLowerCase();
  const all = await listActiveProducts();
  if (!term) return all;
  return all.filter((p) =>
    [p.name, p.sku, p.category, p.subcategory, p.description].some((v) => v.toLowerCase().includes(term)),
  );
}

export async function getProduct(productId: string): Promise<Product | null> {
  const { rows } = await readSheet(T);
  const r = rows.find((x) => String(x[C.ID]).trim() === productId);
  return r ? toProduct(r) : null;
}

/** Resolve a batch of product IDs to product records (order-line hydration). */
export async function productsByIds(ids: string[]): Promise<Map<string, Product>> {
  const want = new Set(ids.map((s) => String(s).trim()));
  const { rows } = await readSheet(T);
  const m = new Map<string, Product>();
  for (const r of rows) {
    const id = String(r[C.ID] ?? '').trim();
    if (want.has(id)) m.set(id, toProduct(r));
  }
  return m;
}

export async function createProduct(
  actor: StaffSession,
  p: Partial<Omit<Product, 'productId' | 'status'>> & { name?: string },
): Promise<ServiceResult> {
  if (!p.name?.trim()) return { ok: false, msg: 'Product name is required.' };
  const { rows } = await readSheet(T);
  if (p.sku?.trim() && rows.some((r) => String(r[C.SKU]).trim().toLowerCase() === p.sku!.trim().toLowerCase())) {
    return { ok: false, msg: 'That SKU is already in use.' };
  }
  const id = nextId(ID_PREFIX.PRODUCT, rows, C.ID);
  const now = new Date();
  await appendRow(T, [
    id, String(p.sku || '').trim(), p.name.trim(), String(p.category || '').trim(), String(p.subcategory || '').trim(),
    String(p.description || '').trim(), String(p.specifications || '').trim(), String(p.unit || 'Pcs').trim(),
    String(p.imageUrl || '').trim(), String(p.availabilityNote || '').trim(), String(p.pfmsItemId || '').trim(),
    'Active', now, now,
  ]);
  await audit(staffActor(actor), 'CREATE_PRODUCT', 'Product', id, '', p.name, '');
  return { ok: true, msg: `${p.name} added.`, id };
}

export async function updateProduct(
  actor: StaffSession,
  productId: string,
  p: Partial<Omit<Product, 'productId'>>,
): Promise<ServiceResult> {
  const { rows } = await readSheet(T);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][C.ID]).trim() !== productId) continue;
    const row1 = i + 2;
    const cells: Array<{ row1Based: number; col1Based: number; value: unknown }> = [];
    const put = (col: number, v: unknown) => cells.push({ row1Based: row1, col1Based: col + 1, value: v });
    if (p.sku !== undefined) put(C.SKU, p.sku);
    if (p.name !== undefined) put(C.NAME, p.name);
    if (p.category !== undefined) put(C.CAT, p.category);
    if (p.subcategory !== undefined) put(C.SUBCAT, p.subcategory);
    if (p.description !== undefined) put(C.DESC, p.description);
    if (p.specifications !== undefined) put(C.SPECS, p.specifications);
    if (p.unit !== undefined) put(C.UNIT, p.unit || 'Pcs');
    if (p.imageUrl !== undefined) put(C.IMG, p.imageUrl);
    if (p.availabilityNote !== undefined) put(C.AVAIL, p.availabilityNote);
    if (p.pfmsItemId !== undefined) put(C.PFMS, p.pfmsItemId);
    if (p.status !== undefined) put(C.STATUS, p.status);
    if (!cells.length) return { ok: false, msg: 'Nothing to update.' };
    put(C.UPDATED, new Date());
    await setCells(T, cells);
    await audit(staffActor(actor), 'UPDATE_PRODUCT', 'Product', productId, '', JSON.stringify(p), '');
    return { ok: true, msg: 'Product saved.' };
  }
  return { ok: false, msg: 'Product not found.' };
}

/*****************************************************************
 * Read-only view of PFMS_Items — populates the "link to PFMS item"
 * picker used when mapping a product so shortages can raise a requirement.
 *****************************************************************/
export interface PfmsItemLite {
  itemId: string;
  sku: string;
  name: string;
  unit: string;
  category: string;
}

export async function listPfmsItems(): Promise<PfmsItemLite[]> {
  let rows: unknown[][] = [];
  try {
    ({ rows } = await readSheet('PFMS_Items'));
  } catch {
    return []; // PFMS not set up on this sheet yet
  }
  // PFMS_Items: ItemID,SKU,ItemName,Category,Unit,Status,SourceType,PreferredVendorId,PreferredVendorName,HSCode,OriginCountry
  return rows
    .filter((r) => r[0] && String(r[5]).trim() !== 'Inactive')
    .map((r) => ({
      itemId: String(r[0] ?? '').trim(),
      sku: String(r[1] ?? '').trim(),
      name: String(r[2] ?? '').trim(),
      category: String(r[3] ?? '').trim(),
      unit: String(r[4] ?? '').trim() || 'Pcs',
    }));
}
