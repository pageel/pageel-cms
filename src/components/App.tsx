/**
 * App Component — v2.0
 *
 * Simplified: No token paste mode.
 * Auth is handled server-side via cookie.
 * If user reaches /cms, they are already authenticated.
 */

import React, { useEffect, useCallback, useState } from 'react';
import Dashboard from './Dashboard';
import { useAuthStore } from '../features/auth/store';
import { useSessionRestore } from '../hooks/useSessionRestore';
import { useI18n } from '../i18n/I18nContext';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';

const App: React.FC = () => {
  const { user, repo, gitService, serviceType, isLoading, error } = useAuthStore();
  const { performSimpleLogout } = useSessionRestore();
  const [isLogoutConfirmVisible, setIsLogoutConfirmVisible] = useState(false);
  const { t } = useI18n();

  const handleConfirmLogout = useCallback(() => {
    setIsLogoutConfirmVisible(false);
    performSimpleLogout();
  }, [performSimpleLogout]);

  // Body class management
  useEffect(() => {
    document.body.className = 'bg-gray-100 font-sans text-gray-800 antialiased';
    return () => { document.body.className = ''; }
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <SpinnerIcon className="animate-spin h-8 w-8 text-notion-muted" />
      </div>
    );
  }

  if (error || !gitService || !user || !repo) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <SpinnerIcon className="animate-spin h-6 w-6 text-notion-muted mx-auto mb-3" />
          <p className="text-sm text-notion-muted">Initializing CMS...</p>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
      </div>
    );
  }

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

      <Dashboard
        gitService={gitService}
        repo={repo}
        user={user}
        serviceType={serviceType!}
        onLogout={() => setIsLogoutConfirmVisible(true)}
      />
    </div>
  );
};

export default App;
