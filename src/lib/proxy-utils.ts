import { getFileAsBlob, createGitConfig } from './git-client';
import { resolveGitCredentials, verifySession } from './session';

export const BLOCKED_PATHS = [
  /^\.\.\//,                                         // Path traversal
  /^\.\//,                                           // Relative paths
  /^\.env/,                                          // Config files
  /^\.github\//,                                     // CI/CD
  /^\.git\//,                                        // Git internals
  /^src\//,                                          // Source code
  /^node_modules\//,                                 // Dependencies
  /\.(ts|tsx|js|jsx|mjs|cjs|sh|yml|yaml|toml)$/i,    // Code files
];

export function isPathAllowed(path: string): boolean {
  const normalizedPath = path.replace(/^\/+/, '');
  return !BLOCKED_PATHS.some(pattern => pattern.test(normalizedPath));
}

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

export function getMimeType(filepath: string): string {
  const ext = filepath.substring(filepath.lastIndexOf('.')).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export async function createAuthenticatedBlobResponse(
  sessionToken: string,
  filePath: string,
  tryPublicFallback: boolean = false
): Promise<Response> {
  const session = await verifySession(sessionToken);
  if (!session) {
    return new Response('Session expired', { status: 401 });
  }

  const creds = resolveGitCredentials(session);
  const config = createGitConfig(creds.token, creds.repo);
  const decodedPath = decodeURIComponent(filePath);

  if (!isPathAllowed(decodedPath)) {
    return new Response('Path not allowed', { status: 403 });
  }

  try {
    const upstreamResponse = await getFileAsBlob(config, decodedPath);
    const contentType = getMimeType(decodedPath);

    return new Response(upstreamResponse.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    // Thử tìm trong public/ nếu cho phép fallback và lỗi là Not Found
    if (tryPublicFallback && (error.message?.includes('404') || error.status === 404)) {
      if (!decodedPath.startsWith('public/')) {
        const publicPath = `public/${decodedPath.replace(/^\//, '')}`;
        try {
          const fallbackResponse = await getFileAsBlob(config, publicPath);
          const contentType = getMimeType(publicPath);

          return new Response(fallbackResponse.body, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=3600',
            },
          });
        } catch (fallbackError) {
          // ignore error and throw the original one
        }
      }
    }

    console.error(`[proxy] Blob fetch failed for ${decodedPath}:`, error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Blob fetch failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
