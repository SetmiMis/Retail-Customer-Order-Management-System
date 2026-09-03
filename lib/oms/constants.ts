/*****************************************************************
 * OMS — Retail Customer Order Management System
 * Schema + workflow constants. This file is the single source of truth for
 * on-sheet column order: HEADERS[tab] is the literal column order OMS writes.
 *
 * Data store is the shared SETMI spreadsheet. OMS owns every OMS_* tab.
 * It reads OMS_Products (its own catalog) and only APPENDS to the three
 * PFMS_* tabs listed under PFMS_BRIDGE — never updating or reordering them.
 *****************************************************************/

export const OMS_SHEETS = {
  STAFF: 'OMS_Users',
  CUSTOMERS: 'OMS_Customers',
  ADDRESSES: 'OMS_CustomerAddresses',
  PRODUCTS: 'OMS_Products',
  ORDERS: 'OMS_Orders',
  ORDER_ITEMS: 'OMS_OrderItems',
  STATUS_HISTORY: 'OMS_OrderStatusHistory',
  ATTACHMENTS: 'OMS_OrderAttachments',
  QTY_CHECKS: 'OMS_QuantityChecks',
  REQ_LINKS: 'OMS_OrderRequirementLinks',
  PACKING: 'OMS_Packing',
  VERIFICATION: 'OMS_FinalVerification',
  DISPATCHES: 'OMS_Dispatches',
  NOTIFICATIONS: 'OMS_Notifications',
  AUDIT: 'OMS_AuditLog',
} as const;
export type OmsSheet = (typeof OMS_SHEETS)[keyof typeof OMS_SHEETS];

/*****************************************************************
 * Roles — internal staff. Customers are NOT in OMS_Users; they live in
 * OMS_Customers and carry an implicit "CUSTOMER" role in the session.
 *****************************************************************/
export const OMS_ROLES = ['ADMIN', 'MANAGER', 'SALES', 'WAREHOUSE', 'DISPATCH'] as const;
export type OmsRole = (typeof OMS_ROLES)[number];

export const ROLE_ANY_STAFF: OmsRole[] = ['ADMIN', 'MANAGER', 'SALES', 'WAREHOUSE', 'DISPATCH'];
export const ROLE_ORDER_ENTRY: OmsRole[] = ['ADMIN', 'MANAGER', 'SALES'];
export const ROLE_CONFIRM: OmsRole[] = ['ADMIN', 'MANAGER', 'SALES'];
export const ROLE_WAREHOUSE: OmsRole[] = ['ADMIN', 'MANAGER', 'WAREHOUSE'];
export const ROLE_DISPATCH: OmsRole[] = ['ADMIN', 'MANAGER', 'DISPATCH'];
export const ROLE_MANAGE: OmsRole[] = ['ADMIN', 'MANAGER'];
export const ROLE_ADMIN: OmsRole[] = ['ADMIN'];

/*****************************************************************
 * Order sources — lets the business move customers onto the portal
 * gradually without breaking phone / WhatsApp / email intake.
 *****************************************************************/
export const ORDER_SOURCES = ['Customer Portal', 'Phone Call', 'WhatsApp', 'Email', 'Walk-in', 'Other'] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export const ATTACHMENT_KINDS = ['WhatsApp Screenshot', 'Email', 'PDF', 'Image', 'Call Note', 'Dispatch Document', 'Other'] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

/*****************************************************************
 * Order status lifecycle (state machine). Transitions are enforced in
 * lib/oms/orders.ts against ORDER_TRANSITIONS + a role gate — no arbitrary
 * status writes.
 *****************************************************************/
export const ORDER_STATUS = {
  DRAFT: 'Draft',                          // portal cart not yet submitted / re-order draft
  RECEIVED: 'Order Received',
  CONFIRM_PENDING: 'Customer Confirmation Pending',
  CONFIRMED: 'Customer Confirmed',
  QTY_CHECK: 'Quantity Check',
  REQUIREMENT_PENDING: 'Requirement Pending',
  PARTIAL_AVAILABLE: 'Partially Available',
  READY_FOR_PACKING: 'Ready for Packing',
  PACKING: 'Packing',
  FINAL_VERIFICATION: 'Final Verification',
  READY_FOR_DISPATCH: 'Ready for Dispatch',
  DISPATCHED: 'Dispatched',
  COMPLETED: 'Completed',
  ON_HOLD: 'On Hold',
  CANCELLED: 'Cancelled',
} as const;
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

const S = ORDER_STATUS;

