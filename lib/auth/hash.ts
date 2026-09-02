import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/*****************************************************************
 * Password hashing — scrypt (built into Node, no dependency).
 * Stored form:  scrypt$<N>$<r>$<p>$<salt_b64>$<hash_b64>
 * Used for both OMS_Users (staff) and OMS_Customers (portal). Unlike the
 * PFMS SHA-256 scheme this has a real work factor — these accounts are
 * internet-facing.
 *****************************************************************/

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const dk = scryptSync(String(plain), salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${dk.toString('base64')}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  try {
    const parts = String(stored).split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, n, r, p, saltB64, hashB64] = parts;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const dk = scryptSync(String(plain), salt, expected.length, { N: Number(n), r: Number(r), p: Number(p) });
    return dk.length === expected.length && timingSafeEqual(dk, expected);
  } catch {
    return false;
  }
}
