/**
 * CMS Client Entry Point
 * Mounts React App into #cms-app container
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../components/App';
import { I18nProvider } from '../i18n/I18nContext';

// Inject env auth flag for backward compat during migration
(window as any).__PAGEEL_ENV_AUTH__ = true;

const container = document.getElementById('cms-app');
if (container) {
  const root = createRoot(container);
  root.render(
    React.createElement(I18nProvider, null,
      React.createElement(App)
    )
  );
}
