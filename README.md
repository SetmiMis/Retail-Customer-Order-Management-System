# Retail Customer Order Management System (OMS)

Customer ordering portal **+** internal order-operations console for SETMI INDIA.
Next.js 16 / React 19 / Tailwind v4, deployed on **Vercel**, backed by the shared
**Google Sheet** (same spreadsheet as the Sales CRM and Purchase FMS).

## Core principle

**There is no rate / price / amount anywhere.** Customers place orders with
products + quantities only; the team confirms the rate personally over
phone/WhatsApp/email. This system manages the *order lifecycle*, not pricing.

```
Customer login → create order → Order Received → Customer Confirmation
→ Quantity Check → (shortfall → Requirement raised in Purchase FMS)
→ Ready for Packing → Packing → Final Verification → Dispatch → Completed
```

## Two portals

| Area | Path | Auth |
| --- | --- | --- |
| Customer portal | `/portal/**` | email + password (`oms_cust` cookie) |
| Staff / operations | `/staff/**` | username + password, 5 roles: ADMIN, MANAGER, SALES, WAREHOUSE, DISPATCH (`oms_staff` cookie) |

## Data

OMS owns every `OMS_*` tab in the spreadsheet. It reads its own `OMS_Products`
catalogue and **only appends** to `PFMS_Requirements` / `PFMS_RequirementItems` /
`PFMS_Approvals` when a confirmed order is short on stock — the two-way link is
kept in `OMS_OrderRequirementLinks`. Schema + the order state machine live in
[`lib/oms/constants.ts`](lib/oms/constants.ts).

Bootstrap the tabs: sign in as ADMIN and `POST /api/staff/admin/ensure-sheets`,
or run `npm run ensure-sheets` locally.

## Local dev

```bash
cp .env.example .env.local   # fill in GOOGLE_SHEET_ID, GCP_*, SESSION_SECRET, PFMS_BOT_USER_ID
npm install
npm run dev
```

## Deploy (Vercel)

New Vercel project → **Root Directory = repo root** → add every var from
`.env.example` → share the Google Sheet with `GCP_SERVICE_ACCOUNT_EMAIL` as Editor.
No service-account key file — auth is Workload Identity Federation via Vercel OIDC.

## Visual system

Brand-matched to **setmiindia.com**: deep teal-blue `#005a84` primary, sky-cyan
`#6EC1E4`, amber `#FF8F00` for CTAs; semantic status hues (amber = pending,
blue = processing, red = issue, green = success). Type: **Lato** headings +
**Inter** body. Light is the default; dark is a toggle. Heavy effects — R3F 3D
hero, tsParticles, Lenis smooth-scroll, Motion transitions + confetti — are
lazy-loaded on hero surfaces only and disable under `prefers-reduced-motion`.
