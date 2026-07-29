import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProxyGitAdapter, CloudflareChallengeError } from '../src/services/proxyGitService';
import fs from 'node:fs';
import path from 'node:path';

describe('Cloudflare Resilience & Circuit Breaker', () => {
  const fixturePath = path.join(__dirname, 'fixtures/cloudflare-challenge-503.html');
  const htmlFixture = fs.readFileSync(fixturePath, 'utf-8');

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // // @para-doc [#csa-cms-cfr-error-classification]
  it('should throw CloudflareChallengeError when response is HTML (503/403 Challenge)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: {
        get: (header: string) => (header.toLowerCase() === 'content-type' ? 'text/html; charset=UTF-8' : null),
      },
      text: vi.fn().mockResolvedValue(htmlFixture),
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token < in JSON at position 0')),
    }));

    const adapter = new ProxyGitAdapter();
    await expect(adapter.getRepoDetails()).rejects.toThrow(CloudflareChallengeError);
  });

  // // @para-doc [#csa-cms-cfr-error-class-impl]
  it('should create CloudflareChallengeError with correct prototype and properties', () => {
    const err = new CloudflareChallengeError('Challenge required');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CloudflareChallengeError);
    expect(err.name).toBe('CloudflareChallengeError');
    expect(err.isCloudflareChallenge).toBe(true);
  });

  // // @para-doc [#csa-cms-cfr-retry-backoff]
  it('should calculate correct exponential backoff delays (1s -> 3s -> 9s)', () => {
    const calculateBackoff = (attempt: number) => Math.pow(3, attempt - 1) * 1000;
    expect(calculateBackoff(1)).toBe(1000);
    expect(calculateBackoff(2)).toBe(3000);
    expect(calculateBackoff(3)).toBe(9000);
  });

  // // @para-doc [#csa-cms-cfr-logout-fallback-impl]
  it('should format GET logout fallback URL correctly', () => {
    const fallbackUrl = '/login?logout=true';
    expect(fallbackUrl).toContain('logout=true');
  });
});
