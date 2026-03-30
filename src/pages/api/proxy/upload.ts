/**
 * POST /api/proxy/upload
 * FormData proxy for file upload via Git API
 * 
 * v2.1: Uses session-resolved Git credentials
 */

import type { APIRoute } from 'astro';
import { uploadFile, getFileSha, createGitConfig } from '../../../lib/git-client';
import { verifySession, resolveGitCredentials, COOKIE_NAME } from '../../../lib/session';

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

    // P1: Path validation — block dangerous upload paths
    const BLOCKED_PATHS = [
      /^\.\.\//,                                         // Path traversal
      /^\.\//,                                           // Relative paths
      /^\.env/,                                          // Config files
      /^\.github\//,                                     // CI/CD
      /^\.git\//,                                        // Git internals
      /^src\//,                                          // Source code
      /^node_modules\//,                                 // Dependencies
      /\.(ts|tsx|js|jsx|mjs|cjs|sh|yml|yaml|toml)$/i,   // Code files
    ];
    const normalizedPath = path.replace(/^\/+/, '');
    if (BLOCKED_PATHS.some(pattern => pattern.test(normalizedPath))) {
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

    // Read file as base64
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
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
