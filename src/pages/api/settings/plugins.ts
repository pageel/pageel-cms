import type { APIRoute } from 'astro';
import { verifySession, resolveGitCredentials, COOKIE_NAME } from '../../../lib/session';
import { createGitConfig, getFileContent, updateFileContent, createFileFromString, getFileSha } from '../../../lib/git-client';

const PAGEELRC_PATH = '.pageelrc.json';

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

    const payload = await request.json();
    const { editor } = payload;

    // Validate allowed editors
    if (editor !== null && editor !== '@pageel/plugin-mdx') {
      return new Response('Invalid editor plugin', { status: 400 });
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
    
    if (editor) {
      currentConfig.plugins.editor = editor;
    } else {
      delete currentConfig.plugins.editor;
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
