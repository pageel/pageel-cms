/**
 * useDashboardInit Hook
 * 
 * TD-07: Extracted from Dashboard.tsx God Component.
 * Handles:
 * - Settings derivation from workspace (TD-08 SSoT)
 * - loadSettingsAndScan (config loading + repo scanning)
 * - Sync polling (repo push detection)
 * - Repo stats fetching
 */

import { useState, useEffect, useCallback } from 'react';
import {
  GithubRepo,
  IGitService,
  AppSettings,
} from '../types';
import {
  SETTINGS_SCHEMA,
  DEFAULT_SETTINGS,
  useAppStore,
  useSettingsStore,
  useCollectionStore,
  loadCollectionsFromPageelrc,
} from '../features';

interface UseDashboardInitParams {
  gitService: IGitService;
  repo: GithubRepo;
}

interface UseDashboardInitReturn {
  // Derived settings (TD-08 SSoT)
  settings: AppSettings;
  setSettings: (updater: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) => void;
  
  // Effective paths (from active collection)
  effectivePostsPath: string;
  effectiveImagesPath: string;
  
  // Suggested paths (from scan)
  suggestedPostPaths: string[];
  suggestedImagePaths: string[];
  
  // Sync state
  currentRepo: GithubRepo;
  isSynced: boolean;
  handleAction: () => void;
  
  // Stats
  fetchStats: () => Promise<void>;
}

