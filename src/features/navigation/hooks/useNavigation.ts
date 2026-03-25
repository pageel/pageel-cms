/**
 * useNavigation Hook
 * 
 * Manages view navigation with browser history integration.
 * Extracted from Dashboard.tsx for cleaner architecture.
 */

import { useState, useEffect, useCallback } from 'react';
import { ViewType } from '../types';

const VALID_VIEWS: ViewType[] = ['dashboard', 'workflows', 'images', 'template', 'backup', 'settings'];

function getInitialView(): ViewType {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view') as ViewType | null;
    if (view && VALID_VIEWS.includes(view)) {
      return view;
    }
  }
  return 'dashboard';
}

export function useNavigation() {
  const [currentView, setCurrentView] = useState<ViewType>(getInitialView);

  // Sync state to URL
  useEffect(() => {
    if (window.location.protocol === 'blob:') return;
    try {
      const url = new URL(window.location.href);
      const currentViewInUrl = url.searchParams.get('view');
      if (currentViewInUrl !== currentView) {
        url.searchParams.set('view', currentView);
        if (!currentViewInUrl) {
          window.history.replaceState({}, '', url.toString());
        } else {
          window.history.pushState({}, '', url.toString());
        }
      }
    } catch (e) {
      console.warn("URL Sync disabled due to environment restrictions.");
    }
  }, [currentView]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const view = params.get('view') as ViewType | null;
      if (view && VALID_VIEWS.includes(view)) {
        setCurrentView(view);
      } else {
        setCurrentView('dashboard');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((view: ViewType) => {
    setCurrentView(view);
  }, []);

  return {
    currentView,
    navigate,
    validViews: VALID_VIEWS,
  };
}
