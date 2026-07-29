import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProxyGitAdapter, CloudflareChallengeError, UpstreamAuthError } from '../src/services/proxyGitService';

describe('ProxyGitAdapter Unit Tests', () => {
  let adapter: ProxyGitAdapter;

  beforeEach(() => {
    adapter = new ProxyGitAdapter();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // // @para-doc [#csa-cms-cfr-error-classification]
  it('throws CloudflareChallengeError when response is HTML (text/html)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 403,
      ok: false,
      headers: {
        get: (header: string) => (header.toLowerCase() === 'content-type' ? 'text/html; charset=UTF-8' : null),
      },
      text: () => Promise.resolve('<html>Cloudflare Under Attack</html>'),
    } as any));

    await expect(adapter.getRepoDetails()).rejects.toThrow(CloudflareChallengeError);
  });

  // // @para-doc [#csa-cms-cfr-error-class-impl]
  it('creates CloudflareChallengeError with correct prototype and properties', () => {
    const err = new CloudflareChallengeError('Challenge required');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CloudflareChallengeError);
    expect(err.name).toBe('CloudflareChallengeError');
    expect(err.isCloudflareChallenge).toBe(true);
  });

  it('throws UpstreamAuthError with GITHUB_TOKEN_EXPIRED code when status is 401 JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      headers: {
        get: (header: string) => (header.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      json: () => Promise.resolve({ error: 'Bad credentials', code: 'GITHUB_TOKEN_EXPIRED' }),
    } as any));

    await expect(adapter.getRepoDetails()).rejects.toThrow(UpstreamAuthError);

    try {
      await adapter.getRepoDetails();
    } catch (err: any) {
      expect(err.code).toBe('GITHUB_TOKEN_EXPIRED');
      expect(err.isUpstreamAuth).toBe(true);
    }
  });

  it('throws UpstreamAuthError with REPO_ACCESS_DENIED when status is 403 JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 403,
      ok: false,
      headers: {
        get: (header: string) => (header.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      json: () => Promise.resolve({ error: 'Access denied', code: 'REPO_ACCESS_DENIED' }),
    } as any));

    await expect(adapter.getRepoDetails()).rejects.toThrow(UpstreamAuthError);

    try {
      await adapter.getRepoDetails();
    } catch (err: any) {
      expect(err.code).toBe('REPO_ACCESS_DENIED');
    }
  });

  it('dispatches auth-error event on 401 status when window is available', async () => {
    const dispatchSpy = vi.fn();
    vi.stubGlobal('window', { dispatchEvent: dispatchSpy });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      headers: {
        get: (header: string) => (header.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      json: () => Promise.resolve({ error: 'Session expired' }),
    } as any));

    await expect(adapter.getRepoDetails()).rejects.toThrow(UpstreamAuthError);
    expect(dispatchSpy).toHaveBeenCalledWith(expect.any(Object));
  });
});
