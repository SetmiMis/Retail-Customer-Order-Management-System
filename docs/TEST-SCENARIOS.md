# Test scenarios

Walk-through for the 8 required scenarios (master spec §57). Assumes:

1. `.env.local` filled with a real `GOOGLE_SHEET_ID`, `GCP_*`, `SESSION_SECRET`,
   and `PFMS_BOT_USER_ID` (the `UserID` of a `PFMS_Users` row named e.g. "OMS Bot",
   role `REQUIREMENT_USER`, status `Active`).
2. `npm run ensure-sheets` — creates every `OMS_*` tab. Seeds one admin
   (`admin` / `Admin@123`).
3. `npm run seed-demo` — adds staff `manager` / `sales` / `warehouse` /
   `dispatch` and customers `abc@example.com` / `delhi@example.com`
   (all passwords `Demo@1234`), plus 4 demo products (HDMI Cable is left
   **unmapped** to PFMS on purpose, for scenario 6-b).

Sign in at `/staff/login` (staff) and `/portal/login` (customers).

---

## Scenario 1 — fully available order

1. Portal (`abc@example.com`) → Catalogue → add **3 Pin Connector ×50** → Review → Submit.
2. Staff `sales` → Confirmation queue → **Confirmed** (note "confirmed on call").
3. Staff `warehouse` → Quantity check → open the order → Checked 50 / Available 50 → **Save**.
   → order auto-moves to **Ready for Packing**.
4. `warehouse` → Packing → Start → packed 50, tick Verified → **Save** → **Final Verification**.
5. `warehouse` → Final verification → tick all 7 → **Verify** → **Ready for Dispatch**.
6. `dispatch` → Dispatch → transporter "Delhi Cargo", LR 123 → **Mark dispatched** → **Mark completed**.

**Expect:** `Order Received → Confirmed → Quantity Check → Packing → Dispatch → Completed`.
Portal order page shows every step ticked; customer got dispatched + completed notifications.

## Scenario 2 — one item unavailable → requirement

1. Portal order: **5 Pin Connector ×20**. Staff confirm.
2. `warehouse` quantity check: Checked 0 / Available 0 → **Save** → line = Short, order = Quantity Check.
3. Tick the short line → **Raise requirement for selected short line(s)**.
   → a `PFMS_Requirements` row appears at status **Submitted** (requester = OMS Bot),
   `OMS_OrderRequirementLinks` gets a row, order → **Requirement Pending**.
4. In **Purchase FMS**, take that requirement through review → owner approval →
   order prep → receiving until it is **Fully Received / Closed**.
5. Back in OMS: Requirements page → **Refresh from Purchase FMS** (or just reload —
   the requirements route auto-reflects). Link flips to **Satisfied**, the order line
   restores to Available = Ordered, order auto-advances to **Ready for Packing**.
6. Continue packing → dispatch as in scenario 1.

## Scenario 3 — partial availability

1. Portal order: 3 Pin ×100.
2. `warehouse` check: Checked 60 / Available 60 → Save → Short 40, line = Short.
3. Raise requirement for the short line → order = Requirement Pending, `RequiredQty` on
   the link = **40**. Ordered qty on the line is still **100** (never overwritten).
4. Manager may toggle the order's policy to **Allow partial dispatch** on the order-detail
   action bar; the 60 can then be packed/dispatched while 40 waits on the requirement.

## Scenario 4 — quantity mismatch

1. Portal order: 3 Pin ×50. Confirm.
2. `warehouse` check: Checked **40** / Available 40 → Save.
   **Expect:** Short = **10**, line status **Short**, order stays in Quantity Check with a
   "quantity short" internal notification to managers. Ordered still shows 50.

## Scenario 5 — customer A cannot see customer B's order

1. As `abc@example.com`, note one of your order ids, then open
   `/portal/orders/<an order id that belongs to delhi@example.com>`.
   **Expect:** "Order not found" (the API returns 404 — `getCustomerOrder` filters by
   `customerId`). Same via `GET /api/portal/orders/<id>`.

## Scenario 6 — customer cannot reach internal requirement data

1. As a customer, call `GET /api/staff/requirements` / `/api/staff/orders/<id>`.
   **Expect:** 401 (proxy blocks `/api/staff/**` without a staff cookie).
2. Portal order detail for an order in **Requirement Pending** shows only
   *"Some items are currently being arranged…"* — no `REQ-` id, no PFMS status, no stock number.
3. **6-b (unmapped product):** order the **HDMI Cable** and mark it short, then try to raise a
   requirement. **Expect:** the action is refused with *"…not linked to a PFMS item yet…"* —
   an admin must map it under **Products** first.

## Scenario 7 — staff edits after confirmation

1. Take an order to **Confirmed**.
2. Only `warehouse`/`manager` can run the quantity check; `sales` gets a 403 from
   `POST /api/staff/orders/<id>/quantity-check`.
3. Every check writes `OMS_QuantityChecks` rows and an `OMS_AuditLog` entry; the order
   timeline (`OMS_OrderStatusHistory`) records each state change with who + when.
   The original `OrderedQty` column is never written after submit.

## Scenario 8 — requirement completion reflects onto the order

Covered by scenario 2 steps 4-5: once the linked `PFMS_Requirements.Status` is
`Fully Received` or `Closed`, `reflectRequirementStatus()` marks the link Satisfied,
sets the order line back to `Ready` (Available = Ordered, Short = 0), and — when every
line is Ready — moves the order to **Ready for Packing** with a warehouse notification.
If only some links are satisfied the order sits at **Partially Available**.

---

### RBAC quick matrix

| Action | ADMIN | MANAGER | SALES | WAREHOUSE | DISPATCH |
| --- | :-: | :-: | :-: | :-: | :-: |
| Create order on behalf | ✅ | ✅ | ✅ | | |
| Customer confirmation | ✅ | ✅ | ✅ | | |
| Quantity check / raise requirement | ✅ | ✅ | | ✅ | |
| Packing / final verification | ✅ | ✅ | | ✅ | |
| Dispatch / complete | ✅ | ✅ | | | ✅ |
| Hold / resume / cancel / assign / policy | ✅ | ✅ | | | |
| Products / customers | ✅ | ✅ | | | |
| Users | ✅ | | | | |
| Reports / audit | ✅ | ✅ | | | |
