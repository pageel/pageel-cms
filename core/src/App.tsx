
import React, { useState, useEffect, useCallback } from 'react';
import GitServiceConnect from './components/GitServiceConnect';
import Dashboard from './components/Dashboard';
import { GithubUser, GithubRepo, IGitService, ServiceType } from './types';
import { verifyToken as verifyTokenGithub, getRepoDetails as getRepoDetailsGithub, GithubAdapter } from './services/githubService';
import { verifyToken as verifyTokenGitea, getRepoDetails as getRepoDetailsGitea, GiteaAdapter } from './services/giteaService';
import { verifyToken as verifyTokenGogs, getRepoDetails as getRepoDetailsGogs, GogsAdapter } from './services/gogsService';
import { GithubIcon } from './components/icons/GithubIcon';
import { AstroIcon } from './components/icons/AstroIcon';
import { parseRepoUrl } from './utils/parsing';
import { generateCryptoKey, exportCryptoKey, importCryptoKey, encryptData, decryptData } from './utils/crypto';
import { useI18n } from './i18n/I18nContext';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { ExclamationTriangleIcon } from './components/icons/ExclamationTriangleIcon';
import { CloseIcon } from './components/icons/CloseIcon';
import { SpinnerIcon } from './components/icons/SpinnerIcon';

