/**
 * Auth helpers — bcryptjs password verification + rate limiting
 */

import bcrypt from 'bcryptjs';

// --- Rate Limiting (in-memory, best-effort) ---

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000; // 1 minute

/**
 * Check rate limit for an IP. Returns true if allowed.
 */
export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Get bcrypt hash from environment.
 *
 * Priority:
 * 1. import.meta.env — works on Vercel/Railway/Docker (no dotenv-expand issue)
 * 2. process.env — works when set via shell export
 * 3. Raw .env file read — local dev fallback (bypasses dotenv-expand $ corruption)
 */
async function getPassHash(): Promise<string> {
  // Platform env (Vercel, Railway, Docker) — not corrupted by dotenv-expand
  const metaHash = import.meta.env.CMS_PASS_HASH;
  if (metaHash && metaHash.startsWith('$2')) return metaHash;

  // Shell export
  const procHash = process.env.CMS_PASS_HASH;
  if (procHash && procHash.startsWith('$2')) return procHash;

  // Local dev fallback — read raw .env file
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const envPath = path.resolve(process.cwd(), '.env');
    const content = fs.readFileSync(envPath, 'utf8');
    const regex = /^CMS_PASS_HASH=["']?(.+?)["']?\s*$/m;
    const match = content.match(regex);
    return match?.[1] || '';
  } catch {
    return '';
  }
}

/**
 * Verify username + password against env vars
 */
export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const envUser = import.meta.env.CMS_USER || '';
  const envHash = await getPassHash();

  if (!envUser || !envHash) {
    console.error('[auth] CMS_USER or CMS_PASS_HASH not set');
    return false;
  }

  if (username !== envUser) {
    // Constant-time comparison: always run bcrypt to prevent timing attacks
    await bcrypt.compare(password, '$2a$12$invalidhashpaddingtopreventshorting');
    return false;
  }

  return bcrypt.compare(password, envHash);
}

// Cleanup stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, 300_000);
