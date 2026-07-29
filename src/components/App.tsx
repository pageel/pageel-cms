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
  const { performSimpleLogout, retryInit } = useSessionRestore();
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

  // // @para-doc [#csa-cms-cfr-error-ui]
  // // @para-doc [#csa-cms-cfr-error-ui-impl]
  if (error || !gitService || !user || !repo) {
    const isCloudflare = error === 'cloudflare_challenge';

    return (
      <div className="flex justify-center items-center min-h-screen p-4 bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg border border-notion-border w-full max-w-md p-6 text-center animate-fade-in">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 mb-4">
            <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
          </div>

          <h3 className="text-base font-semibold text-notion-text mb-2">
            {isCloudflare ? t('app.error.cloudflareTitle') : 'CMS Session Error'}
          </h3>

          <p className="text-xs text-notion-muted leading-relaxed mb-6">
            {isCloudflare
              ? t('app.error.cloudflareDesc')
              : (error || 'Failed to initialize CMS session. Please check your network connection.')}
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button
              type="button"
              onClick={() => retryInit()}
              className="inline-flex justify-center items-center rounded-md border border-transparent bg-notion-muted text-white px-4 py-2 text-xs font-medium hover:bg-gray-700 transition-colors shadow-sm"
            >
              {t('app.error.retry')}
            </button>
            <button
              type="button"
              onClick={() => performSimpleLogout()}
              className="inline-flex justify-center items-center rounded-md border border-notion-border bg-white px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors shadow-sm"
            >
              {t('app.error.emergencyLogout')}
            </button>
          </div>
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