export function useDashboardInit({ gitService, repo }: UseDashboardInitParams): UseDashboardInitReturn {
  const {
    setScanning,
    setRepoStats,
    setScanPhase,
  } = useAppStore();
  const {
    setSetupComplete,
  } = useSettingsStore();
  const {
    initWorkspace,
    workspace,
    getActiveCollection,
    updateSettings: updateWorkspaceSettings,
  } = useCollectionStore();

  // TD-08: Settings SSoT — derive AppSettings from workspace.settings + active collection
  const activeCollection = getActiveCollection();
  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...(workspace?.settings || {}),
    postsPath: activeCollection?.postsPath || '',
    imagesPath: activeCollection?.imagesPath || '',
  } as AppSettings;

  const setSettings = (updater: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) => {
    if (typeof updater === 'function') {
      const newSettings = updater(settings);
      const { postsPath, imagesPath, ...workspaceSettings } = newSettings;
      updateWorkspaceSettings(workspaceSettings);
    } else {
      const { postsPath, imagesPath, ...workspaceSettings } = updater;
      updateWorkspaceSettings(workspaceSettings);
    }
  };

  // Effective paths
  const effectivePostsPath = activeCollection?.postsPath || settings.postsPath;
  const effectiveImagesPath = activeCollection?.imagesPath || settings.imagesPath;

  // Suggested paths (from scan)
  const [suggestedPostPaths, setSuggestedPostPaths] = useState<string[]>([]);
  const [suggestedImagePaths, setSuggestedImagePaths] = useState<string[]>([]);

  // Sync state
  const [currentRepo, setCurrentRepo] = useState<GithubRepo>(repo);
  const [lastWriteTime, setLastWriteTime] = useState<number | null>(null);
  const [isSynced, setIsSynced] = useState(true);

  const handleAction = useCallback(() => {
    setLastWriteTime(Date.now());
    setIsSynced(false);
  }, []);

  // Sync Polling
  useEffect(() => {
    if (!lastWriteTime) return;
    const checkSync = async () => {
      try {
        const updatedRepo = await gitService.getRepoDetails();
        setCurrentRepo(updatedRepo);
        const pushedTime = new Date(updatedRepo.pushed_at).getTime();
        if (pushedTime >= lastWriteTime - 10000) {
          setIsSynced(true);
          setLastWriteTime(null);
        }
      } catch (e) {
        console.error("Sync check failed", e);
      }
    };
    checkSync();
    const interval = setInterval(checkSync, 3000);
    return () => clearInterval(interval);
  }, [lastWriteTime, gitService]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    setRepoStats({ postCount: null, imageCount: null });
    if (!gitService || !effectivePostsPath) return;
    try {
      const postContents = await gitService.getRepoContents(effectivePostsPath);
      const postCount = postContents.filter(
        (item) =>
          item.type === "file" &&
          (item.name.endsWith(".md") || item.name.endsWith(".mdx")),
      ).length;

      let imageCount = 0;
      try {
        if (effectiveImagesPath) {
          const imageContents = await gitService.getRepoContents(effectiveImagesPath);
          imageCount = imageContents.filter((item) => item.type === "file").length;
        }
      } catch {
        imageCount = 0;
      }

      setRepoStats({ postCount, imageCount });
    } catch {
      setRepoStats({ postCount: 0, imageCount: 0 });
    }
  }, [gitService, effectivePostsPath, effectiveImagesPath]);

  // Load settings and scan — runs once on mount
  useEffect(() => {
    const loadSettingsAndScan = async () => {
      // TD-08: Initialize workspace and load from .pageelrc.json (Single Source of Truth)
      initWorkspace(repo.full_name);

      setScanning(true);
      setScanPhase("Initializing workspace...", 10);

      // Step 1: Load collections and settings from .pageelrc.json → workspace
      const collectionsData = await loadCollectionsFromPageelrc(
        gitService,
        repo.full_name,
      );

      if (collectionsData && collectionsData.collections.length > 0) {
        const store = useCollectionStore.getState();
        store.setCollections(collectionsData.collections);
        if (collectionsData.settings) {
          updateWorkspaceSettings(collectionsData.settings);
        }

        setScanPhase("Configuration loaded", 100);
        setSetupComplete(true);
        setScanning(false);
        return;
      }

      // Step 2: Try direct .pageelrc.json fetch (v1 format fallback)
      setScanPhase("Checking for .pageelrc.json...", 30);

      try {
        const configContent = await gitService.getFileContent(".pageelrc.json");
        const config = JSON.parse(configContent);
        if (config) {
          const wsSettings: Partial<AppSettings> = {};
          const applyIfValid = (key: keyof AppSettings, value: any) => {
            if (value !== undefined && SETTINGS_SCHEMA[key] && SETTINGS_SCHEMA[key](value)) {
              (wsSettings as any)[key] = value;
            }
          };

          if (config.projectType) applyIfValid("projectType", config.projectType);
          if (config.domainUrl) applyIfValid("domainUrl", config.domainUrl);
          if (config.settings) {
            applyIfValid("postFileTypes", config.settings.postFileTypes);
            applyIfValid("imageFileTypes", config.settings.imageFileTypes);
            applyIfValid("publishDateSource", config.settings.publishDateSource);
            applyIfValid("imageCompressionEnabled", config.settings.imageCompressionEnabled);
            applyIfValid("maxImageSize", config.settings.maxImageSize);
            applyIfValid("imageResizeMaxWidth", config.settings.imageResizeMaxWidth);
          }
          if (config.commits) {
            applyIfValid("newPostCommit", config.commits.newPost);
            applyIfValid("updatePostCommit", config.commits.updatePost);
            applyIfValid("newImageCommit", config.commits.newImage);
            applyIfValid("updateImageCommit", config.commits.updateImage);
          }

          updateWorkspaceSettings(wsSettings);
          setScanPhase("Configuration loaded", 100);
          setSetupComplete(true);
          setScanning(false);
          return;
        }
      } catch (e) {
        console.log("No .pageelrc.json found, proceeding to scan.");
        setScanPhase("No configuration found, scanning repository...", 50);
      }

      // Step 3: Check if workspace already has enough cached settings
      const ws = useCollectionStore.getState().workspace;
      if (ws && ws.settings.projectType && ws.collections.length > 0) {
        setScanPhase("Using cached settings", 100);
        setSetupComplete(true);
        setScanning(false);
        return;
      }

      // MA-08: Phase 3 - Scan Repository (50-100%)
      try {
        setScanPhase("Detecting production URL...", 60);
        const foundUrl = settings.domainUrl
          ? null
          : await gitService.findProductionUrl();
        if (foundUrl && !settings.domainUrl)
          setSettings((prev) => ({ ...prev, domainUrl: foundUrl }));

        setScanPhase("Scanning content directories...", 75);
        const contentDirs = await gitService.scanForContentDirectories();
        setSuggestedPostPaths(contentDirs);
        if (contentDirs.length > 0)
          setSettings((prev) => ({ ...prev, postsPath: contentDirs[0] }));

        setScanPhase("Scanning image directories...", 90);
        const imageDirs = await gitService.scanForImageDirectories();
        setSuggestedImagePaths(imageDirs);
        if (imageDirs.length > 0)
          setSettings((prev) => ({ ...prev, imagesPath: imageDirs[0] }));

        setScanPhase("Scan complete", 100);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setScanPhase(`Error: ${message}`, 0);
        console.error("Scan error:", error);
      } finally {
        setScanning(false);
      }
    };

    loadSettingsAndScan();
  }, [repo.full_name, gitService]);

  // Fetch stats when setup is complete
  const { isSetupComplete } = useSettingsStore();
  useEffect(() => {
    if (isSetupComplete) {
      fetchStats();
    }
  }, [isSetupComplete, fetchStats]);

  return {
    settings,
    setSettings,
    effectivePostsPath,
    effectiveImagesPath,
    suggestedPostPaths,
    suggestedImagePaths,
    currentRepo,
    isSynced,
    handleAction,
    fetchStats,
  };
}
