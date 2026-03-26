/**
 * Middleware: Session guard for /cms and /api/proxy/* routes
 * 
 * Security layers (Defense in Depth):
 * 1. Cookie presence check
 * 2. HMAC signature + expiration verification
 * 3. Git credentials completeness check (BUG-19 fix)
 *    → Prevents stale sessions after mode transitions (Server→Connect→Open)
 */

import { defineMiddleware } from 'astro:middleware';
import { verifySession, resolveGitCredentials, COOKIE_NAME } from './lib/session';

export const onRequest = defineMiddleware(async ({ request, cookies, redirect, url }, next) => {
  const path = url.pathname;

  // Only guard /cms and /api/proxy/* routes
  const isProtected = path === '/cms' || path.startsWith('/api/proxy/');

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

  return next();
});
