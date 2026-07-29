import type { APIRoute } from 'astro';
import { COOKIE_NAME } from '../../../lib/session';

/**
 * Diagnostic endpoint to check cookie state and logout flow
 * GET /api/auth/debug-cookies
 * 
 * TEMPORARY — remove after confirming logout works.
 */
export const GET: APIRoute = async ({ cookies, request, locals }) => {
  // Double Gate Security Check: CMS_DEBUG must be 'true' AND ?key must match CMS_SECRET
  const cmsDebug = process.env.CMS_DEBUG || (import.meta.env as any)?.CMS_DEBUG;
  const urlKey = new URL(request.url).searchParams.get('key');
  const cmsSecret = process.env.CMS_SECRET || (import.meta.env as any)?.CMS_SECRET;

  if (cmsDebug !== 'true' || !cmsSecret || urlKey !== cmsSecret) {
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sessionCookie = cookies.get(COOKIE_NAME)?.value;
  const csrfCookie = cookies.get('pageel_cms_csrf')?.value;

  // Check all raw cookies from the request
  const rawCookieHeader = request.headers.get('cookie') || '';
  const cookieNames = rawCookieHeader
    .split(';')
    .map(c => c.trim().split('=')[0])
    .filter(Boolean);

  // Check Worker URL resolution
  const env = (locals as any)?.runtime?.env || {};
  let workerUrl = 'NOT_SET';
  try {
    const { getWorkerUrl } = await import('../../../lib/auth-bridge');
    workerUrl = getWorkerUrl(env);
  } catch (e: any) {
    workerUrl = `ERROR: ${e.message}`;
  }

  const isProd = import.meta.env.PROD;

  return new Response(JSON.stringify({
    timestamp: new Date().toISOString(),
    environment: isProd ? 'production' : 'development',
    cookies: {
      session_present: !!sessionCookie,
      session_length: sessionCookie?.length || 0,
      csrf_present: !!csrfCookie,
      csrf_length: csrfCookie?.length || 0,
      all_cookie_names: cookieNames,
      raw_cookie_header_length: rawCookieHeader.length,
    },
    worker_url: workerUrl,
    request_origin: new URL(request.url).origin,
    host_header: request.headers.get('host') || 'missing',
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