/** Allowed next-states for each status. ON_HOLD / CANCELLED handled separately (see ORDER_SIDE_STATES). */
export const ORDER_TRANSITIONS: Record<string, OrderStatus[]> = {
  [S.DRAFT]: [S.RECEIVED],
  [S.RECEIVED]: [S.CONFIRM_PENDING],
  [S.CONFIRM_PENDING]: [S.CONFIRMED, S.CANCELLED],
  [S.CONFIRMED]: [S.QTY_CHECK],
  [S.QTY_CHECK]: [S.READY_FOR_PACKING, S.REQUIREMENT_PENDING, S.PARTIAL_AVAILABLE],
  [S.REQUIREMENT_PENDING]: [S.PARTIAL_AVAILABLE, S.READY_FOR_PACKING, S.QTY_CHECK],
  [S.PARTIAL_AVAILABLE]: [S.READY_FOR_PACKING, S.REQUIREMENT_PENDING],
  [S.READY_FOR_PACKING]: [S.PACKING],
  [S.PACKING]: [S.FINAL_VERIFICATION, S.READY_FOR_PACKING],
  [S.FINAL_VERIFICATION]: [S.READY_FOR_DISPATCH, S.PACKING],
  [S.READY_FOR_DISPATCH]: [S.DISPATCHED],
  [S.DISPATCHED]: [S.COMPLETED],
  [S.COMPLETED]: [],
  [S.ON_HOLD]: [],       // resume target is restored from OMS_OrderStatusHistory
  [S.CANCELLED]: [],
};

/** From any of these an order may be put ON_HOLD (manager) or CANCELLED (manager/sales). */
export const HOLDABLE_STATUSES: OrderStatus[] = [
  S.RECEIVED, S.CONFIRM_PENDING, S.CONFIRMED, S.QTY_CHECK,
  S.REQUIREMENT_PENDING, S.PARTIAL_AVAILABLE, S.READY_FOR_PACKING, S.PACKING,
  S.FINAL_VERIFICATION, S.READY_FOR_DISPATCH,
];
export const CANCELLABLE_STATUSES: OrderStatus[] = [...HOLDABLE_STATUSES, S.DRAFT, S.ON_HOLD];

/** Which role owns the action that moves an order OUT of a given status. Used for
 *  the Needs-Attention centre and to gate transition endpoints. */
export const STATUS_OWNER_ROLE: Record<string, OmsRole[]> = {
  [S.RECEIVED]: ROLE_ORDER_ENTRY,
  [S.CONFIRM_PENDING]: ROLE_CONFIRM,
  [S.CONFIRMED]: ROLE_WAREHOUSE,
  [S.QTY_CHECK]: ROLE_WAREHOUSE,
  [S.REQUIREMENT_PENDING]: ROLE_MANAGE,
  [S.PARTIAL_AVAILABLE]: ROLE_MANAGE,
  [S.READY_FOR_PACKING]: ROLE_WAREHOUSE,
  [S.PACKING]: ROLE_WAREHOUSE,
  [S.FINAL_VERIFICATION]: ROLE_WAREHOUSE,
  [S.READY_FOR_DISPATCH]: ROLE_DISPATCH,
  [S.DISPATCHED]: ROLE_DISPATCH,
};

/** Collapsed status shown to the customer (never exposes requirement / stock detail).
 *  The 6 step labels live in the tracking page; this maps a raw status onto one. */
export function customerFacingStep(status: string): { label: string; index: number } {
  switch (status) {
    case S.DRAFT:
    case S.RECEIVED: return { label: 'Order Received', index: 0 };
    case S.CONFIRM_PENDING: return { label: 'Order Received', index: 0 };
    case S.CONFIRMED:
    case S.QTY_CHECK: return { label: 'Order Confirmed', index: 1 };
    case S.REQUIREMENT_PENDING:
    case S.PARTIAL_AVAILABLE:
    case S.READY_FOR_PACKING: return { label: 'Preparing', index: 2 };
    case S.PACKING:
    case S.FINAL_VERIFICATION:
    case S.READY_FOR_DISPATCH: return { label: 'Packing', index: 3 };
    case S.DISPATCHED: return { label: 'Dispatched', index: 4 };
    case S.COMPLETED: return { label: 'Completed', index: 5 };
    case S.ON_HOLD: return { label: 'Order Confirmed', index: 1 };
    case S.CANCELLED: return { label: 'Cancelled', index: -1 };
    default: return { label: 'Order Received', index: 0 };
  }
}

export const CONFIRM_STATUS = { PENDING: 'Pending', CONFIRMED: 'Confirmed', CANCELLED: 'Cancelled' } as const;

