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

describe('Connect Mode Token Autofill Protection (login.astro logic)', () => {
  /**
   * Helper replicating login.astro Connect Mode token input attributes
   * // @para-doc [#csa-cms-cfr-form-clear-autofill]
   */
  function getTokenInputAttributes(rawError: string) {
    const isTokenExpired = rawError === 'GITHUB_TOKEN_EXPIRED';
    return {
      autocomplete: isTokenExpired ? 'off' : 'current-password',
      value: isTokenExpired ? '' : undefined,
      showTokenExpiredHint: isTokenExpired,
    };
  }

  it('should set autocomplete="off", empty value, and show hint link when token is expired', () => {
    const attrs = getTokenInputAttributes('GITHUB_TOKEN_EXPIRED');
    expect(attrs.autocomplete).toBe('off');
    expect(attrs.value).toBe('');
    expect(attrs.showTokenExpiredHint).toBe(true);
  });

  it('should preserve default autocomplete and undefined value when no error', () => {
    const attrs = getTokenInputAttributes('');
    expect(attrs.autocomplete).toBe('current-password');
    expect(attrs.value).toBeUndefined();
    expect(attrs.showTokenExpiredHint).toBe(false);
  });
});

describe('Server Mode Env Error Diagnostic (login.astro logic)', () => {
  /**
   * Helper replicating login.astro Server Mode env warning condition
   * // @para-doc [#csa-cms-cfr-server-env-hint]
   */
  function shouldShowServerEnvWarning(envGitConfigured: boolean, rawError: string) {
    const isTokenExpired = rawError === 'GITHUB_TOKEN_EXPIRED';
    return envGitConfigured && isTokenExpired;
  }

  it('should return true when Server Mode is active and token is expired', () => {
    expect(shouldShowServerEnvWarning(true, 'GITHUB_TOKEN_EXPIRED')).toBe(true);
  });

  it('should return false when Server Mode is not active or token is not expired', () => {
    expect(shouldShowServerEnvWarning(false, 'GITHUB_TOKEN_EXPIRED')).toBe(false);
    expect(shouldShowServerEnvWarning(true, 'REPO_ACCESS_DENIED')).toBe(false);
  });
});

