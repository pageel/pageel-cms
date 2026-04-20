/**
 * GET /api/proxy/blob/[...path]
 * Binary proxy for fetching files from Git repo
 * 
 * v2.1: Uses shared createAuthenticatedBlobResponse helper
 */

import type { APIRoute } from 'astro';
import { COOKIE_NAME } from '../../../../lib/session';
import { createAuthenticatedBlobResponse } from '../../../../lib/proxy-utils';

export const GET: APIRoute = async ({ params, cookies }) => {
  try {
    const filePath = params.path;
    if (!filePath) {
      return new Response('Path is required', { status: 400 });
    }

    const sessionToken = cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return new Response('Unauthorized', { status: 401 });
    }

    // False = no fallback path for generic blobs
    return await createAuthenticatedBlobResponse(sessionToken, filePath, false);
  } catch (error: any) {
    console.error('[proxy/blob] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Blob fetch failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
