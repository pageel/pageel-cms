/**
 * POST /api/auth/login
 * Verify credentials → validate token/repo → set signed session cookie → redirect /cms
 * 
 * v2.1: Supports 3 modes:
 *   - Server Mode: CMS_USER + GITHUB_TOKEN set → password auth only
 *   - Connect Mode: CMS_USER set, GITHUB_TOKEN missing → password auth + user-provided token
 *   - Open Mode: CMS_USER not set → skip password, validate GitHub token only
 */

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { verifyCredentials, checkRateLimit } from '../../../lib/auth';
import { createSession, getSessionCookieOptions, hasEnvGitConfig, hasEnvAuth, createCsrfToken } from '../../../lib/session';
import { createGitConfig, verifyTokenAccess } from '../../../lib/git-client';

// @para-doc [#csa-cms-local-auth-validation]
const loginSchema = z.object({
  username: z.string().min(1, 'Username and password are required.'),
  password: z.string().min(1, 'Username and password are required.'),
  repo: z.string().optional(),
  token: z.string().optional()
});

export const POST: APIRoute = async ({ request, cookies, redirect, clientAddress, locals }) => {
  const ip = clientAddress || 'unknown';

  // Rate limit check
  if (!checkRateLimit(ip)) {
    return redirect('/login?error=' + encodeURIComponent('Too many attempts. Please wait a moment.'));
  }

  try {
    // Parse form data
    const formData = await request.formData();
    const username = formData.get('username')?.toString() || '';
    const password = formData.get('password')?.toString() || '';
    const repo = formData.get('repo')?.toString() || undefined;
    const tokenInput = formData.get('token')?.toString() || undefined;

    const envHasAuth = hasEnvAuth();

    // Validate inputs using Zod
    const validation = loginSchema.safeParse({
      username: envHasAuth ? username : 'anonymous',
      password: envHasAuth ? password : 'dummy-password',
      repo,
      token: tokenInput
    });

    if (!validation.success) {
      const errMsg = validation.error.issues[0]?.message || 'Invalid inputs.';
      return redirect('/login?error=' + encodeURIComponent(errMsg));
    }

    // --- Password verification (Server Mode & Connect Mode only) ---
    if (envHasAuth) {
      const valid = await verifyCredentials(username, password);
      if (!valid) {
        return redirect('/login?error=' + encodeURIComponent('Invalid credentials.'));
      }
    }

    // --- Dynamic Session Credentials (Connect Mode & Open Mode) ---
    const envHasGit = hasEnvGitConfig();
    let dynamicRepo: string | undefined;
    let dynamicToken: string | undefined;

    if (!envHasGit) {
      // Env vars missing — require user to provide them
      dynamicRepo = repo;
      dynamicToken = tokenInput;

      if (!dynamicRepo || !dynamicToken) {
        return redirect('/login?error=' + encodeURIComponent('Repository and GitHub Token are required.'));
      }

      // Validate token has access to the specified repo
      try {
        const testConfig = createGitConfig(dynamicToken, dynamicRepo);
        const hasAccess = await verifyTokenAccess(testConfig);
        if (!hasAccess) {
          return redirect('/login?error=' + encodeURIComponent('Token does not have access to this repository.'));
        }
      } catch {
        return redirect('/login?error=' + encodeURIComponent('Invalid token or repository format (use owner/repo).'));
      }
    }

    // @para-doc [#csa-cms-local-auth-session]
    // Create session and set cookie
    const sessionUser = envHasAuth ? username : (dynamicRepo || 'anonymous');
    const sessionToken = await createSession({
      username: sessionUser,
      repo: dynamicRepo,
      token: dynamicToken,
    });
    const isProd = import.meta.env.PROD;
    const cookieOpts = getSessionCookieOptions(isProd);

    cookies.set(cookieOpts.name, sessionToken, {
      httpOnly: cookieOpts.httpOnly,
      secure: cookieOpts.secure,
      sameSite: 'lax', // Must match callback.ts SSO flow to avoid dual-cookie SameSite mismatch
      path: cookieOpts.path,
      maxAge: cookieOpts.maxAge,
    });

    // Set CSRF token cookie (Double Submit Cookie)
    const sessionId = sessionToken.split('.')[1] || 'session-signature';
    const env = (locals as any)?.runtime?.env || {};
    const csrfSecret = env.CMS_SECRET || import.meta.env.CMS_SECRET;
    const csrfToken = await createCsrfToken(sessionId, csrfSecret);

    cookies.set('pageel_cms_csrf', csrfToken, {
      httpOnly: false, // Client JS needs to read it
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: cookieOpts.maxAge,
    });

    return redirect('/cms');
  } catch (err: any) {
    console.error('[login] Unhandled error:', err.message || err);
    const msg = err.message?.includes('CMS_SECRET')
      ? 'Server misconfigured: CMS_SECRET environment variable is required (min 16 chars).'
      : 'Login failed due to a server error. Please contact the administrator.';
    return redirect('/login?error=' + encodeURIComponent(msg));
  }
};
