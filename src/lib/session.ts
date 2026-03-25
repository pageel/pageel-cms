/**
 * Session management — HMAC-SHA256 signed cookies
 * 
 * Cookie format: base64(payload).base64(signature)
 * Payload: { user, exp, repo?, token? }
 * 
 * v2.1: Extended to support Dynamic Session Credentials (Multi-Tenant)
 *       When CMS_REPO/GITHUB_TOKEN are missing from env, user supplies them
 *       at login and they are stored encrypted inside the session cookie.
 */

const COOKIE_NAME = 'pageel_session';
const MAX_AGE = 86400; // 24 hours

function getSecret(): string {
  const secret = import.meta.env.CMS_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('CMS_SECRET env var is required (min 16 chars)');
  }
  return secret;
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function hmacVerify(payload: string, signature: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(payload, secret);
  return expected === signature;
}

export interface SessionPayload {
  user: string;
  exp: number;
  /** Dynamic repo — only set when env CMS_REPO is missing */
  repo?: string;
  /** Dynamic token — only set when env GITHUB_TOKEN is missing */
  token?: string;
}

/**
 * Options for creating a session with dynamic credentials
 */
export interface CreateSessionOptions {
  username: string;
  repo?: string;
  token?: string;
}

/**
 * Create a signed session token
 */
export async function createSession(options: CreateSessionOptions): Promise<string> {
  const secret = getSecret();
  const payload: SessionPayload = {
    user: options.username,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE,
  };

  // Only embed credentials when env vars are missing (Dynamic Session mode)
  if (options.repo) payload.repo = options.repo;
  if (options.token) payload.token = options.token;

  const payloadStr = btoa(JSON.stringify(payload));
  const signature = await hmacSign(payloadStr, secret);
  return `${payloadStr}.${signature}`;
}

/**
 * Verify and decode a session token
 * Returns null if invalid or expired
 */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const secret = getSecret();
    const [payloadStr, signature] = token.split('.');
    if (!payloadStr || !signature) return null;

    const valid = await hmacVerify(payloadStr, signature, secret);
    if (!valid) return null;

    const payload: SessionPayload = JSON.parse(atob(payloadStr));
    
    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Cookie options for set/clear
 */
export function getSessionCookieOptions(isProd: boolean) {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict' as const,
    path: '/',
    maxAge: MAX_AGE,
  };
}

/**
 * Resolve Git credentials: prefer env vars, fallback to session payload
 */
export function resolveGitCredentials(session: SessionPayload): {
  token: string;
  repo: string;
} {
  const envToken = import.meta.env.GITHUB_TOKEN || '';
  const envRepo = import.meta.env.CMS_REPO || '';

  return {
    token: envToken || session.token || '',
    repo: envRepo || session.repo || '',
  };
}

/**
 * Check if server has hardcoded Git env vars
 */
export function hasEnvGitConfig(): boolean {
  return !!(import.meta.env.GITHUB_TOKEN && import.meta.env.CMS_REPO);
}

export { COOKIE_NAME };
