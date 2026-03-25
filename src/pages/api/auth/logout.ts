/**
 * POST /api/auth/logout
 * Clear session cookie → redirect /login
 */

import type { APIRoute } from 'astro';
import { COOKIE_NAME } from '../../../lib/session';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete(COOKIE_NAME, { path: '/' });
  return redirect('/login');
};