/** Per-line fulfilment state on OMS_OrderItems. Original OrderedQty is never overwritten. */
export const LINE_STATUS = {
  PENDING: 'Pending',        // not yet checked
  AVAILABLE: 'Available',    // checked, enough on hand
  SHORT: 'Short',            // checked, less than ordered, no requirement raised yet
  REQUIREMENT: 'Requirement',// shortfall handed to PFMS
  READY: 'Ready',            // full ordered qty now available
  PACKED: 'Packed',
  DISPATCHED: 'Dispatched',
} as const;
export type LineStatus = (typeof LINE_STATUS)[keyof typeof LINE_STATUS];

export const PARTIAL_POLICY = { WAIT: 'Wait for complete order', ALLOW: 'Allow partial dispatch' } as const;

/** Final-verification checklist keys (one OMS_FinalVerification row each). */
export const VERIFICATION_CHECKS = [
  'Correct Customer',
  'Correct Order',
  'Correct Products',
  'Correct Quantity',
  'Packing Complete',
  'Required Documents',
  'Delivery Details',
] as const;

export const NOTIFICATION_TYPES = {
  ORDER_RECEIVED: 'Order Received',
  CUSTOMER_CONFIRMED: 'Customer Confirmed',
  QUANTITY_SHORT: 'Quantity Short',
  REQUIREMENT_CREATED: 'Requirement Created',
  REQUIREMENT_COMPLETED: 'Requirement Completed',
  READY_FOR_PACKING: 'Ready for Packing',
  READY_FOR_DISPATCH: 'Ready for Dispatch',
  ORDER_DISPATCHED: 'Order Dispatched',
  ORDER_COMPLETED: 'Order Completed',
} as const;

/*****************************************************************
 * On-sheet header rows. ORDER MATTERS — scripts/ensure-sheets.ts writes
 * these verbatim and every service reads by this column order.
 *****************************************************************/
export const HEADERS = {
  [OMS_SHEETS.STAFF]: [
    'UserID', 'Name', 'Email', 'Username', 'PassHash', 'Role', 'Status', 'CreatedAt', 'Phone',
  ],
  [OMS_SHEETS.CUSTOMERS]: [
    'CustomerID', 'CompanyName', 'ContactName', 'Phone', 'WhatsApp', 'Email', 'EmailLower',
    'PassHash', 'GST', 'Status', 'CreatedAt', 'CreatedBy', 'LastLoginAt',
  ],
  [OMS_SHEETS.ADDRESSES]: [
    'AddressID', 'CustomerID', 'Label', 'Line1', 'Line2', 'City', 'District', 'State', 'Pincode',
    'ContactName', 'ContactPhone', 'IsDefault', 'Active', 'CreatedAt',
  ],
  [OMS_SHEETS.PRODUCTS]: [
    'ProductID', 'SKU', 'Name', 'Category', 'Subcategory', 'Description', 'Specifications',
    'Unit', 'ImageUrl', 'AvailabilityNote', 'PfmsItemId', 'Status', 'CreatedAt', 'UpdatedAt',
  ],
  [OMS_SHEETS.ORDERS]: [
    'OrderID', 'CustomerID', 'CustomerName', 'Source', 'CreatedByType', 'CreatedByID', 'CreatedByName',
    'CreatedAt', 'Status', 'ConfirmStatus', 'ConfirmedBy', 'ConfirmedAt', 'ConfirmNote',
    'CustomerRemark', 'DeliveryAddressID', 'DeliverySnapshot', 'PartialPolicy',
    'HoldReason', 'ResumeStatus', 'CancelReason', 'CancelledBy', 'CancelledAt',
    'AssignedStaff', 'UpdatedAt',
  ],
  [OMS_SHEETS.ORDER_ITEMS]: [
    'OrderID', 'LineNo', 'ProductID', 'ProductName', 'SKU', 'Unit',
    'OrderedQty', 'CheckedQty', 'AvailableQty', 'ShortQty',
    'PackedQty', 'DispatchedQty', 'LineStatus', 'Remarks',
  ],
  [OMS_SHEETS.STATUS_HISTORY]: [
    'HistID', 'OrderID', 'FromStatus', 'ToStatus', 'ByType', 'ByID', 'ByName', 'At', 'Note',
  ],
  [OMS_SHEETS.ATTACHMENTS]: [
    'AttID', 'OrderID', 'Kind', 'FileName', 'DriveFileId', 'DriveUrl', 'Note', 'UploadedByType', 'UploadedByName', 'UploadedAt',
  ],
  [OMS_SHEETS.QTY_CHECKS]: [
    'CheckID', 'OrderID', 'LineNo', 'ProductID', 'OrderedQty', 'CheckedQty', 'AvailableQty', 'ShortQty',
    'LineStatus', 'CheckedByID', 'CheckedByName', 'CheckedAt', 'Remarks',
  ],
  [OMS_SHEETS.REQ_LINKS]: [
    'LinkID', 'OrderID', 'OrderLineNo', 'ProductID', 'PfmsItemId', 'RequiredQty',
    'RequirementID', 'ReqLineNo', 'MirroredStatus', 'Satisfied',
    'CreatedByID', 'CreatedByName', 'CreatedAt', 'ClosedAt',
  ],
  [OMS_SHEETS.PACKING]: [
    'PackID', 'OrderID', 'LineNo', 'ProductID', 'ProductName', 'ExpectedQty', 'PackedQty', 'Verified',
    'PackedByID', 'PackedByName', 'PackedAt', 'Remarks',
  ],
  [OMS_SHEETS.VERIFICATION]: [
    'VerID', 'OrderID', 'CheckKey', 'Passed', 'VerifiedByID', 'VerifiedByName', 'VerifiedAt', 'Note',
  ],
  [OMS_SHEETS.DISPATCHES]: [
    'DispatchID', 'OrderID', 'DispatchDate', 'Transporter', 'AwbLrNo', 'VehicleNo',
    'Remarks', 'DocDriveUrl', 'DispatchedByID', 'DispatchedByName', 'DispatchedAt',
  ],
  [OMS_SHEETS.NOTIFICATIONS]: [
    'NotifID', 'Audience', 'CustomerID', 'StaffRole', 'OrderID', 'Type', 'Message', 'Read', 'CreatedAt',
  ],
  [OMS_SHEETS.AUDIT]: [
    'Timestamp', 'ActorType', 'ActorID', 'ActorName', 'Role', 'Action', 'Entity', 'EntityID', 'OldValue', 'NewValue', 'Details',
  ],
} as const;

