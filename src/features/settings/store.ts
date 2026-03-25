/**
 * Settings UI Store
 * 
 * Lightweight Zustand store for Settings UI state only.
 * Settings DATA is now sourced from CollectionStore.workspace.settings (SSoT).
 * 
 * TD-08 Fix: This store no longer holds settings data or manages
 * localStorage per-repo keys. All settings are managed by CollectionStore.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsUIState {
  isSaving: boolean;
  saveSuccess: boolean;
  isSetupComplete: boolean;
}

interface SettingsUIActions {
  setIsSaving: (saving: boolean) => void;
  setSaveSuccess: (success: boolean) => void;
  setSetupComplete: (complete: boolean) => void;
  resetUI: () => void;
}

export type SettingsStore = SettingsUIState & SettingsUIActions;

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      // State
      isSaving: false,
      saveSuccess: false,
      isSetupComplete: false,

      // Actions
      setIsSaving: (saving) => set({ isSaving: saving }),
      setSaveSuccess: (success) => set({ saveSuccess: success }),
      setSetupComplete: (complete) => set({ isSetupComplete: complete }),
      resetUI: () => set({ isSaving: false, saveSuccess: false }),
    }),
    {
      name: 'pageel-settings',
      partialize: (state) => ({ 
        isSetupComplete: state.isSetupComplete,
      }),
    }
  )
);
