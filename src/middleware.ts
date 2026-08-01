/**
 * Middleware: Session guard for /cms and /api/proxy/* routes
 * 
 * @para-doc [#csa-cms-sec-middleware-guard]
 * Security layers (Defense in Depth):
 * 1. Cookie presence check
 * 2. HMAC signature + expiration verification
 * 3. Git credentials completeness check (BUG-19 fix)
 *    → Prevents stale sessions after mode transitions (Server→Connect→Open)
 */

import { defineMiddleware } from 'astro:middleware';
import { verifySession, resolveGitCredentials, COOKIE_NAME, verifyCsrfToken } from './lib/session';

// @para-doc [#csa-cms-sec-middleware-guard-implementation]
// @para-doc [#csa-cms-sec-ac-csrf-header]
// @para-doc [#csa-cms-sec-ac-sso-compatibility]
// @para-doc [#csa-cms-sec-gap-proxy-blob]
// @para-doc [#csa-cms-sec-gap-settings-plugins]
export const onRequest = defineMiddleware(async ({ request, cookies, redirect, url }, next) => {
  const path = url.pathname;

  // Guard /cms, /api/proxy/* and /api/settings/* routes
  const isProtected = path === '/cms' || path.startsWith('/api/proxy/') || path.startsWith('/api/settings/');

  if (!isProtected) {
    return next();
  }

  // Layer 1: Check session cookie presence
  const token = cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    if (path.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return redirect('/login');
  }

  // Layer 2: Verify HMAC signature + expiration
  const session = await verifySession(token);
  if (!session) {
    cookies.delete(COOKIE_NAME, { path: '/' });
    if (path.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Session expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return redirect('/login');
  }

  // Layer 3: Validate Git credentials completeness (BUG-19)
  // Catches stale sessions when env vars change (e.g., Server→Connect mode transition)
  const creds = resolveGitCredentials(session);
  if (!creds.token || !creds.repo) {
    cookies.delete(COOKIE_NAME, { path: '/' });
    if (path.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Session missing Git credentials. Please re-login.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return redirect('/login?error=' + encodeURIComponent(
      'Your session is missing required credentials. Please login again.'
    ));
  }

  // Layer 4: CSRF Header Validation for mutation requests
  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);
  if (isMutation && (path.startsWith('/api/proxy/') || path.startsWith('/api/settings/'))) {
    const csrfHeader = request.headers.get('X-CMS-CSRF-Token') || request.headers.get('x-cms-csrf-token');
    const sessionId = token.split('.')[1] || '';
    
    // @para-doc [#csa-cms-sec-log-csrf]
    const isValidCsrf = csrfHeader ? await verifyCsrfToken(csrfHeader, sessionId) : false;
    if (!isValidCsrf) {
      console.warn(`[middleware] CSRF check failed for path: ${path}, ip: ${request.headers.get('x-forwarded-for') || 'unknown'}`);
      return new Response(JSON.stringify({ error: 'SEC_CSRF_INVALID', message: 'CSRF token missing or invalid' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return next();
});
