/**
 * Auth Store
 * 
 * Zustand store for authentication state.
 * Replaces auth state from App.tsx.
 */

import { create } from 'zustand';
import { GithubUser, GithubRepo, IGitService, ServiceType } from '../../types';

interface AuthState {
  user: GithubUser | null;
  repo: GithubRepo | null;
  gitService: IGitService | null;
  serviceType: ServiceType | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  setUser: (user: GithubUser | null) => void;
  setRepo: (repo: GithubRepo | null) => void;
  setGitService: (service: IGitService | null) => void;
  setServiceType: (type: ServiceType | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Check if user is authenticated
  isAuthenticated: () => boolean;
  
  // Clear all auth state (logout)
  clearAuth: () => void;
}

export type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()((set, get) => ({
  // State
  user: null,
  repo: null,
  gitService: null,
  serviceType: null,
  isLoading: true,
  error: null,

  // Actions
  setUser: (user) => set({ user }),
  setRepo: (repo) => set({ repo }),
  setGitService: (service) => set({ gitService: service }),
  setServiceType: (type) => set({ serviceType: type }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  isAuthenticated: () => {
    const { user, repo, gitService } = get();
    return !!(user && repo && gitService);
  },

  clearAuth: () => {
    // Only reset Zustand state — localStorage cleanup handled by useSessionRestore
    set({
      user: null,
      repo: null,
      gitService: null,
      serviceType: null,
      error: null,
    });
  },
}));
