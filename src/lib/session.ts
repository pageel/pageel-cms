/**
 * Session management — HMAC-SHA256 signed cookies
 * 
 * Cookie format: base64(payload).base64(signature)
 * Payload: { user, exp }
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
}

/**
 * Create a signed session token
 */
export async function createSession(username: string): Promise<string> {
  const secret = getSecret();
  const payload: SessionPayload = {
    user: username,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE,
  };
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

export { COOKIE_NAME };
