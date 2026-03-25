/**
 * Git API Client — Server-side GitHub/Gitea/Gogs API calls
 * 
 * Standalone implementation (no dependency on core/)
 * Used by proxy endpoints to make Git API calls with server-side token
 */

const GITHUB_API = 'https://api.github.com';

interface GitClientConfig {
  token: string;
  owner: string;
  repo: string;
  service: string;
  instanceUrl?: string;
}

function getConfig(): GitClientConfig {
  const token = import.meta.env.GITHUB_TOKEN;
  const repoStr = import.meta.env.CMS_REPO || '';
  const service = import.meta.env.CMS_SERVICE || 'github';
  const instanceUrl = import.meta.env.CMS_INSTANCE_URL || '';
  const [owner, repo] = repoStr.split('/');

  if (!token || !owner || !repo) {
    throw new Error('Missing GITHUB_TOKEN or CMS_REPO env vars');
  }

  return { token, owner, repo, service, instanceUrl };
}

function getBaseUrl(config: GitClientConfig): string {
  if (config.service === 'gitea' || config.service === 'gogs') {
    return `${config.instanceUrl}/api/v1`;
  }
  return GITHUB_API;
}

async function apiCall(path: string, options: RequestInit = {}): Promise<any> {
  const config = getConfig();
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

function repoPath(config?: GitClientConfig): string {
  const c = config || getConfig();
  return `/repos/${c.owner}/${c.repo}`;
}

// --- Exported API methods ---

export async function getRepoContents(path: string) {
  const config = getConfig();
  return apiCall(`${repoPath(config)}/contents/${path}`);
}

export async function listFiles(path: string) {
  // Use tree API for optimized listing
  const config = getConfig();
  const tree = await apiCall(`${repoPath(config)}/git/trees/HEAD?recursive=1`);
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

export async function getFileContent(path: string) {
  const config = getConfig();
  const data = await apiCall(`${repoPath(config)}/contents/${path}`);
  if (data.content && data.encoding === 'base64') {
    // Proper UTF-8 decode (atob only handles ASCII)
    const binary = atob(data.content.replace(/\n/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
  return data.content || '';
}

export async function getFileSha(path: string): Promise<string | null> {
  try {
    const config = getConfig();
    const data = await apiCall(`${repoPath(config)}/contents/${path}`);
    return data.sha || null;
  } catch {
    return null;
  }
}

export async function createFileFromString(path: string, content: string, commitMessage: string) {
  const config = getConfig();
  return apiCall(`${repoPath(config)}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: commitMessage,
      content: btoa(unescape(encodeURIComponent(content))),
    }),
  });
}

export async function updateFileContent(path: string, content: string, commitMessage: string, sha: string) {
  const config = getConfig();
  return apiCall(`${repoPath(config)}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: commitMessage,
      content: btoa(unescape(encodeURIComponent(content))),
      sha: sha,
    }),
  });
}

export async function deleteFile(path: string, sha: string, commitMessage: string) {
  const config = getConfig();
  return apiCall(`${repoPath(config)}/contents/${path}`, {
    method: 'DELETE',
    body: JSON.stringify({
      message: commitMessage,
      sha: sha,
    }),
  });
}

export async function scanForContentDirectories(): Promise<string[]> {
  const config = getConfig();
  try {
    const tree = await apiCall(`${repoPath(config)}/git/trees/HEAD?recursive=1`);
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

export async function scanForImageDirectories(): Promise<string[]> {
  const config = getConfig();
  try {
    const tree = await apiCall(`${repoPath(config)}/git/trees/HEAD?recursive=1`);
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

export async function findProductionUrl(): Promise<string | null> {
  try {
    const content = await getFileContent('astro.config.mjs');
    const match = content.match(/site:\s*['"]([^'"]+)['"]/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export async function getRepoTree(path?: string) {
  const config = getConfig();
  const treePath = path || 'HEAD';
  const data = await apiCall(`${repoPath(config)}/git/trees/${treePath}?recursive=1`);
  return (data.tree || []).map((item: any) => ({
    path: item.path,
    name: item.path.split('/').pop(),
    type: item.type === 'tree' ? 'dir' : 'file',
    sha: item.sha,
    size: item.size,
  }));
}

export async function getRepoDetails() {
  const config = getConfig();
  return apiCall(`${repoPath(config)}`);
}

export async function uploadFile(path: string, base64Content: string, commitMessage: string, sha?: string) {
  const config = getConfig();
  const body: any = {
    message: commitMessage,
    content: base64Content,
  };
  if (sha) body.sha = sha;

  return apiCall(`${repoPath(config)}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function getFileAsBlob(path: string): Promise<Response> {
  const config = getConfig();
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
