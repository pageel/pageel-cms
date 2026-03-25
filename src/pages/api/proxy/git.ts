/**
 * POST /api/proxy/git
 * JSON proxy for IGitService methods (whitelist-controlled)
 * 
 * Request body: { action: string, params: Record<string, any> }
 * Response: JSON result from Git API
 */

import type { APIRoute } from 'astro';
import * as git from '../../../lib/git-client';

// Whitelist of allowed actions
const ALLOWED_ACTIONS = new Set([
  'getRepoContents',
  'listFiles',
  'getFileContent',
  'getFileSha',
  'createFileFromString',
  'updateFileContent',
  'deleteFile',
  'scanForContentDirectories',
  'scanForImageDirectories',
  'findProductionUrl',
  'getRepoTree',
  'getRepoDetails',
]);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, params = {} } = body;

    // Whitelist check
    if (!action || !ALLOWED_ACTIONS.has(action)) {
      return new Response(
        JSON.stringify({ error: `Action "${action}" is not allowed` }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let result: any;

    switch (action) {
      case 'scanForContentDirectories':
      case 'scanForImageDirectories':
      case 'findProductionUrl':
      case 'getRepoDetails':
        result = await (git as any)[action]();
        break;

      case 'getRepoContents':
      case 'listFiles':
      case 'getFileContent':
      case 'getFileSha':
        result = await (git as any)[action](params.path);
        break;

      case 'getRepoTree':
        result = await git.getRepoTree(params.path);
        break;

      case 'createFileFromString':
        result = await git.createFileFromString(params.path, params.content, params.commitMessage);
        break;

      case 'updateFileContent':
        result = await git.updateFileContent(params.path, params.content, params.commitMessage, params.sha);
        break;

      // ⚠️ deleteFile: sha at position 2!
      case 'deleteFile':
        result = await git.deleteFile(params.path, params.sha, params.commitMessage);
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Unhandled action' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[proxy/git] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal proxy error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
