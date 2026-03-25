/**
 * Collection Store
 * 
 * Zustand store for managing collections within a workspace.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Collection, Workspace, WorkspaceSettings, createCollection } from './types';
import { DEFAULT_SETTINGS } from '../settings/types';

interface CollectionState {
  /** Current workspace */
  workspace: Workspace | null;
  
  /** Loading state */
  isLoading: boolean;
}

interface CollectionActions {
  /** Initialize workspace for a repo */
  initWorkspace: (repoId: string) => void;
  
  /** Get active collection */
  getActiveCollection: () => Collection | null;
  
  /** Set active collection */
  setActiveCollection: (collectionId: string) => void;
  
  /** Add a new collection */
  addCollection: (collection: Collection) => void;
  
  /** Update a collection */
  updateCollection: (collectionId: string, updates: Partial<Collection>) => void;
  
  /** Remove a collection */
  removeCollection: (collectionId: string) => void;
  
  /** Update workspace settings */
  updateSettings: (settings: Partial<WorkspaceSettings>) => void;
  
  /** Clear workspace */
  clearWorkspace: () => void;
  
  /** Reset workspace completely (BUG-13) */
  resetWorkspace: () => void;
  
  /** Batch set collections (overwrites existing) */
  setCollections: (collections: Collection[]) => void;
}

export type CollectionStore = CollectionState & CollectionActions;

export const useCollectionStore = create<CollectionStore>()(
  persist(
    (set, get) => ({
      // State
      workspace: null,
      isLoading: false,

      // Actions
      initWorkspace: (repoId) => {
        const existing = get().workspace;
        if (existing?.repoId === repoId) return;

        const now = new Date().toISOString();
        const defaultSettings: WorkspaceSettings = {
          projectType: DEFAULT_SETTINGS.projectType,
          domainUrl: DEFAULT_SETTINGS.domainUrl,
          postFileTypes: DEFAULT_SETTINGS.postFileTypes,
          imageFileTypes: DEFAULT_SETTINGS.imageFileTypes,
          publishDateSource: DEFAULT_SETTINGS.publishDateSource,
          imageCompressionEnabled: DEFAULT_SETTINGS.imageCompressionEnabled,
          maxImageSize: DEFAULT_SETTINGS.maxImageSize,
          imageResizeMaxWidth: DEFAULT_SETTINGS.imageResizeMaxWidth,
          newPostCommit: DEFAULT_SETTINGS.newPostCommit,
          updatePostCommit: DEFAULT_SETTINGS.updatePostCommit,
          newImageCommit: DEFAULT_SETTINGS.newImageCommit,
          updateImageCommit: DEFAULT_SETTINGS.updateImageCommit,
        };

        set({
          workspace: {
            repoId,
            collections: [],
            activeCollectionId: null,
            settings: defaultSettings,
            createdAt: now,
            updatedAt: now,
          },
        });
      },

      getActiveCollection: () => {
        const { workspace } = get();
        if (!workspace || !workspace.activeCollectionId) return null;
        return workspace.collections.find(c => c.id === workspace.activeCollectionId) || null;
      },

      setActiveCollection: (collectionId) => {
        set((state) => {
          if (!state.workspace) return state;
          return {
            workspace: {
              ...state.workspace,
              activeCollectionId: collectionId,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      addCollection: (collection) => {
        set((state) => {
          if (!state.workspace) return state;
          // Prevent duplicates - check if collection with same ID exists
          if (state.workspace.collections.some(c => c.id === collection.id)) {
            return state;
          }
          return {
            workspace: {
              ...state.workspace,
              collections: [...state.workspace.collections, collection],
              activeCollectionId: state.workspace.activeCollectionId || collection.id,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      updateCollection: (collectionId, updates) => {
        set((state) => {
          if (!state.workspace) return state;
          return {
            workspace: {
              ...state.workspace,
              collections: state.workspace.collections.map((c) =>
                c.id === collectionId
                  ? { ...c, ...updates, updatedAt: new Date().toISOString() }
                  : c
              ),
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      removeCollection: (collectionId) => {
        set((state) => {
          if (!state.workspace) return state;
          const newCollections = state.workspace.collections.filter(c => c.id !== collectionId);
          return {
            workspace: {
              ...state.workspace,
              collections: newCollections,
              activeCollectionId:
                state.workspace.activeCollectionId === collectionId
                  ? newCollections[0]?.id || null
                  : state.workspace.activeCollectionId,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      updateSettings: (settings) => {
        set((state) => {
          if (!state.workspace) return state;
          return {
            workspace: {
              ...state.workspace,
              settings: { ...state.workspace.settings, ...settings },
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      clearWorkspace: () => {
        set({ workspace: null });
      },
      
      resetWorkspace: () => {
        // BUG-13: Complete workspace reset including localStorage
        set({ workspace: null });
        // Clear persisted data
        localStorage.removeItem('pageel-collections');
      },
      
      setCollections: (collections) => {
        set((state) => {
          if (!state.workspace) return state;
          return {
            workspace: {
              ...state.workspace,
              collections,
              activeCollectionId: collections[0]?.id || null,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },
    }),
    {
      name: 'pageel-collections',
      partialize: (state) => ({ workspace: state.workspace }),
    }
  )
);
