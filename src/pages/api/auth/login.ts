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
import { verifyCredentials, checkRateLimit } from '../../../lib/auth';
import { createSession, getSessionCookieOptions, hasEnvGitConfig, hasEnvAuth } from '../../../lib/session';
import { createGitConfig, verifyTokenAccess } from '../../../lib/git-client';

export const POST: APIRoute = async ({ request, cookies, redirect, clientAddress }) => {
  const ip = clientAddress || 'unknown';

  // Rate limit check
  if (!checkRateLimit(ip)) {
    return redirect('/login?error=Too many attempts. Please wait a moment.');
  }

  // Parse form data
  const formData = await request.formData();
  const username = formData.get('username')?.toString() || '';
  const password = formData.get('password')?.toString() || '';

  const envHasAuth = hasEnvAuth();

  // --- Password verification (Server Mode & Connect Mode only) ---
  if (envHasAuth) {
    if (!username || !password) {
      return redirect('/login?error=Username and password are required.');
    }

    const valid = await verifyCredentials(username, password);
    if (!valid) {
      return redirect('/login?error=Invalid credentials.');
    }
  }

  // --- Dynamic Session Credentials (Connect Mode & Open Mode) ---
  const envHasGit = hasEnvGitConfig();
  let dynamicRepo: string | undefined;
  let dynamicToken: string | undefined;

  if (!envHasGit) {
    // Env vars missing — require user to provide them
    dynamicRepo = formData.get('repo')?.toString() || '';
    dynamicToken = formData.get('token')?.toString() || '';

    if (!dynamicRepo || !dynamicToken) {
      return redirect('/login?error=Repository and GitHub Token are required.');
    }

    // Validate token has access to the specified repo
    try {
      const testConfig = createGitConfig(dynamicToken, dynamicRepo);
      const hasAccess = await verifyTokenAccess(testConfig);
      if (!hasAccess) {
        return redirect('/login?error=Token does not have access to this repository.');
      }
    } catch {
      return redirect('/login?error=Invalid token or repository format (use owner/repo).');
    }
  }

  // Create session and set cookie
  const sessionUser = envHasAuth ? username : (dynamicRepo || 'anonymous');
  const token = await createSession({
    username: sessionUser,
    repo: dynamicRepo,
    token: dynamicToken,
  });
  const isProd = import.meta.env.PROD;
  const cookieOpts = getSessionCookieOptions(isProd);

  cookies.set(cookieOpts.name, token, {
    httpOnly: cookieOpts.httpOnly,
    secure: cookieOpts.secure,
    sameSite: cookieOpts.sameSite,
    path: cookieOpts.path,
    maxAge: cookieOpts.maxAge,
  });

  return redirect('/cms');
};
