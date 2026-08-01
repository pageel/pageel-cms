import type { APIRoute } from 'astro';
import { verifyAppToken } from '../../../lib/auth-bridge';
import { createSession, getSessionCookieOptions, createCsrfToken } from '../../../lib/session';

// @para-doc [#csa-cms-app-int-callback]
export const GET: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return redirect('/login?error=auth_failed');
  }

  try {
    // Determine runtime environment (Cloudflare platform context or standard env vars)
    const env = (locals as any)?.runtime?.env || {};

    // @para-doc [#csa-cms-sdk-handshake-jwt]
    // @para-doc [#csa-cms-app-int-handshake]
    const response = await verifyAppToken(token, env);

    if (!response || !response.success) {
      return redirect('/login?error=auth_failed');
    }

    // @para-doc [#csa-cms-sdk-verify-payload]
    // @para-doc [#csa-cms-app-int-local-session]
    const sessionToken = await createSession({
      username: response.user.email,
      repo: `${response.config.repoOwner}/${response.config.repoName}`,
      token: response.config.githubToken,
      role: response.user.role,
    });

    const isProd = import.meta.env.PROD;
    const cookieOpts = getSessionCookieOptions(isProd);

    cookies.set(cookieOpts.name, sessionToken, {
      httpOnly: cookieOpts.httpOnly,
      secure: cookieOpts.secure,
      sameSite: 'lax', // Lax sameSite for SSO flow redirects
      path: cookieOpts.path,
      maxAge: cookieOpts.maxAge,
    });

    // Set CSRF token cookie (Double Submit Cookie) after successful SSO handshake
    const sessionId = sessionToken.split('.')[1] || 'session-signature';
    const csrfSecret = env.CMS_SECRET || import.meta.env.CMS_SECRET;
    const csrfToken = await createCsrfToken(sessionId, csrfSecret);

    cookies.set('pageel_cms_csrf', csrfToken, {
      httpOnly: false, // Client JS needs to read it
      secure: isProd,
      sameSite: 'lax',
      path: cookieOpts.path,
      maxAge: cookieOpts.maxAge,
    });

    return redirect('/cms');
  } catch (err: any) {
    console.error('[callback] Verification error:', err.message || err);
    return redirect('/login?error=auth_failed');
  }
};