const App: React.FC = () => {
  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [user, setUser] = useState<GithubUser | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null);
  const [gitService, setGitService] = useState<IGitService | null>(null);
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isLogoutConfirmVisible, setIsLogoutConfirmVisible] = useState(false);
  const [shouldResetOnLogout, setShouldResetOnLogout] = useState(false);
  const { t } = useI18n();

  const performSimpleLogout = useCallback(() => {
    localStorage.removeItem('github_pat_encrypted');
    localStorage.removeItem('crypto_key');
    localStorage.removeItem('selected_repo');
    localStorage.removeItem('service_type');
    localStorage.removeItem('instance_url');
    setGithubToken(null);
    setUser(null);
    setSelectedRepo(null);
    setGitService(null);
    setServiceType(null);
    setError(null);
  }, []);

  useEffect(() => {
    const handleAuthError = () => {
      performSimpleLogout();
    };
    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, [performSimpleLogout]);

  const handleRequestLogout = (withReset: boolean) => {
    setShouldResetOnLogout(withReset);
    setIsLogoutConfirmVisible(true);
  };

  const handleCancelLogout = () => {
    setIsLogoutConfirmVisible(false);
  };

  const handleConfirmLogout = useCallback(() => {
    if (shouldResetOnLogout && selectedRepo) {
      const repoFullName = selectedRepo.full_name;
      // MA-06: ALL settings keys are now scoped by repoId (except language)
      const repoScopedKeys = [
        'projectType', 'postsPath', 'imagesPath', 'domainUrl', 'postTemplate',
        'postTableColumns', 'postTableColumnWidths',
        'postFileTypes', 'imageFileTypes', 'publishDateSource', 'imageCompressionEnabled',
        'maxImageSize', 'imageResizeMaxWidth', 'newPostCommit', 'updatePostCommit',
        'newImageCommit', 'updateImageCommit'
      ];
      repoScopedKeys.forEach(key => localStorage.removeItem(`${key}_${repoFullName}`));
      // Language is user preference, optionally reset
      localStorage.removeItem('pageel-cms-lang');
    }

    performSimpleLogout();
    setIsLogoutConfirmVisible(false);
    // Force a full reload to completely clear all in-memory states (Zustand stores, etc.)
    window.location.href = window.location.origin;
  }, [selectedRepo, shouldResetOnLogout, performSimpleLogout]);

  useEffect(() => {
    const encryptedToken = localStorage.getItem('github_pat_encrypted');
    const keyJson = localStorage.getItem('crypto_key');
    const repoJson = localStorage.getItem('selected_repo');
    const serviceTypeFromSession = localStorage.getItem('service_type') as ServiceType | null;
    const instanceUrl = localStorage.getItem('instance_url');

    if (encryptedToken && keyJson && repoJson && serviceTypeFromSession) {
      const restoreSession = async () => {
        setIsLoading(true);
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
            } else { // Gogs
              userData = await verifyTokenGogs(token, instanceUrl);
              repoData = await getRepoDetailsGogs(token, repo.owner.login, repo.name, instanceUrl);
              service = new GogsAdapter(token, repo.owner.login, repo.name, instanceUrl);
            }
          } else { // Github
            userData = await verifyTokenGithub(token);
            repoData = await getRepoDetailsGithub(token, repo.owner.login, repo.name);
            service = new GithubAdapter(token, repo.owner.login, repo.name);
          }

          if (!repoData.permissions?.push) {
            throw new Error("You do not have write permissions for this repository.");
          }

          setUser(userData);
          setGithubToken(token);
          setSelectedRepo(repoData);
          setGitService(service);
          setServiceType(serviceTypeFromSession);
        } catch (e) {
          console.error("Session restore failed:", e);
          performSimpleLogout();
        } finally {
          setIsLoading(false);
        }
      };
      restoreSession();
    } else {
      setIsLoading(false);
    }
  }, [performSimpleLogout]);

  useEffect(() => {
    const baseClasses = 'font-sans text-gray-800 antialiased';
    if (gitService && user && selectedRepo) {
      document.body.className = `bg-gray-100 ${baseClasses}`;
    } else {
      document.body.className = `login-bg ${baseClasses} overflow-hidden`; // Prevent scroll on login
    }
    return () => { document.body.className = ''; }
  }, [gitService, user, selectedRepo]);

  const handleLogin = useCallback(async (token: string, repoUrl: string, serviceType: ServiceType, instanceUrl?: string) => {
    setIsLoading(true);
    setError(null);

    const repoParts = parseRepoUrl(repoUrl);
    if (!repoParts) {
      setError(t('app.error.invalidRepoUrl'));
      setIsLoading(false);
      return;
    }
    const { owner, repo } = repoParts;

    try {
      let userData, repoData;
      let service: IGitService;

      if (serviceType === 'gitea' || serviceType === 'gogs') {
        if (!instanceUrl || !instanceUrl.startsWith('http')) {
          setError(t('app.error.invalidGiteaUrl'));
          setIsLoading(false);
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
      setGithubToken(token);
      setSelectedRepo(repoData);
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
      setIsLoading(false);
    }
  }, [performSimpleLogout, t]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <SpinnerIcon className="animate-spin h-8 w-8 text-notion-muted" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex flex-col">
      {isLogoutConfirmVisible && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-lg shadow-xl border border-notion-border w-full max-w-sm overflow-hidden animate-fade-in">
            <div className="p-5">
              <div className="flex items-start">
                <div className="flex-shrink-0 mr-3 mt-0.5">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-notion-text leading-5">{t('app.logoutConfirm.title')}</h3>
                  <div className="mt-1 mb-4">
                    <p className="text-xs text-notion-muted leading-relaxed">{t('app.logoutConfirm.description')}</p>
                  </div>

                  <div className="flex items-start bg-notion-sidebar p-3 rounded-sm border border-notion-border">
                    <div className="flex items-center h-5">
                      <input
                        id="reset-settings-checkbox"
                        name="reset-settings"
                        type="checkbox"
                        checked={shouldResetOnLogout}
                        onChange={(e) => setShouldResetOnLogout(e.target.checked)}
                        className="rounded-sm border-gray-300 text-red-600 focus:ring-red-500 h-3.5 w-3.5"
                      />
                    </div>
                    <div className="ml-2.5">
                      <label htmlFor="reset-settings-checkbox" className="text-xs font-medium text-notion-text block select-none">{t('app.logoutConfirm.resetLabel')}</label>
                      <p className="text-[10px] text-notion-muted mt-0.5 leading-tight">{t('app.logoutConfirm.resetHelp')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-notion-sidebar px-4 py-3 flex flex-row-reverse gap-2 border-t border-notion-border">
              <button onClick={handleConfirmLogout} className="inline-flex justify-center items-center rounded-sm border border-transparent bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-700 transition-colors">
                {t('app.logout')}
              </button>
              <button onClick={handleCancelLogout} className="inline-flex justify-center items-center rounded-sm border border-notion-border bg-white px-3 py-1.5 text-xs font-medium text-notion-text shadow-sm hover:bg-notion-hover transition-colors">
                {t('app.logoutConfirm.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {!gitService || !user || !selectedRepo || !serviceType ? (
        <div className="flex-grow flex flex-col items-center justify-center p-4 w-full max-w-screen-xl mx-auto h-screen pb-24 sm:pb-32">
          <GitServiceConnect onSubmit={handleLogin} error={error} />

          <footer className="absolute bottom-4 left-0 right-0 text-center text-gray-400 text-xs">
            <div className="flex flex-col sm:flex-row justify-center items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <a href="https://github.com/pageel/pageel-cms" target="_blank" rel="noopener noreferrer" className="inline-flex items-center hover:text-notion-text transition-colors group">
                <div className="w-5 h-5 bg-white border border-gray-200 shadow-sm rounded flex items-center justify-center mr-2 group-hover:bg-gray-50 transition-colors">
                  <GithubIcon className="w-3.5 h-3.5 text-notion-text" />
                </div>
                Pageel CMS v1.1.0-beta.1
              </a>
              <span className="hidden sm:inline text-gray-300">|</span>
              <LanguageSwitcher position="up" />
            </div>
          </footer>
        </div>
      ) : (
        <Dashboard
          gitService={gitService}
          repo={selectedRepo}
          user={user}
          serviceType={serviceType}
          onLogout={() => handleRequestLogout(false)}
          onResetAndLogout={() => handleRequestLogout(true)}
        />
      )}
    </div>
  );
};

export default App;
