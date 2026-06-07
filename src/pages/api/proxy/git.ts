/**
 * POST /api/proxy/git
 * JSON proxy for IGitService methods (whitelist-controlled)
 * 
 * v2.1: Reads Git credentials from session (Dynamic Session Credentials)
 *       Falls back to env vars when session doesn't contain credentials.
 */

import type { APIRoute } from 'astro';
import * as git from '../../../lib/git-client';
import { verifySession, resolveGitCredentials, COOKIE_NAME } from '../../../lib/session';
import { isPathAllowed } from '../../../lib/proxy-utils';

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

const PATH_ACTIONS = new Set([
  'getRepoContents',
  'listFiles',
  'getFileContent',
  'getFileSha',
  'createFileFromString',
  'updateFileContent',
  'deleteFile',
  'getRepoTree',
]);

const PATH_REQUIRED_ACTIONS = new Set([
  'createFileFromString',
  'updateFileContent',
  'deleteFile',
]);

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
    const config = git.createGitConfig(creds.token, creds.repo);

    const body = await request.json();
    const { action, params = {} } = body;

    // Whitelist check
    if (!action || !ALLOWED_ACTIONS.has(action)) {
      return new Response(
        JSON.stringify({ error: `Action "${action}" is not allowed` }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (PATH_ACTIONS.has(action)) {
      const path = typeof params.path === 'string' ? params.path : '';

      if (PATH_REQUIRED_ACTIONS.has(action) && !path) {
        return new Response(
          JSON.stringify({ error: `Path is required for action "${action}"` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!isPathAllowed(path)) {
        return new Response(
          JSON.stringify({ error: `Path "${path}" is not allowed` }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      params.path = path;
    }

    let result: any;

    switch (action) {
      case 'scanForContentDirectories':
      case 'scanForImageDirectories':
        result = await (git as any)[action](config);
        break;

      case 'findProductionUrl':
      case 'getRepoDetails':
        result = await (git as any)[action](config);
        break;

      case 'getRepoContents':
      case 'listFiles':
      case 'getFileContent':
      case 'getFileSha':
        result = await (git as any)[action](config, params.path);
        break;

      case 'getRepoTree':
        result = await git.getRepoTree(config, params.path);
        break;

      case 'createFileFromString':
        result = await git.createFileFromString(config, params.path, params.content, params.commitMessage);
        break;

      case 'updateFileContent':
        result = await git.updateFileContent(config, params.path, params.content, params.commitMessage, params.sha);
        break;

      case 'deleteFile':
        result = await git.deleteFile(config, params.path, params.sha, params.commitMessage);
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
