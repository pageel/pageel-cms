/**
 * GET /api/proxy/blob/[...path]
 * Binary proxy for fetching files from Git repo
 */

import type { APIRoute } from 'astro';
import { getFileAsBlob } from '../../../../lib/git-client';

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

export const GET: APIRoute = async ({ params }) => {
  try {
    const filePath = params.path;
    if (!filePath) {
      return new Response('Path is required', { status: 400 });
    }

    const decodedPath = decodeURIComponent(filePath);
    const upstreamResponse = await getFileAsBlob(decodedPath);
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
