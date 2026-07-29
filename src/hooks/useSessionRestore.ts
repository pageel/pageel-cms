/**
 * useSessionRestore Hook — v2.0 (Env Auth Only)
 *
 * Simplified: No token paste mode, no crypto, no localStorage.
 * Server handles auth via cookie, client uses ProxyGitAdapter.
 */

import { useEffect, useCallback, useRef } from 'react';
import { ServiceType } from '../types';
import { ProxyGitAdapter, CloudflareChallengeError, UpstreamAuthError } from '../services/proxyGitService';
import { useAuthStore } from '../features/auth/store';

export function useSessionRestore() {
  const {
    setUser,
    setRepo,
    setGitService,
    setServiceType,
    setLoading,
    setIsLoggingOut,
    setError,
    clearAuth,
  } = useAuthStore();

  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // // @para-doc [#csa-cms-client-logout-post]
  // // @para-doc [#csa-cms-cfr-logout-resilience]
  const performSimpleLogout = useCallback(async () => {
    // Preserve React Zustand state during page unload to prevent session error flash
    setIsLoggingOut(true);

    // Timeout Watchdog fallback: force navigate after 1.5s if POST form submit unresponsively hangs
    setTimeout(() => {
      window.location.href = '/login?logout=true';
    }, 1500);

    // Redirect browser to logout endpoint to clear all session cookies (local + sso)
    const getCookie = (name: string): string | undefined => {
      const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
      if (match) return decodeURIComponent(match[2]);
    };

    const csrfToken = getCookie('pageel_cms_csrf');
    if (csrfToken) {
      try {
        // // @para-doc [#csa-cms-cfr-logout-fallback-impl]
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = `/api/auth/logout?csrf_token=${encodeURIComponent(csrfToken)}`;

        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'csrf_token';
        input.value = csrfToken;
        form.appendChild(input);

        document.body.appendChild(form);
        form.submit();
      } catch (err) {
        console.warn('POST form submit failed during logout, falling back to GET:', err);
        window.location.href = '/login?logout=true';
      }
    } else {
      // CSRF cookie missing (Astro may drop it on SSO callback redirect).
      // Navigate to login with logout flag so the server clears the session cookie.
      window.location.href = '/login?logout=true';
    }
  }, [setIsLoggingOut]);

  // Listen for auth-error events (401 from API proxy)
  useEffect(() => {
    const handleAuthError = () => {
      performSimpleLogout();
    };
    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, [performSimpleLogout]);

  // // @para-doc [#csa-cms-cfr-retry-impl]
  const initSessionWithRetry = useCallback(async (attempt: number = 1): Promise<void> => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    setLoading(true);
    setError(null);

    try {
      const proxyAdapter = new ProxyGitAdapter();
      const repoData = await proxyAdapter.getRepoDetails();

      const owner = repoData?.owner?.login || 'user';
      const service: ServiceType = 'github';

      const userData = {
        login: owner,
        avatar_url: `https://github.com/${owner}.png`,
        html_url: `https://github.com/${owner}`,
        name: owner,
      };

      setUser(userData);
      setRepo(repoData);
      setGitService(proxyAdapter);
      setServiceType(service);
    } catch (e: any) {
      console.error(`Session init failed (attempt ${attempt}):`, e);

      if (e instanceof UpstreamAuthError || e?.isUpstreamAuth) {
        console.warn(`Upstream Auth failure (${e.code}): redirecting to login...`);
        window.location.href = `/login?logout=true&error=${encodeURIComponent(e.code || 'GITHUB_TOKEN_EXPIRED')}`;
        return;
      }

      if (e instanceof CloudflareChallengeError || e?.isCloudflareChallenge) {
        // // @para-doc [#csa-cms-cfr-retry-backoff]
        if (attempt <= 3) {
          const backoffDelay = Math.pow(3, attempt - 1) * 1000; // 1s, 3s, 9s
          console.warn(`Cloudflare Challenge detected. Retrying in ${backoffDelay / 1000}s (Attempt ${attempt}/3)...`);

          retryTimerRef.current = setTimeout(() => {
            initSessionWithRetry(attempt + 1);
          }, backoffDelay);
          return;
        }

        // // @para-doc [#csa-cms-cfr-no-blind-redirect]
        setError('cloudflare_challenge');
      } else {
        setError('Failed to initialize CMS session');
        window.location.href = '/login';
      }
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setUser, setRepo, setGitService, setServiceType]);

  // Initialize session on mount
  useEffect(() => {
    initSessionWithRetry(1);
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, [initSessionWithRetry]);

  // // @para-doc [#csa-cms-cfr-retry-export]
  const retryInit = useCallback(() => {
    initSessionWithRetry(1);
  }, [initSessionWithRetry]);

  const handleLogin = useCallback(async () => {}, []);

  return {
    handleLogin,
    performSimpleLogout,
    retryInit,
  };
}

