/**
 * GET /api/proxy/blob/[...path]
 * Binary proxy for fetching files from Git repo
 * 
 * v2.1: Uses session-resolved Git credentials
 */

import type { APIRoute } from 'astro';
import { getFileAsBlob, createGitConfig } from '../../../../lib/git-client';
import { verifySession, resolveGitCredentials, COOKIE_NAME } from '../../../../lib/session';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.md': 'text/markdown',
};

function getMimeType(filepath: string): string {
  const ext = filepath.substring(filepath.lastIndexOf('.')).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export const GET: APIRoute = async ({ params, cookies }) => {
  try {
    const filePath = params.path;
    if (!filePath) {
      return new Response('Path is required', { status: 400 });
    }

    // Resolve credentials from session
    const sessionToken = cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return new Response('Unauthorized', { status: 401 });
    }

    const session = await verifySession(sessionToken);
    if (!session) {
      return new Response('Session expired', { status: 401 });
    }

    const creds = resolveGitCredentials(session);
    const config = createGitConfig(creds.token, creds.repo);

    const decodedPath = decodeURIComponent(filePath);
    const upstreamResponse = await getFileAsBlob(config, decodedPath);
    const contentType = getMimeType(decodedPath);

    // Stream the response body through
    return new Response(upstreamResponse.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('[proxy/blob] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Blob fetch failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
