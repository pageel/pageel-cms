/**
 * GET /api/proxy/image/[...path]
 * Image proxy for WYSIWYG editor
 * 
 * v2.1: Secure endpoint for displaying images in editor
 */

import type { APIRoute } from 'astro';
import { COOKIE_NAME } from '../../../../lib/session';
import { createAuthenticatedBlobResponse } from '../../../../lib/proxy-utils';

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif', '.ico'
]);

export const GET: APIRoute = async ({ params, cookies }) => {
  try {
    const imagePath = params.path;
    if (!imagePath) {
      return new Response('Image path is required', { status: 400 });
    }

    const sessionToken = cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return new Response('Unauthorized', { status: 401 });
    }

    const ext = imagePath.substring(imagePath.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      return new Response('Invalid image format', { status: 400 });
    }

    // True = Try public/ fallback since MDX images are often relative like /hero.png
    return await createAuthenticatedBlobResponse(sessionToken, imagePath, true);
  } catch (error: any) {
    console.error('[proxy/image] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Image fetch failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
