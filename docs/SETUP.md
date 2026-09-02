# Deploy / bootstrap

## Status

- **Vercel project**: `setmi-india/setmi-oms` (`prj_XOBR4RojkOq6tvOrtl5QNdlRH8TN`),
  connected to `github.com/SetmiMis/Retail-Customer-Order-Management-System`.
- **Env vars** set on that project for production + preview + development:
  `GOOGLE_SHEET_ID` (= the Purchase FMS sheet `10WdMwZg…`), `GCP_PROJECT_ID`,
  `GCP_PROJECT_NUMBER`, `GCP_SERVICE_ACCOUNT_EMAIL`,
  `GCP_WORKLOAD_IDENTITY_POOL_ID`, `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`,
  `SESSION_SECRET`, `PFMS_BOT_USER_ID=OMSBOT`.
- `oms/.env.local` has the same values + a `VERCEL_OIDC_TOKEN` from `vercel link`.

## ⚠️ Blocker — GCP IAM binding

The `setmi-oms` Vercel project's OIDC identity is **not yet allowed to impersonate**
`vercel@ims-nextjs-505806.iam.gserviceaccount.com`, so every Sheets/Drive call
returns `403 iam.serviceAccounts.getAccessToken denied`.

Someone with **Owner / Service Account Admin** on GCP project `ims-nextjs-505806`
must add a `roles/iam.workloadIdentityUser` binding for the new project. Easiest is
to make it **team-wide** so it covers `sales-fms`, `setmi-purchase-fms`, `setmi-oms`
and anything future in one entry:

```bash
gcloud iam service-accounts add-iam-policy-binding \
  vercel@ims-nextjs-505806.iam.gserviceaccount.com \
  --project=ims-nextjs-505806 \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/994716328599/locations/global/workloadIdentityPools/vercel/attribute.aud/https://vercel.com/setmi-india"
```

If you prefer to keep it per-project, mirror whatever member format the existing
`setmi-purchase-fms` binding uses, substituting `setmi-oms` — e.g. per environment:

```
principal://iam.googleapis.com/projects/994716328599/locations/global/workloadIdentityPools/vercel/subject/owner:setmi-india:project:setmi-oms:environment:production
```
(repeat for `:environment:preview` and `:environment:development`)

Console path: **IAM & Admin → Service Accounts → `vercel@…` → Permissions →
Grant access** (or **IAM & Admin → Workload Identity Federation → `vercel` pool →
Grant access**), look at the `setmi-purchase-fms` entry, add the analogous one.

## Once the IAM binding is in place

```bash
cd oms
vercel env pull .env.local     # refresh the OIDC token (expires ~12h)
npm run ensure-sheets          # creates every OMS_* tab on the sheet; seeds admin / Admin@123
npm run add-bot-user           # creates the "OMS Bot" row in PFMS_Users -> prints PFMS_BOT_USER_ID=OMSBOT
npm run seed-demo              # 4 role staff + 2 customers + 4 demo products, all pw Demo@1234
npm run dev                    # smoke test at http://localhost:3000
vercel --prod                  # deploy
```

Then walk `docs/TEST-SCENARIOS.md`.

> If IAM can't be changed right now, everything except live Sheets access is done —
> the app builds and deploys; it just can't read/write the sheet until the binding
> exists.
