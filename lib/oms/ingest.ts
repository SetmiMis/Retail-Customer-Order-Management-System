/*****************************************************************
 * Sales-CRM bridge — turns a confirmed Sales FMS enquiry into an OMS order.
 * The Sales FMS app (separate deploy) POSTs to /api/ingest/order with a shared
 * INGEST_TOKEN; this module upserts the customer, then runs the normal
 * createOrder() path as a synthetic "Sales CRM" staff actor so the order gets
 * the same state machine, history, audit and notifications as any staff order.
 *****************************************************************/
import { createOrder, type NewOrderItemInput } from './orders';
import { upsertBridgeCustomer } from './customers';
import type { ServiceResult } from './types';
import type { StaffSession } from '../auth/session';

const BRIDGE_STAFF: StaffSession = {
  kind: 'staff', userId: 'sales-crm', name: 'Sales CRM', username: 'sales-crm', email: '', role: 'SALES', status: 'Active',
};

export interface IngestOrderPayload {
  enqId: string;
  customer: { company?: string; contact?: string; phone?: string; whatsapp?: string; email?: string; gst?: string };
  items: NewOrderItemInput[];
  note?: string;
  quoteNo?: string;
  quoteAmount?: string | number;
}

export async function ingestOrder(
  p: IngestOrderPayload,
): Promise<ServiceResult & { orderId?: string; customerId?: string }> {
  const enqId = String(p.enqId || '').trim();
  if (!enqId) return { ok: false, msg: 'enqId is required.' };
  if (!p.customer?.phone && !p.customer?.email) {
    return { ok: false, msg: 'customer phone or email is required.' };
  }
  const items = (p.items || []).filter((it) => String(it.productId || '').trim() && Number(it.qty) > 0);
  if (!items.length) return { ok: false, msg: 'At least one product line with a quantity is required.' };

  const { customerId, created } = await upsertBridgeCustomer(p.customer);

  const remark = [
    `[Sales CRM · ${enqId}]`,
    p.quoteNo ? `Quote ${p.quoteNo}${p.quoteAmount ? ` ₹${p.quoteAmount}` : ''}` : '',
    String(p.note || '').trim(),
  ].filter(Boolean).join('  ');

  const res = await createOrder(
    { staff: BRIDGE_STAFF },
    { items, customerId, customerRemark: remark, source: 'Sales CRM' },
  );

  return { ...res, customerId, msg: res.ok ? `${res.msg}${created ? ' (new customer)' : ''}` : res.msg };
}
