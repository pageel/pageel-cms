/**
 * CmsClient — Client-side wrapper for Astro client:only="react"
 * Replaces the manual script-based mounting approach.
 */

import React from 'react';
import App from './App';
import { I18nProvider } from '../i18n/I18nContext';

// Inject env auth flag for backward compat
if (typeof window !== 'undefined') {
  (window as any).__PAGEEL_ENV_AUTH__ = true;
}

export default function CmsClient() {
  return (
    <I18nProvider>
      <App />
    </I18nProvider>
  );
}
