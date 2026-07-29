import { describe, it, expect } from 'vitest';

/**
 * Helper replicating logout.ts return_url construction logic
 * // @para-doc [#csa-cms-cfr-explicit-logout-url]
 */
export function computeLogoutRedirectUrl(workerUrl: string, origin: string, hasSso: boolean): string {
  if (!hasSso || !workerUrl) {
    return '/login';
  }
  const returnUrl = encodeURIComponent(`${origin}/login?logout=true`);
  return `${workerUrl}/api/auth/logout?return_url=${returnUrl}`;
}

describe('Logout Return URL Logic (logout.ts)', () => {
  it('should append ?logout=true to return_url when hasSso is true', () => {
    const workerUrl = 'https://app.pageel.com';
    const origin = 'http://localhost:4321';
    const result = computeLogoutRedirectUrl(workerUrl, origin, true);
    expect(result).toBe('https://app.pageel.com/api/auth/logout?return_url=http%3A%2F%2Flocalhost%3A4321%2Flogin%3Flogout%3Dtrue');
  });

  it('should return /login fallback when hasSso is false', () => {
    const workerUrl = '';
    const origin = 'http://localhost:4321';
    const result = computeLogoutRedirectUrl(workerUrl, origin, false);
    expect(result).toBe('/login');
  });
});

describe('Re-Auth Dual UI & Escape Hatch Logic (login.astro logic)', () => {
  /**
   * Helper replicating login.astro Dual UI decision logic
   * // @para-doc [#csa-cms-cfr-reauth-button-ui]
   * // @para-doc [#csa-cms-cfr-full-logout-escape-hatch]
   */
  function getDualUiState(rawError: string, isLogout: boolean) {
    const isTokenExpired = rawError === 'GITHUB_TOKEN_EXPIRED';
    const needsForceReauth = isTokenExpired || isLogout;
    return {
      needsForceReauth,
      buttonText: needsForceReauth ? 'Re-authenticate & Sign In ↗' : 'Sign In with Pageel App',
      showEscapeHatch: needsForceReauth,
      escapeHatchUrl: '/api/auth/logout?logout=true',
    };
  }

  it('should enable force reauth, set button text to "Re-authenticate & Sign In ↗", and show escape hatch when token is expired', () => {
    const state = getDualUiState('GITHUB_TOKEN_EXPIRED', false);
    expect(state.needsForceReauth).toBe(true);
    expect(state.buttonText).toBe('Re-authenticate & Sign In ↗');
    expect(state.showEscapeHatch).toBe(true);
    expect(state.escapeHatchUrl).toBe('/api/auth/logout?logout=true');
  });

  it('should enable force reauth and show escape hatch when isLogout is true', () => {
    const state = getDualUiState('', true);
    expect(state.needsForceReauth).toBe(true);
    expect(state.buttonText).toBe('Re-authenticate & Sign In ↗');
    expect(state.showEscapeHatch).toBe(true);
  });

  it('should show standard sign in button and no escape hatch on clean login page', () => {
    const state = getDualUiState('', false);
    expect(state.needsForceReauth).toBe(false);
    expect(state.buttonText).toBe('Sign In with Pageel App');
    expect(state.showEscapeHatch).toBe(false);
  });
});

describe('GET Logout Fallback Handler (logout.ts)', () => {
  it('should allow GET logout request, clear cookies and redirect with 302', async () => {
    const { GET } = await import('../src/pages/api/auth/logout');
    const mockRequest = new Request('http://localhost:4321/api/auth/logout?logout=true');
    const response = await GET({
      request: mockRequest,
      cookies: {
        get: () => undefined,
      },
      locals: {},
    } as any);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/login?logout=true');
  });
});


