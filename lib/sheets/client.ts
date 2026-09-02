import { google } from 'googleapis';
import { ExternalAccountClient, BaseExternalAccountClient } from 'google-auth-library';
import { getVercelOidcToken } from '@vercel/oidc';

/*****************************************************************
 * Auth via GCP Workload Identity Federation, trusting Vercel's OIDC tokens
 * (https://vercel.com/docs/oidc/gcp) — chosen instead of a downloadable
 * service-account key because the setmiindia.org GCP org enforces the
 * iam.disableServiceAccountKeyCreation policy and this account isn't an
 * Org Policy Administrator. No long-lived secret exists anywhere with this
 * approach: Vercel injects a short-lived VERCEL_OIDC_TOKEN per invocation,
 * which GCP's STS exchanges for a short-lived access token impersonating
 * the "vercel" service account.
 *****************************************************************/

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
];

// Module-level singleton so a warm serverless instance reuses the client
// (it re-exchanges VERCEL_OIDC_TOKEN for a fresh GCP access token as needed).
let _auth: BaseExternalAccountClient | undefined;

function getAuth(): BaseExternalAccountClient {
  if (_auth) return _auth;

  const projectNumber = process.env.GCP_PROJECT_NUMBER;
  const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
  const poolId = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID;
  const providerId = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID;

  if (!projectNumber || !serviceAccountEmail || !poolId || !providerId) {
    throw new Error(
      'Missing GCP_PROJECT_NUMBER / GCP_SERVICE_ACCOUNT_EMAIL / GCP_WORKLOAD_IDENTITY_POOL_ID / ' +
        'GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID env vars. See web/.env.example for setup instructions.'
    );
  }

  const client = ExternalAccountClient.fromJSON({
    type: 'external_account',
    audience: `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
    subject_token_supplier: {
      // Vercel auto-refreshes VERCEL_OIDC_TOKEN per build/invocation; getVercelOidcToken() reads it
      // (and works locally too when running `vercel dev` or after a recent `vercel env pull`).
      getSubjectToken: () => getVercelOidcToken(),
    },
  });

  if (!client) throw new Error('Failed to construct GCP ExternalAccountClient from config.');
  client.scopes = SCOPES;

  _auth = client;
  return _auth;
}

export function sheetsApi() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

export function driveApi() {
  return google.drive({ version: 'v3', auth: getAuth() });
}

export function sheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error('Missing GOOGLE_SHEET_ID env var.');
  return id;
}

/**
 * The spreadsheet that holds the Requirement System's PFMS_* tabs. Defaults to
 * the OMS sheet when unset (single-sheet deployments), otherwise a separate
 * spreadsheet the OMS service account must also be shared into as Editor.
 * Only the requirement bridge + the PFMS_Items picker read/write here.
 */
export function pfmsSheetId(): string {
  return process.env.PFMS_SHEET_ID || sheetId();
}
