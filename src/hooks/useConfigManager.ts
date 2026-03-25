/**
 * useConfigManager Hook
 * 
 * TD-07: Extracted from Dashboard.tsx God Component.
 * Handles all configuration management:
 * - Save settings to .pageelrc.json
 * - Export/Import settings
 * - Delete config (reset & logout)
 * - Finish setup (create initial workspace)
 */

import React, { useRef, useState } from 'react';
import {
  GithubRepo,
  IGitService,
  AppSettings,
} from '../types';
import {
  SETTINGS_SCHEMA,
  useSettingsStore,
  useCollectionStore,
  saveCollectionsToPageelrc,
  Collection,
  withSyncLock,
} from '../features';
import { useI18n } from '../i18n/I18nContext';

interface UseConfigManagerParams {
  gitService: IGitService;
  repo: GithubRepo;
  settings: AppSettings;
  handleAction: () => void;
}

interface UseConfigManagerReturn {
  // Settings change
  handleSettingsChange: (field: keyof AppSettings, value: string | number | boolean) => void;
  
  // Save
  handleSaveSettings: () => Promise<void>;
  
  // Export/Import
  handleExportSettings: () => void;
  handleImportClick: () => void;
  handleFileImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  importFileInputRef: React.RefObject<HTMLInputElement>;
  importExportStatus: { type: 'success' | 'error'; message: string } | null;
  
  // Delete
  handleDeleteConfig: () => Promise<void>;
  
  // Setup
  handleFinishSetup: (collectionName: string) => Promise<void>;
}

