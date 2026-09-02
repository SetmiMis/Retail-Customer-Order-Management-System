import { NextResponse } from 'next/server';
import { getStaff, getCustomer } from '@/lib/auth/guard';

/** Lightweight "who am I" for client shells. Public path (no proxy gate). */
export async function GET() {
  const [staff, customer] = await Promise.all([getStaff(), getCustomer()]);
  return NextResponse.json({
    ok: true,
    staff: staff ? { name: staff.name, role: staff.role, userId: staff.userId } : null,
    customer: customer ? { companyName: customer.companyName, contactName: customer.contactName, customerId: customer.customerId } : null,
  });
}
