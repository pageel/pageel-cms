/**
 * POST /api/proxy/upload
 * FormData proxy for file upload via Git API
 * 
 * v2.1: Uses session-resolved Git credentials
 */

import type { APIRoute } from 'astro';
import { uploadFile, getFileSha, createGitConfig } from '../../../lib/git-client';
import { verifySession, resolveGitCredentials, COOKIE_NAME } from '../../../lib/session';
import { isPathAllowed } from '../../../lib/proxy-utils';
import { validateFileMagicBytes, sanitizeSvg } from '../../../lib/security-utils';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Resolve credentials from session
    const sessionToken = cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    const session = await verifySession(sessionToken);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Session expired' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    const creds = resolveGitCredentials(session);
    const config = createGitConfig(creds.token, creds.repo);

    const formData = await request.formData();
    const path = formData.get('path')?.toString();
    const file = formData.get('file') as File | null;
    const commitMessage = formData.get('commitMessage')?.toString() || 'Upload file';
    let sha = formData.get('sha')?.toString() || undefined;

    if (!path || !file) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: path, file' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // @para-doc [#csa-cms-path-val-upload-proxy-caller]
    if (!isPathAllowed(path)) {
      return new Response(
        JSON.stringify({ error: `Upload path "${path}" is not allowed` }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // P2: File type validation
    const ALLOWED_UPLOAD_TYPES = new Set([
      'image/jpeg', 'image/png', 'image/webp',
      'image/gif', 'image/svg+xml', 'image/avif',
      'text/markdown', 'text/plain',
      'application/octet-stream', // Some browsers send this for .md files
    ]);
    if (file.type && !ALLOWED_UPLOAD_TYPES.has(file.type)) {
      return new Response(
        JSON.stringify({ error: `File type "${file.type}" not allowed` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // P2: File size validation (10MB max)
    const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_UPLOAD_SIZE) {
      return new Response(
        JSON.stringify({ error: `File too large (max 10MB, got ${(file.size / 1024 / 1024).toFixed(1)}MB)` }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const extension = path.split('.').pop() || '';

    // Validate image magic bytes
    const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif']);
    if (imageExtensions.has(extension.toLowerCase())) {
      const isValidMagic = validateFileMagicBytes(bytes, extension);
      if (!isValidMagic) {
        return new Response(
          JSON.stringify({ error: `File verification failed: invalid magic bytes signature for extension ".${extension}"` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // @para-doc [#csa-cms-sec-log-upload]
    console.info(`[upload] Validation passed for file: ${file.name || path}, size: ${file.size} bytes, type: ${file.type}, ext: .${extension}`);

    // Sanitize SVG content
    let finalBytes = bytes;
    if (extension.toLowerCase() === 'svg' || file.type === 'image/svg+xml') {
      const textDecoder = new TextDecoder('utf-8');
      const svgContent = textDecoder.decode(bytes);
      const cleanSvg = sanitizeSvg(svgContent);
      const textEncoder = new TextEncoder();
      finalBytes = textEncoder.encode(cleanSvg);
    }

    // Convert to base64
    let binary = '';
    for (let i = 0; i < finalBytes.length; i++) {
      binary += String.fromCharCode(finalBytes[i]);
    }
    const base64Content = btoa(binary);

    // If no SHA provided, try to get existing file SHA (for update)
    if (!sha) {
      sha = (await getFileSha(config, path)) || undefined;
    }

    const result = await uploadFile(config, path, base64Content, commitMessage, sha);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[proxy/upload] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Upload failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
