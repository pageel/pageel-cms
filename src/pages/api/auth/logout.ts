import type { APIRoute } from 'astro';
import { COOKIE_NAME, verifyCsrfToken, normalizeBase64 } from '../../../lib/session';
import { getWorkerUrl } from '../../../lib/auth-bridge';

// @para-doc [#csa-cms-sdk-logout-webhook]
// @para-doc [#csa-cms-app-int-logout]
// @para-doc [#csa-cms-client-logout-post]
export const POST: APIRoute = async ({ cookies, redirect, request, locals }) => {
  const sessionToken = cookies.get(COOKIE_NAME)?.value;
  const csrfCookie = cookies.get('pageel_cms_csrf')?.value;

  const logData = (code: string, data: any) => {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      error_code: code,
      component: 'API_LOGOUT',
      ...data
    }));
  };

  // Check-LOG-1: Request received stubs
  logData('AUTH_LOGOUT_REQUEST_RECEIVED', {
    has_session: !!sessionToken,
    session_len: sessionToken?.length || 0,
    has_csrf_cookie: !!csrfCookie,
    csrf_cookie_len: csrfCookie?.length || 0,
  });

  if (!sessionToken || !csrfCookie) {
    logData('AUTH_LOGOUT_MISSING_CREDS', {
      has_session: !!sessionToken,
      has_csrf_cookie: !!csrfCookie,
    });
    return new Response(JSON.stringify({ error: 'Forbidden: Missing credentials' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sessionId = normalizeBase64(sessionToken.split('.')[1] || '');
  const csrfHeader = request.headers.get('x-csrf-token') || '';
  
  const url = new URL(request.url);
  const csrfQuery = url.searchParams.get('csrf_token') || '';

  let csrfBody = '';
  try {
    const formData = await request.clone().formData();
    csrfBody = formData.get('csrf_token')?.toString() || '';
  } catch {}

  const submittedCsrf = normalizeBase64(csrfHeader || csrfQuery || csrfBody);
  const decodedCsrfCookie = normalizeBase64(csrfCookie || '');
  const env = (locals as any)?.runtime?.env || {};
  const csrfSecret = env.CMS_SECRET || import.meta.env.CMS_SECRET || 'fallback-secret-key-16-chars';

  // Check-LOG-2: CSRF resolution metadata
  logData('AUTH_LOGOUT_CSRF_RESOLUTION', {
    sessionId_len: sessionId.length,
    submittedCsrf_len: submittedCsrf.length,
    decodedCsrfCookie_len: decodedCsrfCookie.length,
    sessionId_snippet: sessionId ? `${sessionId.substring(0, 5)}...${sessionId.substring(sessionId.length - 5)}` : '',
    submittedCsrf_snippet: submittedCsrf.includes('.') ? `${submittedCsrf.split('.')[0].substring(0, 5)}...${submittedCsrf.split('.')[1]?.substring(0, 5)}` : submittedCsrf.substring(0, 10),
    decodedCsrfCookie_snippet: decodedCsrfCookie.includes('.') ? `${decodedCsrfCookie.split('.')[0].substring(0, 5)}...${decodedCsrfCookie.split('.')[1]?.substring(0, 5)}` : decodedCsrfCookie.substring(0, 10),
  });

  const verifyResult = await verifyCsrfToken(submittedCsrf, sessionId, csrfSecret);
  const directMatch = submittedCsrf === decodedCsrfCookie;

  // Check-LOG-3: Verification results
  logData('AUTH_LOGOUT_VERIFICATION_RESULT', {
    verifyCsrfToken_ok: verifyResult,
    directMatch_ok: directMatch,
    secret_len: csrfSecret.length,
  });

  const isValidCsrf = verifyResult && directMatch;

  if (!isValidCsrf) {
    logData('AUTH_LOGOUT_INVALID_CSRF', {
      verifyCsrfToken_ok: verifyResult,
      directMatch_ok: directMatch,
    });
    return new Response(JSON.stringify({ error: 'Forbidden: Invalid CSRF token' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isProd = import.meta.env.PROD;

  // IMPORTANT: Do NOT use cookies.set() here — Astro does not merge
  // cookies.set() headers into a raw `new Response()`. Only Astro's
  // redirect() triggers header merging. We must set all Set-Cookie
  // headers directly on the Response object.

  const hasSso = !!(
    (env.PAGEEL_WORKER_URL && env.PAGEEL_WORKER_URL.trim().length > 0) ||
    (env.PAGEEL_APP_URL && env.PAGEEL_APP_URL.trim().length > 0) ||
    (typeof process !== 'undefined' && (
      (process.env.PAGEEL_WORKER_URL && process.env.PAGEEL_WORKER_URL.trim().length > 0) ||
      (process.env.PAGEEL_APP_URL && process.env.PAGEEL_APP_URL.trim().length > 0)
    ))
  );

  let redirectUrl = '/login';
  if (hasSso) {
    const workerUrl = getWorkerUrl(env);
    const origin = new URL(request.url).origin;
    // // @para-doc [#csa-cms-cfr-explicit-logout-url]
    redirectUrl = `${workerUrl}/api/auth/logout?return_url=${encodeURIComponent(origin + '/login?logout=true')}`;
  }

  const secureFlag = isProd ? '; Secure' : '';
  const expireDirective = 'Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0';

  const response = new Response(null, {
    status: 302,
    headers: new Headers({
      'Location': redirectUrl,
    }),
  });

  // Clear session cookie for BOTH SameSite variants.
  // login.ts sets SameSite=Strict, callback.ts sets SameSite=Lax.
  // Browser treats these as separate cookies — must expire both.
  response.headers.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; ${expireDirective}; HttpOnly${secureFlag}; SameSite=Strict`);
  response.headers.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; ${expireDirective}; HttpOnly${secureFlag}; SameSite=Lax`);
  response.headers.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; ${expireDirective}; HttpOnly${secureFlag}; SameSite=None`);

  // Clear CSRF cookie for both variants
  response.headers.append('Set-Cookie', `pageel_cms_csrf=; Path=/; ${expireDirective}${secureFlag}; SameSite=Strict`);
  response.headers.append('Set-Cookie', `pageel_cms_csrf=; Path=/; ${expireDirective}${secureFlag}; SameSite=Lax`);
  response.headers.append('Set-Cookie', `pageel_cms_csrf=; Path=/; ${expireDirective}${secureFlag}; SameSite=None`);

  return response;
};

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json',
      'Allow': 'POST',
    },
  });
};
