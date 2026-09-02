import type { OmsRole, OrderSource, OrderStatus, LineStatus } from './constants';

/** Uniform result shape for every service mutation. */
export interface ServiceResult {
  ok: boolean;
  msg?: string;
  code?: string;
  [k: string]: unknown;
}

export interface StaffUser {
  userId: string;
  name: string;
  email: string;
  username: string;
  role: OmsRole;
  status: string;
  createdAt?: string;
  phone?: string;
}

export interface Customer {
  customerId: string;
  companyName: string;
  contactName: string;
  phone: string;
  whatsapp: string;
  email: string;
  gst: string;
  status: string;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface CustomerAddress {
  addressId: string;
  customerId: string;
  label: string;
  line1: string;
  line2: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  contactName: string;
  contactPhone: string;
  isDefault: boolean;
  active: boolean;
}

export interface Product {
  productId: string;
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  specifications: string;
  unit: string;
  imageUrl: string;
  availabilityNote: string;
  pfmsItemId: string;
  status: string;
}

export interface OrderItem {
  rowNo: number;         // 1-based sheet row (header = 1) — for in-place edits
  lineNo: number;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  orderedQty: number;    // never overwritten after submit
  checkedQty: number | null;
  availableQty: number | null;
  shortQty: number;
  packedQty: number;
  dispatchedQty: number;
  lineStatus: LineStatus | string;
  remarks: string;
}

export interface OrderRequirementLink {
  linkId: string;
  orderId: string;
  orderLineNo: number;
  productId: string;
  pfmsItemId: string;
  requiredQty: number;
  requirementId: string;
  reqLineNo: number;
  mirroredStatus: string;
  satisfied: boolean;
  createdAt: string;
  closedAt: string;
}

export interface OrderStatusEvent {
  fromStatus: string;
  toStatus: string;
  byType: string;
  byName: string;
  at: string;
  note: string;
}

export interface OrderAttachment {
  attId: string;
  orderId: string;
  kind: string;
  fileName: string;
  driveUrl: string;
  note: string;
  uploadedByName: string;
  uploadedAt: string;
}

export interface Order {
  orderId: string;
  customerId: string;
  customerName: string;
  source: OrderSource | string;
  createdByType: string;
  createdByName: string;
  createdAt: string;
  status: OrderStatus | string;
  confirmStatus: string;
  confirmedBy: string;
  confirmedAt: string;
  confirmNote: string;
  customerRemark: string;
  deliveryAddressId: string;
  deliverySnapshot: string;
  partialPolicy: string;
  holdReason: string;
  resumeStatus: string;
  cancelReason: string;
  assignedStaff: string;
  updatedAt: string;
  items?: OrderItem[];
  timeline?: OrderStatusEvent[];
  requirements?: OrderRequirementLink[];
  attachments?: OrderAttachment[];
}

/** Trimmed order the customer portal is allowed to see. */
export interface CustomerOrderView {
  orderId: string;
  createdAt: string;
  status: string;
  stepLabel: string;
  stepIndex: number;
  itemCount: number;
  customerRemark: string;
  deliverySnapshot: string;
  items: Array<{ productName: string; unit: string; orderedQty: number }>;
  arrangingItems: boolean; // "some items are being arranged" — no numbers, no reason
}
