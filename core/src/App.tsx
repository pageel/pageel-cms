/**
 * App Component
 * 
 * TD-01/TD-02: Refactored from 273 lines to ~80 lines.
 * Auth state moved to useAuthStore (Zustand).
 * Session restore + login logic extracted to useSessionRestore hook.
 * App now only handles: layout, auth guard, logout modal.
 */

import React, { useState, useEffect, useCallback } from 'react';
import GitServiceConnect from './components/GitServiceConnect';
import Dashboard from './components/Dashboard';
import { useAuthStore } from './features/auth/store';
import { useSessionRestore } from './hooks/useSessionRestore';
import { GithubIcon } from './components/icons/GithubIcon';
import { useI18n } from './i18n/I18nContext';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { ExclamationTriangleIcon } from './components/icons/ExclamationTriangleIcon';
import { SpinnerIcon } from './components/icons/SpinnerIcon';

const App: React.FC = () => {
  const { user, repo, gitService, serviceType, isLoading, error } = useAuthStore();
  const { handleLogin, performSimpleLogout } = useSessionRestore();
  const [isLogoutConfirmVisible, setIsLogoutConfirmVisible] = useState(false);
  const { t } = useI18n();

  const handleConfirmLogout = useCallback(() => {
    performSimpleLogout();
    setIsLogoutConfirmVisible(false);
    window.location.href = window.location.origin;
  }, [performSimpleLogout]);

  // Body class management
  useEffect(() => {
    const baseClasses = 'font-sans text-gray-800 antialiased';
    if (gitService && user && repo) {
      document.body.className = `bg-gray-100 ${baseClasses}`;
    } else {
      document.body.className = `login-bg ${baseClasses} overflow-hidden`;
    }
    return () => { document.body.className = ''; }
  }, [gitService, user, repo]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <SpinnerIcon className="animate-spin h-8 w-8 text-notion-muted" />
      </div>
    );
  }

  const isAuthenticated = !!(gitService && user && repo && serviceType);

  return (
    <div className="min-h-screen relative flex flex-col">
      {/* Logout Confirmation Modal */}
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
                  <div className="mt-1">
                    <p className="text-xs text-notion-muted leading-relaxed">{t('app.logoutConfirm.description')}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-notion-sidebar px-4 py-3 flex flex-row-reverse gap-2 border-t border-notion-border">
              <button onClick={handleConfirmLogout} className="inline-flex justify-center items-center rounded-sm border border-transparent bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-700 transition-colors">
                {t('app.logout')}
              </button>
              <button onClick={() => setIsLogoutConfirmVisible(false)} className="inline-flex justify-center items-center rounded-sm border border-notion-border bg-white px-3 py-1.5 text-xs font-medium text-notion-text shadow-sm hover:bg-notion-hover transition-colors">
                {t('app.logoutConfirm.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {!isAuthenticated ? (
        <div className="flex-grow flex flex-col items-center justify-center p-4 w-full max-w-screen-xl mx-auto h-screen pb-24 sm:pb-32">
          <GitServiceConnect onSubmit={handleLogin} error={error} />

          <footer className="absolute bottom-4 left-0 right-0 text-center text-gray-400 text-xs">
            <div className="flex flex-col sm:flex-row justify-center items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <a href="https://github.com/pageel/pageel-cms" target="_blank" rel="noopener noreferrer" className="inline-flex items-center hover:text-notion-text transition-colors group">
                <div className="w-5 h-5 bg-white border border-gray-200 shadow-sm rounded flex items-center justify-center mr-2 group-hover:bg-gray-50 transition-colors">
                  <GithubIcon className="w-3.5 h-3.5 text-notion-text" />
                </div>
                Pageel CMS v1.1.0
              </a>
              <span className="hidden sm:inline text-gray-300">|</span>
              <LanguageSwitcher position="up" />
            </div>
          </footer>
        </div>
      ) : (
        <Dashboard
          gitService={gitService}
          repo={repo}
          user={user}
          serviceType={serviceType}
          onLogout={() => setIsLogoutConfirmVisible(true)}
        />
      )}
    </div>
  );
};

export default App;
