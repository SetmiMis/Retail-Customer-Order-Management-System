import crypto from 'node:crypto';

/**
 * Bearer-token check for the /api/ingest/* routes (the Sales-CRM bridge). These routes are not
 * cookie-gated — proxy.ts lets /api/ingest/ through — so this is the only guard. Set the same
 * INGEST_TOKEN on this deploy and on the Sales FMS deploy (OMS_INGEST_TOKEN there).
 */
export function checkIngestToken(req: Request): boolean {
  const expected = process.env.INGEST_TOKEN || '';
  if (expected.length < 16) return false; // refuse to run with a weak/absent secret
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (got.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}
