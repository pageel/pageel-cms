/**
 * Middleware: Session guard for /cms and /api/proxy/* routes
 */

import { defineMiddleware } from 'astro:middleware';
import { verifySession, COOKIE_NAME } from './lib/session';

export const onRequest = defineMiddleware(async ({ request, cookies, redirect, url }, next) => {
  const path = url.pathname;

  // Only guard /cms and /api/proxy/* routes
  const isProtected = path === '/cms' || path.startsWith('/api/proxy/');

  if (!isProtected) {
    return next();
  }

  // Check session cookie
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

  const session = await verifySession(token);
  if (!session) {
    // Clear invalid cookie
    cookies.delete(COOKIE_NAME, { path: '/' });
    if (path.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Session expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return redirect('/login');
  }

  return next();
});
