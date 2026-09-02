# Deploy / bootstrap

## What's provisioned

- **GCP project** `order-management-system-507412` (number `321311431738`) —
  dedicated to OMS. APIs enabled: sheets, drive, iamcredentials, sts, iam.
- **Service account** `vercel@order-management-system-507412.iam.gserviceaccount.com`.
- **Workload Identity Federation**: pool `vercel` + OIDC provider `vercel`
  (issuer `https://oidc.vercel.com/setmi-india`, audience `https://vercel.com/setmi-india`,
  mapping `google.subject=assertion.sub, attribute.aud=assertion.aud`).
  `roles/iam.workloadIdentityUser` on the SA is granted **team-wide** via
  `principalSet://…/workloadIdentityPools/vercel/attribute.aud/https://vercel.com/setmi-india`
  — covers `setmi-oms` and any future SETMI Vercel project.
- **Vercel project** `setmi-india/setmi-oms`, GitHub-connected. Env vars set for
  production + preview + development:
  | var | value |
  | --- | --- |
  | `GOOGLE_SHEET_ID` | `1m3kRb46mEgCyojrO1KSl5jpifexr1QatiASMEwdks1A` (OMS sheet) |
  | `PFMS_SHEET_ID` | `10WdMwZg-9aQPPmgidXN8WSN53hqWT5KhplrcCFolXA8` (Purchase FMS sheet) |
  | `GCP_PROJECT_ID` | `order-management-system-507412` |
  | `GCP_PROJECT_NUMBER` | `321311431738` |
  | `GCP_SERVICE_ACCOUNT_EMAIL` | `vercel@order-management-system-507412.iam.gserviceaccount.com` |
  | `GCP_WORKLOAD_IDENTITY_POOL_ID` / `..._PROVIDER_ID` | `vercel` / `vercel` |
  | `SESSION_SECRET` | (generated) |
  | `PFMS_BOT_USER_ID` | `OMSBOT` |
- `oms/.env.local` mirrors all of the above + a `VERCEL_OIDC_TOKEN` from `vercel link`.
- The WIF auth chain is verified working — a Sheets call now reaches Google and
  returns "caller does not have permission" (i.e. auth OK, sharing pending).

## ⚠️ You must do this — share both sheets with the service account

Open each spreadsheet → **Share** → add
**`vercel@order-management-system-507412.iam.gserviceaccount.com`** as **Editor**
(uncheck "Notify people"):

1. OMS sheet — https://docs.google.com/spreadsheets/d/1m3kRb46mEgCyojrO1KSl5jpifexr1QatiASMEwdks1A
2. Purchase FMS sheet — https://docs.google.com/spreadsheets/d/10WdMwZg-9aQPPmgidXN8WSN53hqWT5KhplrcCFolXA8

## Then bootstrap

```bash
cd oms
vercel env pull .env.local     # refresh the OIDC token (~12h TTL)
npm run ensure-sheets          # creates every OMS_* tab on the OMS sheet; seeds admin / Admin@123
npm run add-bot-user           # creates "OMS Bot" in PFMS_Users on the Purchase FMS sheet -> PFMS_BOT_USER_ID=OMSBOT
npm run seed-demo              # 4 role staff + 2 customers + 4 demo products, all pw Demo@1234
npm run dev                    # smoke test at http://localhost:3000
vercel --prod                  # deploy
```

Then walk `docs/TEST-SCENARIOS.md`.

## Notes

- `lib/sheets/rows.ts` helpers take an optional `spreadsheetId`; only the
  requirement bridge (`lib/oms/requirementBridge.ts`) and the PFMS-item picker
  (`listPfmsItems`) pass `pfmsSheetId()` — everything else uses the OMS sheet.
- The `REQ-` / `AP-` ids the bridge mints on the Purchase FMS sheet are guarded by
  OMS's own advisory lock, which does **not** coordinate with the live PFMS Apps
  Script app. Collision needs an OMS "raise requirement" and a human PFMS submit in
  the same second — rare; `nextId` also skips any id already present on read.
- Attachments upload is disabled until `DRIVE_OMS_FOLDER_ID` is set to a Shared
  Drive folder the SA can write to.
