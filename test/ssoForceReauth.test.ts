import { describe, it, expect } from 'vitest';

/**
 * Helper function replicating login.astro SSO Redirect URL computation
 * // @para-doc [#csa-cms-cfr-sso-force-reauth]
 */
export function computeSsoRedirectUrl(ssoRedirectUrl: string, rawError: string, hasSso: boolean): string {
  if (!hasSso || !ssoRedirectUrl) return '';
  const isTokenExpired = rawError === 'GITHUB_TOKEN_EXPIRED';
  const separator = ssoRedirectUrl.includes('?') ? '&' : '?';
  const ssoRedirectParams = isTokenExpired ? `${separator}force_reauth=true&prompt=consent` : '';
  return `${ssoRedirectUrl}${ssoRedirectParams}`;
}

describe('SSO Force Re-Authentication Protocol (login.astro logic)', () => {
  it('should append ?force_reauth=true&prompt=consent when rawError is GITHUB_TOKEN_EXPIRED and URL has no query string', () => {
    const baseUrl = 'https://app.pageel.com/auth/login';
    const result = computeSsoRedirectUrl(baseUrl, 'GITHUB_TOKEN_EXPIRED', true);
    expect(result).toBe('https://app.pageel.com/auth/login?force_reauth=true&prompt=consent');
  });

  it('should append &force_reauth=true&prompt=consent when ssoRedirectUrl already contains query parameters', () => {
    const baseUrl = 'https://app.pageel.com/auth/login?client_id=pageel-cms';
    const result = computeSsoRedirectUrl(baseUrl, 'GITHUB_TOKEN_EXPIRED', true);
    expect(result).toBe('https://app.pageel.com/auth/login?client_id=pageel-cms&force_reauth=true&prompt=consent');
  });

  it('should NOT append force_reauth params when rawError is empty or normal logout', () => {
    const baseUrl = 'https://app.pageel.com/auth/login';
    const resultNormal = computeSsoRedirectUrl(baseUrl, '', true);
    expect(resultNormal).toBe('https://app.pageel.com/auth/login');

    const resultOtherErr = computeSsoRedirectUrl(baseUrl, 'REPO_ACCESS_DENIED', true);
    expect(resultOtherErr).toBe('https://app.pageel.com/auth/login');
  });

  it('should return empty string when hasSso is false', () => {
    const baseUrl = 'https://app.pageel.com/auth/login';
    const result = computeSsoRedirectUrl(baseUrl, 'GITHUB_TOKEN_EXPIRED', false);
    expect(result).toBe('');
  });
});
