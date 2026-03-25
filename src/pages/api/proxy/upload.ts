/**
 * POST /api/proxy/upload
 * FormData proxy for file upload via Git API
 */

import type { APIRoute } from 'astro';
import { uploadFile, getFileSha } from '../../../lib/git-client';

export const POST: APIRoute = async ({ request }) => {
  try {
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
      sha = (await getFileSha(path)) || undefined;
    }

    const result = await uploadFile(path, base64Content, commitMessage, sha);

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
