/**
 * useSessionRestore Hook — v2.0 (Env Auth Only)
 *
 * Simplified: No token paste mode, no crypto, no localStorage.
 * Server handles auth via cookie, client uses ProxyGitAdapter.
 */

import { useEffect, useCallback } from 'react';
import { ServiceType } from '../types';
import { ProxyGitAdapter } from '../services/proxyGitService';
import { useAuthStore } from '../features/auth/store';

export function useSessionRestore() {
  const {
    setUser,
    setRepo,
    setGitService,
    setServiceType,
    setLoading,
    setError,
    clearAuth,
  } = useAuthStore();

  const performSimpleLogout = useCallback(async () => {
    clearAuth();
    // POST to server to clear session cookie
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch { /* ignore */ }
    window.location.href = '/login';
  }, [clearAuth]);

  // Listen for auth-error events (401 from API proxy)
  useEffect(() => {
    const handleAuthError = () => {
      performSimpleLogout();
    };
    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, [performSimpleLogout]);

  // Initialize session on mount — server already authenticated via cookie
  useEffect(() => {
    const initSession = async () => {
      setLoading(true);
      try {
        // Create proxy adapter (all Git ops go through server)
        const proxyAdapter = new ProxyGitAdapter();

        // Fetch repo details via server proxy to get real data
        const repoData = await proxyAdapter.getRepoDetails();

        // Derive user info from repo data
        const owner = repoData?.owner?.login || 'user';
        const service: ServiceType = 'github'; // TODO: read from server config

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
      } catch (e) {
        console.error('Session init failed:', e);
        setError('Failed to initialize CMS session');
        // Likely auth expired — redirect to login
        window.location.href = '/login';
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, []);

  // handleLogin is no longer needed (server handles via /api/auth/login)
  // Keep stub for interface compat during migration
  const handleLogin = useCallback(async () => {
    // No-op: login is handled by server-side form POST
  }, []);

  return {
    handleLogin,
    performSimpleLogout,
  };
}
