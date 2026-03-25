/**
 * POST /api/auth/login
 * Verify credentials → set signed session cookie → redirect /cms
 */

import type { APIRoute } from 'astro';
import { verifyCredentials, checkRateLimit } from '../../../lib/auth';
import { createSession, getSessionCookieOptions } from '../../../lib/session';

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

  if (!username || !password) {
    return redirect('/login?error=Username and password are required.');
  }

  // Verify credentials
  const valid = await verifyCredentials(username, password);
  if (!valid) {
    return redirect('/login?error=Invalid credentials.');
  }

  // Create session and set cookie
  const token = await createSession(username);
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
