/**
 * useSessionRestore Hook
 * 
 * TD-01/TD-02: Extracted from App.tsx.
 * Handles session restoration from localStorage (encrypted token).
 * Also provides handleLogin for new authentication.
 */

import { useEffect, useCallback } from 'react';
import { IGitService, ServiceType } from '../types';
import { verifyToken as verifyTokenGithub, getRepoDetails as getRepoDetailsGithub, GithubAdapter } from '../services/githubService';
import { verifyToken as verifyTokenGitea, getRepoDetails as getRepoDetailsGitea, GiteaAdapter } from '../services/giteaService';
import { verifyToken as verifyTokenGogs, getRepoDetails as getRepoDetailsGogs, GogsAdapter } from '../services/gogsService';
import { parseRepoUrl } from '../utils/parsing';
import { generateCryptoKey, exportCryptoKey, importCryptoKey, encryptData, decryptData } from '../utils/crypto';
import { useAuthStore } from '../features/auth/store';
import { useI18n } from '../i18n/I18nContext';

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
  const { t } = useI18n();

  const performSimpleLogout = useCallback(() => {
    localStorage.removeItem('github_pat_encrypted');
    localStorage.removeItem('crypto_key');
    localStorage.removeItem('selected_repo');
    localStorage.removeItem('service_type');
    localStorage.removeItem('instance_url');
    clearAuth();
  }, [clearAuth]);

  // Listen for auth-error events (401 from API)
  useEffect(() => {
    const handleAuthError = () => {
      performSimpleLogout();
    };
    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, [performSimpleLogout]);

  // Restore session on mount
  useEffect(() => {
    const encryptedToken = localStorage.getItem('github_pat_encrypted');
    const keyJson = localStorage.getItem('crypto_key');
    const repoJson = localStorage.getItem('selected_repo');
    const serviceTypeFromSession = localStorage.getItem('service_type') as ServiceType | null;
    const instanceUrl = localStorage.getItem('instance_url');

    if (encryptedToken && keyJson && repoJson && serviceTypeFromSession) {
      const restoreSession = async () => {
        setLoading(true);
        try {
          const key = await importCryptoKey(JSON.parse(keyJson));
          const token = await decryptData(encryptedToken, key);
          const repo = JSON.parse(repoJson);

          let userData, repoData;
          let service: IGitService;

          if (serviceTypeFromSession === 'gitea' || serviceTypeFromSession === 'gogs') {
            if (!instanceUrl) throw new Error("Self-hosted instance URL not found in session.");
            if (serviceTypeFromSession === 'gitea') {
              userData = await verifyTokenGitea(token, instanceUrl);
              repoData = await getRepoDetailsGitea(token, repo.owner.login, repo.name, instanceUrl);
              service = new GiteaAdapter(token, repo.owner.login, repo.name, instanceUrl);
            } else {
              userData = await verifyTokenGogs(token, instanceUrl);
              repoData = await getRepoDetailsGogs(token, repo.owner.login, repo.name, instanceUrl);
              service = new GogsAdapter(token, repo.owner.login, repo.name, instanceUrl);
            }
          } else {
            userData = await verifyTokenGithub(token);
            repoData = await getRepoDetailsGithub(token, repo.owner.login, repo.name);
            service = new GithubAdapter(token, repo.owner.login, repo.name);
          }

          if (!repoData.permissions?.push) {
            throw new Error("You do not have write permissions for this repository.");
          }

          setUser(userData);
          setRepo(repoData);
          setGitService(service);
          setServiceType(serviceTypeFromSession);
        } catch (e) {
          console.error("Session restore failed:", e);
          performSimpleLogout();
        } finally {
          setLoading(false);
        }
      };
      restoreSession();
    } else {
      setLoading(false);
    }
  }, [performSimpleLogout]);

  const handleLogin = useCallback(async (token: string, repoUrl: string, serviceType: ServiceType, instanceUrl?: string) => {
    setLoading(true);
    setError(null);

    const repoParts = parseRepoUrl(repoUrl);
    if (!repoParts) {
      setError(t('app.error.invalidRepoUrl'));
      setLoading(false);
      return;
    }
    const { owner, repo } = repoParts;

    try {
      let userData, repoData;
      let service: IGitService;

      if (serviceType === 'gitea' || serviceType === 'gogs') {
        if (!instanceUrl || !instanceUrl.startsWith('http')) {
          setError(t('app.error.invalidGiteaUrl'));
          setLoading(false);
          return;
        }
        if (serviceType === 'gitea') {
          userData = await verifyTokenGitea(token, instanceUrl);
          repoData = await getRepoDetailsGitea(token, owner, repo, instanceUrl);
          service = new GiteaAdapter(token, owner, repo, instanceUrl);
        } else {
          userData = await verifyTokenGogs(token, instanceUrl);
          repoData = await getRepoDetailsGogs(token, owner, repo, instanceUrl);
          service = new GogsAdapter(token, owner, repo, instanceUrl);
        }
      } else {
        userData = await verifyTokenGithub(token);
        repoData = await getRepoDetailsGithub(token, owner, repo);
        service = new GithubAdapter(token, owner, repo);
      }

      if (!repoData.permissions?.push) {
        throw new Error("You do not have write permissions for this repository.");
      }

      const key = await generateCryptoKey();
      const encryptedToken = await encryptData(token, key);
      const exportedKey = await exportCryptoKey(key);

      localStorage.setItem('github_pat_encrypted', encryptedToken);
      localStorage.setItem('crypto_key', JSON.stringify(exportedKey));
      localStorage.setItem('selected_repo', JSON.stringify(repoData));
      localStorage.setItem('service_type', serviceType);
      if (instanceUrl) localStorage.setItem('instance_url', instanceUrl);

      setUser(userData);
      setRepo(repoData);
      setGitService(service);
      setServiceType(serviceType);

    } catch (err) {
      let errorMessage = err instanceof Error ? err.message : t('app.error.unknown');
      if (errorMessage.includes("write permissions")) {
        errorMessage = t('app.error.noWritePermissions');
      }
      setError(t('app.error.loginFailed', { message: errorMessage }));
      performSimpleLogout();
    } finally {
      setLoading(false);
    }
  }, [performSimpleLogout, t]);

  return {
    handleLogin,
    performSimpleLogout,
  };
}
