/**
 * ProxyGitAdapter — implements IGitService via server-side proxy
 * 
 * Used in Env Auth mode (Mode 3):
 * - All Git operations go through /api/proxy/* endpoints
 * - Client never has access to the Git token
 * - Server handles authentication via session cookie
 * 
 * ⚠️ IMPORTANT: This adapter `implements` IGitService, NOT `extends` BaseGitService
 */

import type { IGitService, ContentInfo, RepoTreeInfo, RepoInfo } from '../types';

// @para-doc [#csa-cms-cfr-error-class-impl]
export class CloudflareChallengeError extends Error {
  readonly isCloudflareChallenge: boolean = true;
  constructor(message: string = 'Cloudflare challenge required') {
    super(message);
    this.name = 'CloudflareChallengeError';
  }
}

export class UpstreamAuthError extends Error {
  readonly isUpstreamAuth: boolean = true;
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'UpstreamAuthError';
  }
}

export class ProxyGitAdapter implements IGitService {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    // Base URL for proxy endpoints (empty = same origin)
    this.baseUrl = baseUrl;
  }

  // --- Private helpers ---

  private async proxyJsonCall(action: string, params: Record<string, any> = {}): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/proxy/git`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Send session cookie
      body: JSON.stringify({ action, params }),
    });

    const contentType = response.headers.get('content-type') || '';

    // 1. Content-Type guard: detect CF challenge HTML response
    // // @para-doc [#csa-cms-cfr-error-classification]
    if (contentType.includes('text/html') || (!contentType.includes('application/json') && contentType !== '')) {
      throw new CloudflareChallengeError(`Cloudflare challenge detected (${response.status})`);
    }

    // 2. Handle 401 / 403 Auth errors from proxy or upstream GitHub API
    if (response.status === 401 || response.status === 403) {
      const errData = await response.json().catch(() => ({}));
      if (errData.code) {
        throw new UpstreamAuthError(errData.code, errData.error || 'Upstream auth failed');
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth-error'));
      }
      throw new UpstreamAuthError('GITHUB_TOKEN_EXPIRED', 'Session expired or token invalid');
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Proxy error' }));
      throw new Error(err.error || `Proxy error: ${response.status}`);
    }

    return response.json();
  }

  // --- IGitService implementation (12 JSON methods via /api/proxy/git) ---

  async getRepoContents(path: string): Promise<ContentInfo[]> {
    return this.proxyJsonCall('getRepoContents', { path });
  }

  async listFiles(path: string): Promise<RepoTreeInfo[]> {
    return this.proxyJsonCall('listFiles', { path });
  }

  async getFileContent(path: string): Promise<string> {
    return this.proxyJsonCall('getFileContent', { path });
  }

  async getFileSha(path: string): Promise<string | null> {
    return this.proxyJsonCall('getFileSha', { path });
  }

  async createFileFromString(path: string, content: string, commitMessage: string): Promise<any> {
    return this.proxyJsonCall('createFileFromString', { path, content, commitMessage });
  }

  async updateFileContent(path: string, content: string, commitMessage: string, sha: string): Promise<any> {
    return this.proxyJsonCall('updateFileContent', { path, content, commitMessage, sha });
  }

  async deleteFile(path: string, sha: string, commitMessage: string): Promise<any> {
    return this.proxyJsonCall('deleteFile', { path, sha, commitMessage });
  }

  async scanForContentDirectories(): Promise<string[]> {
    return this.proxyJsonCall('scanForContentDirectories');
  }

  async scanForImageDirectories(): Promise<string[]> {
    return this.proxyJsonCall('scanForImageDirectories');
  }

  async findProductionUrl(): Promise<string | null> {
    return this.proxyJsonCall('findProductionUrl');
  }

  async getRepoTree(path?: string): Promise<RepoTreeInfo[]> {
    return this.proxyJsonCall('getRepoTree', { path });
  }

  async getRepoDetails(): Promise<RepoInfo> {
    return this.proxyJsonCall('getRepoDetails');
  }

  // --- Special methods via dedicated endpoints ---

  async uploadFile(path: string, file: File, commitMessage: string, sha?: string): Promise<any> {
    const formData = new FormData();
    formData.append('path', path);
    formData.append('file', file);
    formData.append('commitMessage', commitMessage);
    if (sha) formData.append('sha', sha);

    const response = await fetch(`${this.baseUrl}/api/proxy/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
      // Note: Don't set Content-Type header — browser sets multipart boundary
    });

    if (response.status === 401) {
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Upload error' }));
      throw new Error(err.error || `Upload error: ${response.status}`);
    }

    return response.json();
  }

  async getFileAsBlob(path: string): Promise<Blob> {
    const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/');
    const response = await fetch(`${this.baseUrl}/api/proxy/blob/${encodedPath}`, {
      credentials: 'include',
    });

    if (response.status === 401) {
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    if (!response.ok) {
      throw new Error(`Blob fetch error: ${response.status}`);
    }

    return response.blob();
  }
}
