/**
 * App Store
 * 
 * Zustand store for general app state (navigation, UI).
 * Replaces activeView, sidebar state from Dashboard.tsx.
 */

import { create } from 'zustand';
import { ViewType } from '../navigation/types';

const VALID_VIEWS: ViewType[] = ['dashboard', 'workflows', 'images', 'template', 'backup', 'settings'];

interface AppState {
  activeView: ViewType;
  isSidebarOpen: boolean;
  isScanning: boolean;
  isSyncing: boolean; // WF-06: Track Git sync operations
  syncMessage: string | null; // WF-06: Display current sync operation
  scanPhase: string | null; // MA-08: Current scan phase message
  scanProgress: number; // MA-08: Scan progress percentage (0-100)
  repoStats: {
    postCount: number | null;
    imageCount: number | null;
  };
}

interface AppActions {
  setView: (view: ViewType) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setScanning: (scanning: boolean) => void;
  setRepoStats: (stats: { postCount: number | null; imageCount: number | null }) => void;
  // WF-06: Sync lock methods
  startSync: (message?: string) => void;
  endSync: () => void;
  // MA-08: Scan progress methods
  setScanPhase: (phase: string | null, progress?: number) => void;
}

export type AppStore = AppState & AppActions;

/**
 * Get initial view from URL
 */
const getInitialView = (): ViewType => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view') as ViewType | null;
    if (view && VALID_VIEWS.includes(view)) {
      return view;
    }
  }
  return 'dashboard';
};

export const useAppStore = create<AppStore>()((set, get) => ({
  // State
  activeView: getInitialView(),
  isSidebarOpen: false,
  isScanning: true,
  isSyncing: false, // WF-06
  syncMessage: null, // WF-06
  scanPhase: null, // MA-08
  scanProgress: 0, // MA-08
  repoStats: { postCount: null, imageCount: null },

  // Actions
  setView: (view) => {
    set({ activeView: view });
    
    // Sync to URL
    if (typeof window !== 'undefined' && window.location.protocol !== 'blob:') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('view', view);
        window.history.pushState({}, '', url.toString());
      } catch (e) {
        console.warn('URL Sync disabled due to environment restrictions.');
      }
    }
  },

  toggleSidebar: () => {
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen }));
  },

  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setScanning: (scanning) => set({ isScanning: scanning }),
  setRepoStats: (stats) => set({ repoStats: stats }),
  
  // WF-06: Sync lock actions
  startSync: (message) => set({ isSyncing: true, syncMessage: message || 'Syncing...' }),
  endSync: () => set({ isSyncing: false, syncMessage: null }),
  
  // MA-08: Scan progress actions
  setScanPhase: (phase, progress) => set({ 
    scanPhase: phase, 
    scanProgress: progress !== undefined ? progress : (phase ? 50 : 0) 
  }),
}));

// Set up popstate listener for browser back/forward
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view') as ViewType | null;
    if (view && VALID_VIEWS.includes(view)) {
      useAppStore.getState().setView(view);
    } else {
      useAppStore.getState().setView('dashboard');
    }
  });
}
