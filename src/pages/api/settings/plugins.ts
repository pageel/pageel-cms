import type { APIRoute } from 'astro';
import { verifySession, resolveGitCredentials, COOKIE_NAME } from '../../../lib/session';
import { createGitConfig, getFileContent, updateFileContent, createFileFromString, getFileSha } from '../../../lib/git-client';
import { isValidPluginName, SUPPORTED_PLUGINS } from '../../../plugins/registry';

const PAGEELRC_PATH = '.pageelrc.json';


function sanitizePayload(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  const safeObj: any = Array.isArray(obj) ? [] : {};
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    safeObj[key] = sanitizePayload(obj[key]);
  }
  return safeObj;
}

function getObjectDepth(obj: any): number {
  if (obj === null || typeof obj !== 'object') {
    return 0;
  }
  let maxDepth = 0;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object') {
      maxDepth = Math.max(maxDepth, getObjectDepth(obj[key]));
    }
  }
  return maxDepth + 1;
}

// @para-doc [#csa-plugins-api-validation]
// @para-doc [#csa-plugins-api-settings-merge]
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const sessionToken = cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return new Response('Unauthorized', { status: 401 });
    }

    const session = await verifySession(sessionToken);
    if (!session) {
      return new Response('Session expired', { status: 401 });
    }

    // Limit payload size to 50KB
    const rawBody = await request.text();
    if (rawBody.length > 50 * 1024) {
      return new Response('Payload too large', { status: 400 });
    }

    const payload = JSON.parse(rawBody);

    // Limit payload depth to 3
    if (getObjectDepth(payload) > 3) {
      return new Response('Payload depth exceeded', { status: 400 });
    }

    const sanitizedPayload = sanitizePayload(payload);
    const { editor, settings, enabled } = sanitizedPayload;

    // Validate allowed editors dynamically
    if (editor !== null && editor !== undefined && !isValidPluginName(editor)) {
      return new Response('Invalid editor plugin', { status: 400 });
    }

    // @para-doc [#csa-plugins-api-dev-guard]
    if (editor) {
      const targetPlugin = SUPPORTED_PLUGINS.find(p => p.id === editor);
      const isDevMode = process.env.NODE_ENV !== 'production' || process.env.CMS_DEBUG === 'true';
      if (targetPlugin?.status === 'dev' && !isDevMode) {
        return new Response(
          JSON.stringify({
            error: 'PLUGINS_DEV_MODE_RESTRICTED',
            message: 'Plugin đang ở chế độ Dev Mode, chỉ cho phép kích hoạt khi CMS_DEBUG=true'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }


    const creds = resolveGitCredentials(session);
    const config = createGitConfig(creds.token, creds.repo);

    let currentConfig: any = {};
    let sha: string | null = null;

    try {
      sha = await getFileSha(config, PAGEELRC_PATH);
      if (sha) {
        const fileData = await getFileContent(config, PAGEELRC_PATH);
        if (fileData) {
          currentConfig = JSON.parse(fileData);
        }
      }
    } catch (err) {
      // file might not exist, ignore and use empty object
    }

    // Merge plugins
    if (!currentConfig.plugins) {
      currentConfig.plugins = {};
    }
    
    if (enabled !== undefined) {
      currentConfig.plugins.enabled = enabled;
    }

    if (editor !== undefined) {
      if (editor) {
        currentConfig.plugins.editor = editor;
      } else {
        delete currentConfig.plugins.editor;
      }
    }

    if (settings !== undefined) {
      currentConfig.plugins.settings = settings;
    }

    const newContent = JSON.stringify(currentConfig, null, 2);
    const commitMessage = `chore(config): update editor plugin settings`;

    if (sha) {
      await updateFileContent(config, PAGEELRC_PATH, newContent, commitMessage, sha);
    } else {
      await createFileFromString(config, PAGEELRC_PATH, newContent, commitMessage);
    }

    return new Response(JSON.stringify({ success: true, config: currentConfig }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[settings/plugins] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to update plugin settings' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