export function useConfigManager({
  gitService,
  repo,
  settings,
  handleAction,
}: UseConfigManagerParams): UseConfigManagerReturn {
  const { t } = useI18n();
  const {
    isSaving,
    setIsSaving,
    saveSuccess,
    setSaveSuccess,
    setSetupComplete,
  } = useSettingsStore();
  const {
    initWorkspace,
    workspace,
    getActiveCollection,
    updateSettings: updateWorkspaceSettings,
  } = useCollectionStore();

  const importFileInputRef = useRef<HTMLInputElement>(null!);
  const [importExportStatus, setImportExportStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // TD-08: Settings change updates workspace.settings directly (SSoT)
  const handleSettingsChange = (
    field: keyof AppSettings,
    value: string | number | boolean,
  ) => {
    if (field === 'postsPath' || field === 'imagesPath') {
      // postsPath/imagesPath are per-collection in v2 — handled via setSettings in hook
      updateWorkspaceSettings({ [field]: value } as any);
    } else {
      updateWorkspaceSettings({ [field]: value });
    }
  };

  // TD-08: Simplified save — workspace.settings is SSoT, save via CollectionStore only
  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      if (workspace) {
        const success = await withSyncLock(
          () => saveCollectionsToPageelrc(gitService, workspace),
          "Saving settings...",
        );

        if (success) {
          handleAction();
        } else {
          console.error("Failed to save .pageelrc.json to repository");
        }
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error("Failed to save settings:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportSettings = () => {
    // Export from workspace (v2 format) if available
    if (workspace && workspace.collections.length > 0) {
      const exportData = {
        version: 2,
        settings: workspace.settings,
        commitMessages: {
          newPost: workspace.settings.newPostCommit,
          updatePost: workspace.settings.updatePostCommit,
          newImage: workspace.settings.newImageCommit,
          updateImage: workspace.settings.updateImageCommit,
        },
        collections: workspace.collections.map((c) => ({
          id: c.id,
          name: c.name,
          postsPath: c.postsPath,
          imagesPath: c.imagesPath,
          template: c.template,
          tableColumns: c.tableColumns,
          columnWidths: c.columnWidths,
        })),
        activeCollectionId: workspace.activeCollectionId,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      const date = new Date().toISOString().split("T")[0];
      link.download = `pageel-cms-config-${repo.name}-${date}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      return;
    }

    // Fallback: Export from localStorage (legacy v1 format)
    const repoScopedKeys = [
      "projectType", "postsPath", "imagesPath", "domainUrl",
      "postTemplate", "postFileTypes", "imageFileTypes",
      "publishDateSource", "imageCompressionEnabled", "maxImageSize",
      "imageResizeMaxWidth", "newPostCommit", "updatePostCommit",
      "newImageCommit", "updateImageCommit", "postTableColumns",
      "postTableColumnWidths",
    ];

    const settingsToExport: { [key: string]: any } = {};

    repoScopedKeys.forEach((key) => {
      const storageKey = `${key}_${repo.full_name}`;
      const value = localStorage.getItem(storageKey);
      if (value !== null) {
        try {
          if (key === "imageCompressionEnabled") {
            settingsToExport[key] = value === "true";
          } else if (["maxImageSize", "imageResizeMaxWidth"].includes(key)) {
            settingsToExport[key] = Number(value);
          } else if (
            ["postTemplate", "postTableColumns", "postTableColumnWidths"].includes(key)
          ) {
            settingsToExport[key] = JSON.parse(value);
          } else {
            settingsToExport[key] = value;
          }
        } catch (e) {
          settingsToExport[key] = value;
        }
      }
    });

    const lang = localStorage.getItem("pageel-cms-lang");
    if (lang) settingsToExport["pageel-cms-lang"] = lang;

    const blob = new Blob([JSON.stringify(settingsToExport, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const date = new Date().toISOString().split("T")[0];
    link.download = `pageel-cms-settings-${repo.name}-${date}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleImportClick = () => {
    setImportExportStatus(null);
    importFileInputRef.current?.click();
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const importedConfig = JSON.parse(content);

        // Check if it's v2 format with collections
        if (
          Array.isArray(importedConfig.collections) &&
          importedConfig.collections.length > 0
        ) {
          const configToSave = {
            version: 2,
            ...importedConfig,
          };

          try {
            await withSyncLock(async () => {
              const sha = await (gitService).getFileSha(".pageelrc.json");
              if (sha) {
                await gitService.updateFileContent(
                  ".pageelrc.json",
                  JSON.stringify(configToSave, null, 2),
                  "chore: import pageel-cms config",
                  sha,
                );
              } else {
                await gitService.createFileFromString(
                  ".pageelrc.json",
                  JSON.stringify(configToSave, null, 2),
                  "chore: import pageel-cms config",
                );
              }
            }, "Importing configuration...");

            handleAction();
            setImportExportStatus({
              type: "success",
              message: t("dashboard.settings.importExport.importSuccess"),
            });
            setTimeout(() => window.location.reload(), 2000);
          } catch (err) {
            console.error("Failed to save imported config:", err);
            setImportExportStatus({
              type: "error",
              message: "Failed to save configuration to repository",
            });
          }
          return;
        }

        // Legacy v1 format
        for (const key in importedConfig) {
          if (!Object.prototype.hasOwnProperty.call(SETTINGS_SCHEMA, key)) continue;
          const validator = SETTINGS_SCHEMA[key];
          const value = importedConfig[key];
          if (!validator(value)) {
            throw new Error(`Invalid value for setting '${key}'.`);
          }
        }

        Object.entries(importedConfig).forEach(([key, value]) => {
          if (!SETTINGS_SCHEMA[key] && key !== "pageel-cms-lang") return;
          const storageKey = key === "pageel-cms-lang" ? key : `${key}_${repo.full_name}`;
          localStorage.setItem(storageKey, String(value));
        });

        // Build and save v1 config to repository
        try {
          const configObject = {
            version: 1,
            projectType: importedConfig.projectType || settings.projectType,
            paths: {
              posts: importedConfig.postsPath || settings.postsPath,
              images: importedConfig.imagesPath || settings.imagesPath,
            },
            domainUrl: importedConfig.domainUrl || settings.domainUrl,
            settings: {
              postFileTypes: importedConfig.postFileTypes || settings.postFileTypes,
              imageFileTypes: importedConfig.imageFileTypes || settings.imageFileTypes,
              publishDateSource: importedConfig.publishDateSource || settings.publishDateSource,
              imageCompressionEnabled: importedConfig.imageCompressionEnabled ?? settings.imageCompressionEnabled,
              maxImageSize: importedConfig.maxImageSize || settings.maxImageSize,
              imageResizeMaxWidth: importedConfig.imageResizeMaxWidth || settings.imageResizeMaxWidth,
            },
            commits: {
              newPost: importedConfig.newPostCommit || settings.newPostCommit,
              updatePost: importedConfig.updatePostCommit || settings.updatePostCommit,
              newImage: importedConfig.newImageCommit || settings.newImageCommit,
              updateImage: importedConfig.updateImageCommit || settings.updateImageCommit,
            },
          };

          await withSyncLock(async () => {
            const sha = await (gitService).getFileSha(".pageelrc.json");
            if (sha) {
              await gitService.updateFileContent(
                ".pageelrc.json",
                JSON.stringify(configObject, null, 2),
                "chore: import pageel-cms config",
                sha,
              );
            } else {
              await gitService.createFileFromString(
                ".pageelrc.json",
                JSON.stringify(configObject, null, 2),
                "chore: import pageel-cms config",
              );
            }
          }, "Importing configuration...");

          handleAction();
          setImportExportStatus({
            type: "success",
            message: t("dashboard.settings.importExport.importSuccess"),
          });
          setTimeout(() => window.location.reload(), 2000);
        } catch (err) {
          console.error("Failed to save imported config:", err);
          setImportExportStatus({
            type: "error",
            message: "Failed to save configuration to repository",
          });
        }
      } catch (err) {
        let message = t("dashboard.settings.importExport.importError.validation");
        if (err instanceof SyntaxError)
          message = t("dashboard.settings.importExport.importError.json");
        setImportExportStatus({ type: "error", message });
      } finally {
        if (event.target) event.target.value = "";
      }
    };
    reader.onerror = () => {
      setImportExportStatus({
        type: "error",
        message: t("dashboard.settings.importExport.importError.read"),
      });
      if (event.target) event.target.value = "";
    };
    reader.readAsText(file);
  };

  const handleFinishSetup = async (collectionName: string) => {
    const isReady =
      settings.projectType === "github"
        ? !!settings.postsPath && !!settings.imagesPath
        : !!settings.postsPath && !!settings.imagesPath && !!settings.domainUrl;

    if (isReady) {
      const prefix = repo.full_name;
      const savedTemplate = localStorage.getItem(`postTemplate_${prefix}`);
      const savedColumns = localStorage.getItem(`postTableColumns_${prefix}`);
      const savedWidths = localStorage.getItem(`postTableColumnWidths_${prefix}`);

      try {
        const initialCollection = {
          id: `collection-${Date.now()}`,
          name: collectionName || "Main Collection",
          postsPath: settings.postsPath,
          imagesPath: settings.imagesPath,
          template: savedTemplate ? JSON.parse(savedTemplate) : undefined,
          tableColumns: savedColumns ? JSON.parse(savedColumns) : undefined,
          columnWidths: savedWidths ? JSON.parse(savedWidths) : undefined,
        };

        const workspaceConfig = {
          version: 2,
          settings: {
            projectType: settings.projectType,
            domainUrl: settings.domainUrl,
            postFileTypes: settings.postFileTypes,
            imageFileTypes: settings.imageFileTypes,
            publishDateSource: settings.publishDateSource,
            imageCompressionEnabled: settings.imageCompressionEnabled,
            maxImageSize: settings.maxImageSize,
            imageResizeMaxWidth: settings.imageResizeMaxWidth,
          },
          commitMessages: {
            newPost: settings.newPostCommit,
            updatePost: settings.updatePostCommit,
            newImage: settings.newImageCommit,
            updateImage: settings.updateImageCommit,
          },
          collections: [initialCollection],
        };

        await withSyncLock(
          () =>
            gitService.createFileFromString(
              ".pageelrc.json",
              JSON.stringify(workspaceConfig, null, 2),
              "chore: add pageel-cms config",
            ),
          "Creating configuration...",
        );

        const collectionStore = useCollectionStore.getState();
        if (!collectionStore.workspace) {
          initWorkspace(repo.full_name);
        }

        const newCollection: Collection = {
          id: initialCollection.id,
          name: initialCollection.name,
          postsPath: initialCollection.postsPath,
          imagesPath: initialCollection.imagesPath,
          template: initialCollection.template,
          tableColumns: initialCollection.tableColumns,
          columnWidths: initialCollection.columnWidths,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        collectionStore.setCollections([newCollection]);
        collectionStore.setActiveCollection(newCollection.id);
        collectionStore.updateSettings({
          projectType: settings.projectType,
          domainUrl: settings.domainUrl,
          postFileTypes: settings.postFileTypes,
          imageFileTypes: settings.imageFileTypes,
          publishDateSource: settings.publishDateSource,
          imageCompressionEnabled: settings.imageCompressionEnabled,
          maxImageSize: settings.maxImageSize,
          imageResizeMaxWidth: settings.imageResizeMaxWidth,
          newPostCommit: settings.newPostCommit,
          updatePostCommit: settings.updatePostCommit,
          newImageCommit: settings.newImageCommit,
          updateImageCommit: settings.updateImageCommit,
        });

        handleAction();
      } catch (e) {
        console.warn("Failed to create .pageelrc.json or it already exists", e);
      }
      setSetupComplete(true);
    }
  };

  const handleDeleteConfig = async () => {
    setIsSaving(true);
    try {
      const sha = await gitService.getFileSha(".pageelrc.json");
      if (sha) {
        await withSyncLock(
          () =>
            gitService.deleteFile(
              ".pageelrc.json",
              sha,
              "chore: delete pageel-cms config",
            ),
          "Deleting configuration...",
        );
      }

      // BUG-13: Clear ALL localStorage keys for this repo
      const prefix = repo.full_name;
      const allLocalStorageKeys = Object.keys(localStorage);
      allLocalStorageKeys.forEach((key) => {
        if (key.includes(prefix)) {
          localStorage.removeItem(key);
        }
      });

      // Clear session storage (legacy cleanup)
      sessionStorage.clear();

      // Reset stores
      const collectionStore = useCollectionStore.getState();
      collectionStore.resetWorkspace();
      localStorage.removeItem("pageel-settings");
      localStorage.removeItem("pageel-collections");

      setSetupComplete(false);
      window.location.reload();
    } catch (e) {
      console.error("Failed to delete config:", e);
      alert("Failed to delete .pageelrc.json. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    handleSettingsChange,
    handleSaveSettings,
    handleExportSettings,
    handleImportClick,
    handleFileImport,
    importFileInputRef,
    importExportStatus,
    handleDeleteConfig,
    handleFinishSetup,
  };
}