/*****************************************************************
 * PFMS bridge — the ONLY PFMS knowledge OMS needs. Column order copied
 * verbatim from purchase-fms/lib/pfms/constants.ts HEADERS. OMS append-writes
 * these three tabs when raising a customer-order requirement; it read-polls
 * PFMS_Requirements.Status to reflect progress back onto the order.
 * Keep in lockstep with purchase-fms if that schema ever changes.
 *****************************************************************/
export const PFMS_BRIDGE = {
  REQ: 'PFMS_Requirements',
  REQ_ITEMS: 'PFMS_RequirementItems',
  APPROVALS: 'PFMS_Approvals',
  HEADERS: {
    PFMS_Requirements: ['RequirementID', 'Date', 'RequiredByDate', 'RequesterUserID', 'RequesterName', 'Department', 'Purpose', 'Status', 'CreatedAt', 'UpdatedAt'],
    PFMS_RequirementItems: ['RequirementID', 'LineNo', 'ItemID', 'ItemName', 'Unit', 'RequestedQty', 'AccountantQty', 'OwnerApprovedQty', 'Remarks'],
    PFMS_Approvals: ['ApprovalID', 'RequirementID', 'Action', 'UserID', 'UserName', 'Role', 'Quantity', 'Remarks', 'Timestamp'],
  },
  SUBMITTED_STATUS: 'Submitted',
  /** PFMS statuses that mean "the shortfall is now in stock" — flips the OMS link to Satisfied. */
  DONE_STATUSES: new Set(['Fully Received', 'Closed']),
} as const;

/*****************************************************************
 * ID prefixes. NOTE: PFMS purchase orders already use "ORD-" — customer
 * sales orders MUST NOT. Sales orders are SO-YYYY-NNNNNN.
 *****************************************************************/
export const ID_PREFIX = {
  CUSTOMER: 'CUST-',
  STAFF: 'USR-',
  ADDRESS: 'ADR-',
  PRODUCT: 'PRD-',
  ORDER: 'SO-',           // SO-2026-000123 (year segment injected by nextOrderId)
  HISTORY: 'OSH-',
  ATTACHMENT: 'ATT-',
  QTY_CHECK: 'QC-',
  REQ_LINK: 'ORL-',
  PACK: 'PK-',
  VERIFICATION: 'FV-',
  DISPATCH: 'DSP-',
  NOTIFICATION: 'NTF-',
} as const;

export const STAFF_SESSION_COOKIE = 'oms_staff';
export const CUSTOMER_SESSION_COOKIE = 'oms_cust';
export const AUTH_TTL_SECONDS = 21600; // 6h sliding session (matches web/ + purchase-fms)
