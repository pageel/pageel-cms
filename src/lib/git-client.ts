/**
 * Git API Client — Server-side GitHub/Gitea/Gogs API calls
 * 
 * v2.1: Refactored to accept credentials as constructor params
 *       instead of reading global env vars. This enables multi-tenant
 *       where each user session has its own token/repo.
 */

const GITHUB_API = 'https://api.github.com';

export interface GitClientConfig {
  token: string;
  owner: string;
  repo: string;
  service: string;
  instanceUrl?: string;
}

/**
 * Create a GitClientConfig from token + repo string.
 * Falls back to env vars if not provided.
 */
export function createGitConfig(token?: string, repo?: string): GitClientConfig {
  const resolvedToken = token || import.meta.env.GITHUB_TOKEN || '';
  const resolvedRepo = repo || import.meta.env.CMS_REPO || '';
  const service = import.meta.env.CMS_SERVICE || 'github';
  const instanceUrl = import.meta.env.CMS_INSTANCE_URL || '';
  const [owner, repoName] = resolvedRepo.split('/');

  if (!resolvedToken || !owner || !repoName) {
    throw new Error('Missing Git credentials (token or repo)');
  }

  return { token: resolvedToken, owner, repo: repoName, service, instanceUrl };
}

function getBaseUrl(config: GitClientConfig): string {
  if (config.service === 'gitea' || config.service === 'gogs') {
    return `${config.instanceUrl}/api/v1`;
  }
  return GITHUB_API;
}

async function apiCall(config: GitClientConfig, path: string, options: RequestInit = {}): Promise<any> {
  const baseUrl = getBaseUrl(config);
  const url = `${baseUrl}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `token ${config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Git API ${response.status}: ${text}`);
  }

  // Handle empty responses (e.g., DELETE)
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

function repoPath(config: GitClientConfig): string {
  return `/repos/${config.owner}/${config.repo}`;
}

// --- Exported API methods (all accept config as first param) ---

export async function verifyTokenAccess(config: GitClientConfig): Promise<boolean> {
  try {
    await apiCall(config, `${repoPath(config)}`);
    return true;
  } catch {
    return false;
  }
}

export async function getRepoContents(config: GitClientConfig, path: string) {
  return apiCall(config, `${repoPath(config)}/contents/${path}`);
}

export async function listFiles(config: GitClientConfig, path: string) {
  const tree = await apiCall(config, `${repoPath(config)}/git/trees/HEAD?recursive=1`);
  const items = (tree.tree || [])
    .filter((item: any) => item.path.startsWith(path) && item.path !== path)
    .map((item: any) => ({
      path: item.path,
      name: item.path.split('/').pop(),
      type: item.type === 'tree' ? 'dir' : 'file',
      sha: item.sha,
      size: item.size,
    }));
  return items;
}

export async function getFileContent(config: GitClientConfig, path: string) {
  const cacheBuster = `_t=${Date.now()}`;
  const querySymbol = path.includes('?') ? '&' : '?';
  const data = await apiCall(config, `${repoPath(config)}/contents/${path}${querySymbol}${cacheBuster}`);
  if (data.content && data.encoding === 'base64') {
    const binary = atob(data.content.replace(/\n/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
  return data.content || '';
}

export async function getFileSha(config: GitClientConfig, path: string): Promise<string | null> {
  try {
    const cacheBuster = `_t=${Date.now()}`;
    const querySymbol = path.includes('?') ? '&' : '?';
    const data = await apiCall(config, `${repoPath(config)}/contents/${path}${querySymbol}${cacheBuster}`);
    return data.sha || null;
  } catch {
    return null;
  }
}

export async function createFileFromString(config: GitClientConfig, path: string, content: string, commitMessage: string) {
  return apiCall(config, `${repoPath(config)}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: commitMessage,
      content: btoa(unescape(encodeURIComponent(content))),
    }),
  });
}

export async function updateFileContent(config: GitClientConfig, path: string, content: string, commitMessage: string, sha: string) {
  return apiCall(config, `${repoPath(config)}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: commitMessage,
      content: btoa(unescape(encodeURIComponent(content))),
      sha: sha,
    }),
  });
}

export async function deleteFile(config: GitClientConfig, path: string, sha: string, commitMessage: string) {
  return apiCall(config, `${repoPath(config)}/contents/${path}`, {
    method: 'DELETE',
    body: JSON.stringify({
      message: commitMessage,
      sha: sha,
    }),
  });
}

export async function scanForContentDirectories(config: GitClientConfig): Promise<string[]> {
  try {
    const tree = await apiCall(config, `${repoPath(config)}/git/trees/HEAD?recursive=1`);
    const dirs = new Set<string>();
    for (const item of tree.tree || []) {
      if (item.type === 'blob' && /\.(md|mdx)$/i.test(item.path)) {
        const dir = item.path.substring(0, item.path.lastIndexOf('/'));
        if (dir) dirs.add(dir);
      }
    }
    return Array.from(dirs);
  } catch {
    return [];
  }
}

export async function scanForImageDirectories(config: GitClientConfig): Promise<string[]> {
  try {
    const tree = await apiCall(config, `${repoPath(config)}/git/trees/HEAD?recursive=1`);
    const dirs = new Set<string>();
    for (const item of tree.tree || []) {
      if (item.type === 'blob' && /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(item.path)) {
        const dir = item.path.substring(0, item.path.lastIndexOf('/'));
        if (dir) dirs.add(dir);
      }
    }
    return Array.from(dirs);
  } catch {
    return [];
  }
}

export async function findProductionUrl(config: GitClientConfig): Promise<string | null> {
  try {
    const content = await getFileContent(config, 'astro.config.mjs');
    const match = content.match(/site:\s*['"]([^'"]+)['"]/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export async function getRepoTree(config: GitClientConfig, path?: string) {
  const treePath = path || 'HEAD';
  const data = await apiCall(config, `${repoPath(config)}/git/trees/${treePath}?recursive=1`);
  return (data.tree || []).map((item: any) => ({
    path: item.path,
    name: item.path.split('/').pop(),
    type: item.type === 'tree' ? 'dir' : 'file',
    sha: item.sha,
    size: item.size,
  }));
}

export async function getRepoDetails(config: GitClientConfig) {
  return apiCall(config, `${repoPath(config)}`);
}

export async function uploadFile(config: GitClientConfig, path: string, base64Content: string, commitMessage: string, sha?: string) {
  const body: any = {
    message: commitMessage,
    content: base64Content,
  };
  if (sha) body.sha = sha;

  return apiCall(config, `${repoPath(config)}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function getFileAsBlob(config: GitClientConfig, path: string): Promise<Response> {
  const baseUrl = getBaseUrl(config);
  
  // Use raw content endpoint
  let rawUrl: string;
  if (config.service === 'github') {
    rawUrl = `https://raw.githubusercontent.com/${config.owner}/${config.repo}/main/${path}`;
  } else {
    rawUrl = `${baseUrl}/repos/${config.owner}/${config.repo}/raw/${path}`;
  }

  const response = await fetch(rawUrl, {
    headers: {
      'Authorization': `token ${config.token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Blob fetch ${response.status}`);
  }

  return response;
}
