import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GithubUser, GithubRepo, IGitService, ServiceType, AppSettings, ProjectType } from '../types';
import { SETTINGS_SCHEMA, DEFAULT_SETTINGS, useNavigation, ViewType, useAppStore, useSettingsStore, useCollectionStore, loadCollectionsFromPageelrc, saveCollectionsToPageelrc, Collection, withSyncLock } from '../features';
import PostList from './PostList';
import CreatePostWrapper from './CreatePostWrapper';
import ImageList from './ImageList';
import { SettingsIcon } from './icons/SettingsIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import BackupManager from './BackupManager';
import TemplateGenerator from './TemplateGenerator';
import { useI18n } from '../i18n/I18nContext';
import { DocumentIcon } from './icons/DocumentIcon';
import { ImageIcon } from './icons/ImageIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { MenuIcon } from './icons/MenuIcon';
import DirectoryPicker from './DirectoryPicker';
import { DatabaseIcon } from './icons/DatabaseIcon';
import { BoardIcon } from './icons/BoardIcon';
import { TemplateIcon } from './icons/TemplateIcon';
import { Sidebar } from './Sidebar';
import { SetupWizard } from './SetupWizard';
import { SettingsView } from './SettingsView';
import { SyncStatusBadge } from './SyncStatusBadge';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { NewCollectionModal } from './NewCollectionModal';
import { EditCollectionModal } from './EditCollectionModal';

// --- MAIN DASHBOARD ---
interface DashboardProps {
    gitService: IGitService;
    repo: GithubRepo;
    user: GithubUser;
    serviceType: ServiceType;
    onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ gitService, repo, user, serviceType, onLogout }) => {
    // Use Zustand stores for global state
    const { activeView, setView, isSidebarOpen, setSidebarOpen, toggleSidebar, isScanning, setScanning, repoStats, setRepoStats, isSyncing, startSync, endSync, scanPhase, scanProgress, setScanPhase } = useAppStore();
    const { settings, setSettings, isSaving, setIsSaving, saveSuccess, setSaveSuccess, isSetupComplete, setSetupComplete } = useSettingsStore();
    const { initWorkspace, workspace, addCollection, getActiveCollection, updateSettings: updateWorkspaceSettings } = useCollectionStore();

    const [isNewCollectionModalOpen, setIsNewCollectionModalOpen] = useState(false);
    const [isEditCollectionModalOpen, setIsEditCollectionModalOpen] = useState(false);
    const [collectionToEdit, setCollectionToEdit] = useState<Collection | null>(null);
    const [isPickerOpen, setIsPickerOpen] = useState<'posts' | 'images' | null>(null);
    const [collectionPathPicker, setCollectionPathPicker] = useState<{type: 'posts' | 'images', callback: (path: string) => void} | null>(null);
    const importFileInputRef = useRef<HTMLInputElement>(null);
    const [importExportStatus, setImportExportStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Auto-clear success message
    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);


    const [suggestedPostPaths, setSuggestedPostPaths] = useState<string[]>([]);
    const [suggestedImagePaths, setSuggestedImagePaths] = useState<string[]>([]);
    const { t, language } = useI18n();

    const [currentRepo, setCurrentRepo] = useState<GithubRepo>(repo);
    const [lastWriteTime, setLastWriteTime] = useState<number | null>(null);
    const [isSynced, setIsSynced] = useState(true);
    // URL sync is now handled by useAppStore

    // Get active collection - use its paths, fallback to global settings
    const activeCollection = getActiveCollection();
    const effectivePostsPath = activeCollection?.postsPath || settings.postsPath;
    const effectiveImagesPath = activeCollection?.imagesPath || settings.imagesPath;

    const fetchStats = useCallback(async () => {
        setRepoStats({ postCount: null, imageCount: null });
        if (!gitService || !effectivePostsPath) return;
        try {
            const postContents = await gitService.getRepoContents(effectivePostsPath);
            const postCount = postContents.filter(item => item.type === 'file' && (item.name.endsWith('.md') || item.name.endsWith('.mdx'))).length;

            let imageCount = 0;
            try {
                if (effectiveImagesPath) {
                    const imageContents = await gitService.getRepoContents(effectiveImagesPath);
                    imageCount = imageContents.filter(item => item.type === 'file').length;
                }
            } catch { imageCount = 0; }

            setRepoStats({ postCount, imageCount });
        } catch { setRepoStats({ postCount: 0, imageCount: 0 }); }
    }, [gitService, effectivePostsPath, effectiveImagesPath]);

    // Sync Polling Logic
    const handleAction = useCallback(() => {
        setLastWriteTime(Date.now());
        setIsSynced(false);
    }, []);

    useEffect(() => {
        if (!lastWriteTime) return;
        const checkSync = async () => {
            try {
                const updatedRepo = await gitService.getRepoDetails();
                setCurrentRepo(updatedRepo);
                const pushedTime = new Date(updatedRepo.pushed_at).getTime();
                if (pushedTime >= (lastWriteTime - 10000)) {
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

    useEffect(() => {
        const loadSettingsAndScan = async () => {
            // Initialize collection workspace for this repo
            initWorkspace(repo.full_name);
            
            // Always attempt to load from .pageelrc.json first - Repo Config is the "Source of Truth"
            // This ensures settings are always fresh on login and prioritized over local cache
            const collectionsData = await loadCollectionsFromPageelrc(gitService, repo.full_name);
            if (collectionsData && collectionsData.collections.length > 0) {
                // Clear existing collections if any to avoid mixing
                const store = useCollectionStore.getState();
                const workspace = store.workspace;
                if (workspace) {
                    // Force refresh collections from config
                    store.setCollections(collectionsData.collections);
                    if (collectionsData.settings) {
                        updateWorkspaceSettings(collectionsData.settings);
                    }
                }
            }
            
            setScanning(true);
            // MA-08: Phase 1 - Load Local Settings (0-20%)
            setScanPhase('Loading saved settings...', 10);
            
            const prefix = repo.full_name;
            const keys: (keyof AppSettings)[] = [
                'projectType', 'postsPath', 'imagesPath', 'domainUrl', 'postFileTypes', 'imageFileTypes',
                'publishDateSource', 'imageCompressionEnabled', 'maxImageSize', 'imageResizeMaxWidth',
                'newPostCommit', 'updatePostCommit', 'newImageCommit', 'updateImageCommit'
            ];

            const loadedSettings: Partial<AppSettings> = {};
            keys.forEach((key) => {
                const storageKey = `${key}_${prefix}`;
                const value = localStorage.getItem(storageKey);
                if (value !== null) {
                    const validator = SETTINGS_SCHEMA[key];
                    let parsedValue: unknown = value;
                    if (value === 'true') parsedValue = true;
                    else if (value === 'false') parsedValue = false;
                    else if (!isNaN(Number(value)) && value !== '') parsedValue = Number(value);
                    if (!validator || validator(parsedValue)) {
                        (loadedSettings as Record<string, unknown>)[key] = parsedValue;
                    }
                }
            });
            if (loadedSettings.imageResizeMaxWidth === undefined) loadedSettings.imageResizeMaxWidth = 1024;
            setSettings(prev => ({ ...prev, ...loadedSettings }));

            setScanPhase('Loading saved settings...', 20);

            // MA-08: Phase 2 - Check Remote Config (20-50%)
            setScanPhase('Checking for .pageelrc.json...', 30);
            
            try {
                const configContent = await gitService.getFileContent('.pageelrc.json');
                const config = JSON.parse(configContent);
                if (config) {
                    const newSettings = { ...settings, ...loadedSettings };
                    const applyIfValid = (key: keyof AppSettings, value: any) => {
                        if (value !== undefined && SETTINGS_SCHEMA[key] && SETTINGS_SCHEMA[key](value)) {
                            (newSettings as any)[key] = value;
                        }
                    };
                    
                    // Paths & Project Info
                    if (config.projectType) applyIfValid('projectType', config.projectType);
                    if (config.paths?.posts) applyIfValid('postsPath', config.paths.posts);
                    if (config.paths?.images) applyIfValid('imagesPath', config.paths.images);
                    if (config.domainUrl) applyIfValid('domainUrl', config.domainUrl);

                    // Technical Settings
                    if (config.settings) {
                        applyIfValid('postFileTypes', config.settings.postFileTypes);
                        applyIfValid('imageFileTypes', config.settings.imageFileTypes);
                        applyIfValid('publishDateSource', config.settings.publishDateSource);
                        applyIfValid('imageCompressionEnabled', config.settings.imageCompressionEnabled);
                        applyIfValid('maxImageSize', config.settings.maxImageSize);
                        applyIfValid('imageResizeMaxWidth', config.settings.imageResizeMaxWidth);
                    }

                    // Commits
                    if (config.commits) {
                        applyIfValid('newPostCommit', config.commits.newPost);
                        applyIfValid('updatePostCommit', config.commits.updatePost);
                        applyIfValid('newImageCommit', config.commits.newImage);
                        applyIfValid('updateImageCommit', config.commits.updateImage);
                    }

                    // Update state and refresh local cache
                    setSettings(newSettings);
                    keys.forEach(key => {
                        if (newSettings[key] !== undefined) {
                            localStorage.setItem(`${key}_${prefix}`, String(newSettings[key]));
                        }
                    });

                    // UI & Templates
                    if (config.templates?.frontmatter) localStorage.setItem(`postTemplate_${prefix}`, JSON.stringify(config.templates.frontmatter));
                    if (config.ui?.tableColumns) localStorage.setItem(`postTableColumns_${prefix}`, JSON.stringify(config.ui.tableColumns));
                    if (config.ui?.columnWidths) localStorage.setItem(`postTableColumnWidths_${prefix}`, JSON.stringify(config.ui.columnWidths));

                    setScanPhase('Configuration loaded', 100);
                    setSetupComplete(true);
                    setScanning(false);
                    return; // Successfully loaded from config
                }
            } catch (e) {
                console.log("No valid .pageelrc.json found or fetch failed, proceeding to scan.");
                setScanPhase('No configuration found, scanning repository...', 50);
            }

            // 3. Fallback: If no config but we have enough info from cache, mark setup complete
            if (loadedSettings.projectType && loadedSettings.postsPath && loadedSettings.imagesPath) {
                setScanPhase('Using cached settings', 100);
                setSetupComplete(true);
                setScanning(false);
                return;
            }

            // MA-08: Phase 3 - Scan Repository (50-100%)
            try {
                setScanPhase('Detecting production URL...', 60);
                const foundUrl = settings.domainUrl ? null : await gitService.findProductionUrl();
                if (foundUrl && !settings.domainUrl) setSettings(prev => ({ ...prev, domainUrl: foundUrl }));

                setScanPhase('Scanning content directories...', 75);
                const contentDirs = await gitService.scanForContentDirectories();
                setSuggestedPostPaths(contentDirs);
                if (contentDirs.length > 0) setSettings(prev => ({ ...prev, postsPath: contentDirs[0] }));

                setScanPhase('Scanning image directories...', 90);
                const imageDirs = await gitService.scanForImageDirectories();
                setSuggestedImagePaths(imageDirs);
                if (imageDirs.length > 0) setSettings(prev => ({ ...prev, imagesPath: imageDirs[0] }));

                setScanPhase('Scan complete', 100);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                setScanPhase(`Error: ${message}`, 0);
                console.error('Scan error:', error);
            } finally {
                setScanning(false);
            }
        };

        loadSettingsAndScan();
    }, [repo.full_name, gitService]);

    useEffect(() => {
        if (isSetupComplete) {
            fetchStats();
        }
    }, [isSetupComplete, fetchStats]);

    const handleSettingsChange = (field: keyof AppSettings, value: string | number | boolean) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveSettings = async () => {
        setIsSaving(true);
        setSaveSuccess(false);
        try {
            const keys: (keyof AppSettings)[] = Object.keys(settings) as (keyof AppSettings)[];
            keys.forEach(key => {
                // MA-06: ALL settings keys are now scoped by repoId
                const storageKey = `${key}_${repo.full_name}`;
                localStorage.setItem(storageKey, String(settings[key]));
            });

            // BUG-12: Support .pageelrc.json v2 and prevent data loss (collections)
            if (workspace) {
                // 1. Sync workspace settings with current global settings
                updateWorkspaceSettings(settings);
                
                // 2. Refresh active collection's UI/Template settings from localStorage (scoped)
                const activeCollection = getActiveCollection();
                if (activeCollection) {
                    const prefix = repo.full_name;
                    const savedTemplate = localStorage.getItem(`postTemplate_${prefix}`);
                    const savedColumns = localStorage.getItem(`postTableColumns_${prefix}`);
                    const savedWidths = localStorage.getItem(`postTableColumnWidths_${prefix}`);
                    
                    if (savedTemplate || savedColumns || savedWidths) {
                        const updates: any = {};
                        if (savedTemplate) updates.template = JSON.parse(savedTemplate);
                        if (savedColumns) updates.tableColumns = JSON.parse(savedColumns);
                        if (savedWidths) updates.columnWidths = JSON.parse(savedWidths);
                        
                        // We don't want to trigger a full loop, but we need to ensure config is fresh
                        activeCollection.template = updates.template || activeCollection.template;
                        activeCollection.tableColumns = updates.tableColumns || activeCollection.tableColumns;
                        activeCollection.columnWidths = updates.columnWidths || activeCollection.columnWidths;
                    }
                }


                // 3. Save to Git using the standard utility (WF-06: with sync lock)
                const success = await withSyncLock(
                    () => saveCollectionsToPageelrc(gitService, {
                        ...workspace,
                        settings: { ...workspace.settings, ...settings }
                    }),
                    'Saving settings...'
                );
                
                if (success) {
                    handleAction();
                } else {
                    console.error("Failed to save .pageelrc.json to repository");
                }
            } else {
                // Fallback for very old v1 if workspace initialization failed (unlikely)
                try {
                    const sha = await (gitService as any).getFileSha('.pageelrc.json');
                    if (sha) {
                        const templateKey = `postTemplate_${repo.full_name}`;
                        const columnsKey = `postTableColumns_${repo.full_name}`;
                        const savedTemplate = localStorage.getItem(templateKey);
                        const savedColumns = localStorage.getItem(columnsKey);
                        
                        const configObject = {
                            version: 1,
                            projectType: settings.projectType,
                            paths: { posts: settings.postsPath, images: settings.imagesPath },
                            domainUrl: settings.domainUrl,
                            templates: { frontmatter: savedTemplate ? JSON.parse(savedTemplate) : undefined },
                            ui: { tableColumns: savedColumns ? JSON.parse(savedColumns) : undefined },
                            settings: {
                                postFileTypes: settings.postFileTypes,
                                imageFileTypes: settings.imageFileTypes,
                                publishDateSource: settings.publishDateSource,
                                imageCompressionEnabled: settings.imageCompressionEnabled,
                                maxImageSize: settings.maxImageSize,
                                imageResizeMaxWidth: settings.imageResizeMaxWidth
                            },
                            commits: {
                                newPost: settings.newPostCommit,
                                updatePost: settings.updatePostCommit,
                                newImage: settings.newImageCommit,
                                updateImage: settings.updateImageCommit
                            }
                        };
                        // WF-06: Wrap with sync lock
                        await withSyncLock(
                            () => gitService.updateFileContent('.pageelrc.json', JSON.stringify(configObject, null, 2), 'chore: update pageel-cms config', sha),
                            'Saving settings...'
                        );
                        handleAction();
                    }
                } catch (e) {
                    console.warn("Could not update legacy .pageelrc.json", e);
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
        // BUG-15: Export complete configuration including collections and UI settings
        
        // Export from workspace (v2 format) if available
        if (workspace && workspace.collections.length > 0) {
            const exportData = {
                version: 2,
                settings: workspace.settings,
                commitMessages: {
                    newPost: workspace.settings.newPostCommit,
                    updatePost: workspace.settings.updatePostCommit,
                    newImage: workspace.settings.newImageCommit,
                    updateImage: workspace.settings.updateImageCommit
                },
                collections: workspace.collections.map(c => ({
                    id: c.id,
                    name: c.name,
                    postsPath: c.postsPath,
                    imagesPath: c.imagesPath,
                    template: c.template,
                    tableColumns: c.tableColumns,
                    columnWidths: c.columnWidths
                })),
                activeCollectionId: workspace.activeCollectionId
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            const date = new Date().toISOString().split('T')[0];
            link.download = `pageel-cms-config-${repo.name}-${date}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            return;
        }
        
        // Fallback: Export from localStorage (legacy v1 format)
        const repoScopedKeys = [
            'projectType', 'postsPath', 'imagesPath', 'domainUrl', 'postTemplate',
            'postFileTypes', 'imageFileTypes', 'publishDateSource', 'imageCompressionEnabled',
            'maxImageSize', 'imageResizeMaxWidth', 'newPostCommit', 'updatePostCommit',
            'newImageCommit', 'updateImageCommit', 'postTableColumns', 'postTableColumnWidths'
        ];

        const settingsToExport: { [key: string]: any } = {};
        
        // Export repo-scoped keys
        repoScopedKeys.forEach(key => {
            const storageKey = `${key}_${repo.full_name}`;
            const value = localStorage.getItem(storageKey);
            if (value !== null) {
                try {
                    if (key === 'imageCompressionEnabled') {
                        settingsToExport[key] = value === 'true';
                    } else if (['maxImageSize', 'imageResizeMaxWidth'].includes(key)) {
                        settingsToExport[key] = Number(value);
                    } else if (['postTemplate', 'postTableColumns', 'postTableColumnWidths'].includes(key)) {
                        // Parse JSON fields
                        settingsToExport[key] = JSON.parse(value);
                    } else {
                        settingsToExport[key] = value;
                    }
                } catch (e) {
                    // If JSON parsing fails, use raw value
                    settingsToExport[key] = value;
                }
            }
        });
        
        // Export global language setting (user preference)
        const lang = localStorage.getItem('pageel-cms-lang');
        if (lang) settingsToExport['pageel-cms-lang'] = lang;

        const blob = new Blob([JSON.stringify(settingsToExport, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const date = new Date().toISOString().split('T')[0];
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

                // Check if it's v2 format with collections (detect by collections array, not version number)
                if (Array.isArray(importedConfig.collections) && importedConfig.collections.length > 0) {
                    // BUG-14 Fix: Import v2 config directly to repository
                    // Ensure version is set for proper loading
                    const configToSave = {
                        version: 2,
                        ...importedConfig
                    };
                    
                    try {
                        await withSyncLock(async () => {
                            const sha = await (gitService as any).getFileSha('.pageelrc.json');
                            if (sha) {
                                await gitService.updateFileContent('.pageelrc.json', JSON.stringify(configToSave, null, 2), 'chore: import pageel-cms config', sha);
                            } else {
                                await gitService.createFileFromString('.pageelrc.json', JSON.stringify(configToSave, null, 2), 'chore: import pageel-cms config');
                            }
                        }, 'Importing configuration...');
                        
                        handleAction();
                        setImportExportStatus({ type: 'success', message: t('dashboard.settings.importExport.importSuccess') });
                        setTimeout(() => window.location.reload(), 2000);
                    } catch (err) {
                        console.error('Failed to save imported config:', err);
                        setImportExportStatus({ type: 'error', message: 'Failed to save configuration to repository' });
                    }
                    return;
                }

                // Legacy v1 format or flat settings format
                // Validate settings
                for (const key in importedConfig) {
                    if (!Object.prototype.hasOwnProperty.call(SETTINGS_SCHEMA, key)) {
                        continue;
                    }
                    const validator = SETTINGS_SCHEMA[key];
                    const value = importedConfig[key];
                    if (!validator(value)) {
                        throw new Error(`Invalid value for setting '${key}'.`);
                    }
                }

                // Save to localStorage
                Object.entries(importedConfig).forEach(([key, value]) => {
                    if (!SETTINGS_SCHEMA[key] && key !== 'pageel-cms-lang') return;
                    const storageKey = key === 'pageel-cms-lang' ? key : `${key}_${repo.full_name}`;
                    localStorage.setItem(storageKey, String(value));
                });

                // Build and save v1 config to repository
                try {
                    const configObject = {
                        version: 1,
                        projectType: importedConfig.projectType || settings.projectType,
                        paths: { 
                            posts: importedConfig.postsPath || settings.postsPath, 
                            images: importedConfig.imagesPath || settings.imagesPath 
                        },
                        domainUrl: importedConfig.domainUrl || settings.domainUrl,
                        settings: {
                            postFileTypes: importedConfig.postFileTypes || settings.postFileTypes,
                            imageFileTypes: importedConfig.imageFileTypes || settings.imageFileTypes,
                            publishDateSource: importedConfig.publishDateSource || settings.publishDateSource,
                            imageCompressionEnabled: importedConfig.imageCompressionEnabled ?? settings.imageCompressionEnabled,
                            maxImageSize: importedConfig.maxImageSize || settings.maxImageSize,
                            imageResizeMaxWidth: importedConfig.imageResizeMaxWidth || settings.imageResizeMaxWidth
                        },
                        commits: {
                            newPost: importedConfig.newPostCommit || settings.newPostCommit,
                            updatePost: importedConfig.updatePostCommit || settings.updatePostCommit,
                            newImage: importedConfig.newImageCommit || settings.newImageCommit,
                            updateImage: importedConfig.updateImageCommit || settings.updateImageCommit
                        }
                    };

                    await withSyncLock(async () => {
                        const sha = await (gitService as any).getFileSha('.pageelrc.json');
                        if (sha) {
                            await gitService.updateFileContent('.pageelrc.json', JSON.stringify(configObject, null, 2), 'chore: import pageel-cms config', sha);
                        } else {
                            await gitService.createFileFromString('.pageelrc.json', JSON.stringify(configObject, null, 2), 'chore: import pageel-cms config');
                        }
                    }, 'Importing configuration...');
                    
                    handleAction();
                    setImportExportStatus({ type: 'success', message: t('dashboard.settings.importExport.importSuccess') });
                    setTimeout(() => window.location.reload(), 2000);
                } catch (err) {
                    console.error('Failed to save imported config:', err);
                    setImportExportStatus({ type: 'error', message: 'Failed to save configuration to repository' });
                }

            } catch (err) {
                let message = t('dashboard.settings.importExport.importError.validation');
                if (err instanceof SyntaxError) message = t('dashboard.settings.importExport.importError.json');
                setImportExportStatus({ type: 'error', message });
            } finally {
                if (event.target) event.target.value = '';
            }
        };
        reader.onerror = () => {
            setImportExportStatus({ type: 'error', message: t('dashboard.settings.importExport.importError.read') });
            if (event.target) event.target.value = '';
        };
        reader.readAsText(file);
    };

    const handleFinishSetup = async (collectionName: string) => {
        const isReady = settings.projectType === 'github'
            ? !!settings.postsPath && !!settings.imagesPath
            : !!settings.postsPath && !!settings.imagesPath && !!settings.domainUrl;

        if (isReady) {
            // Note: Don't call handleSaveSettings() here - it would save empty workspace and overwrite our config
            // We create the full config with collection directly below
            const prefix = repo.full_name;
            const savedTemplate = localStorage.getItem(`postTemplate_${prefix}`);
            const savedColumns = localStorage.getItem(`postTableColumns_${prefix}`);
            const savedWidths = localStorage.getItem(`postTableColumnWidths_${prefix}`);

            try {
                // Create v2 workspace with named collection
                const initialCollection = {
                    id: `collection-${Date.now()}`,
                    name: collectionName || 'Main Collection',
                    postsPath: settings.postsPath,
                    imagesPath: settings.imagesPath,
                    template: savedTemplate ? JSON.parse(savedTemplate) : undefined,
                    tableColumns: savedColumns ? JSON.parse(savedColumns) : undefined,
                    columnWidths: savedWidths ? JSON.parse(savedWidths) : undefined
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
                        imageResizeMaxWidth: settings.imageResizeMaxWidth
                    },
                    commitMessages: {
                        newPost: settings.newPostCommit,
                        updatePost: settings.updatePostCommit,
                        newImage: settings.newImageCommit,
                        updateImage: settings.updateImageCommit
                    },
                    collections: [initialCollection]
                };

                // WF-06: Wrap with sync lock
                await withSyncLock(
                    () => gitService.createFileFromString('.pageelrc.json', JSON.stringify(workspaceConfig, null, 2), 'chore: add pageel-cms config'),
                    'Creating configuration...'
                );
                
                // Initialize workspace directly from created data (avoid re-fetching from repo due to caching)
                const collectionStore = useCollectionStore.getState();
                if (!collectionStore.workspace) {
                    initWorkspace(repo.full_name);
                }
                
                // Create Collection object from initialCollection data
                const newCollection: Collection = {
                    id: initialCollection.id,
                    name: initialCollection.name,
                    postsPath: initialCollection.postsPath,
                    imagesPath: initialCollection.imagesPath,
                    template: initialCollection.template,
                    tableColumns: initialCollection.tableColumns,
                    columnWidths: initialCollection.columnWidths,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                // Use Zustand actions to set up workspace
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
                    updateImageCommit: settings.updateImageCommit
                });
                
                handleAction();
            } catch (e) {
                console.warn("Failed to create .pageelrc.json or it already exists", e);
            }
            setSetupComplete(true);
        }
    }

    const handleDeleteConfig = async () => {
        setIsSaving(true);
        try {
            // 1. Delete .pageelrc.json from repository (WF-06: with sync lock)
            const sha = await (gitService as any).getFileSha('.pageelrc.json');
            if (sha) {
                await withSyncLock(
                    () => gitService.deleteFile('.pageelrc.json', sha, 'chore: delete pageel-cms config'),
                    'Deleting configuration...'
                );
            }
            
            // 2. BUG-13: Clear ALL localStorage keys for this repo
            const prefix = repo.full_name;
            const allLocalStorageKeys = Object.keys(localStorage);
            
            // Remove all keys that contain the repo prefix
            allLocalStorageKeys.forEach(key => {
                if (key.includes(prefix)) {
                    localStorage.removeItem(key);
                }
            });
            
            // Also remove these specific scoped keys
            const repoSpecificKeys = [
                `projectType_${prefix}`, `postsPath_${prefix}`, `imagesPath_${prefix}`,
                `domainUrl_${prefix}`, `postTemplate_${prefix}`,
                `postTableColumns_${prefix}`, `postTableColumnWidths_${prefix}`,
                `postFileTypes_${prefix}`, `imageFileTypes_${prefix}`,
                `publishDateSource_${prefix}`, `imageCompressionEnabled_${prefix}`,
                `maxImageSize_${prefix}`, `imageResizeMaxWidth_${prefix}`,
                `newPostCommit_${prefix}`, `updatePostCommit_${prefix}`,
                `newImageCommit_${prefix}`, `updateImageCommit_${prefix}`
            ];
            repoSpecificKeys.forEach(key => localStorage.removeItem(key));

            // 3. Clear session storage (authentication)
            sessionStorage.removeItem('github_pat_encrypted');
            sessionStorage.removeItem('crypto_key');
            sessionStorage.removeItem('selected_repo');
            sessionStorage.removeItem('service_type');
            sessionStorage.removeItem('instance_url');
            
            // 4. Reset collection store and clear persisted Zustand data
            const collectionStore = useCollectionStore.getState();
            collectionStore.resetWorkspace();
            
            // BUG-13 Fix: Clear Zustand persisted states
            localStorage.removeItem('pageel-settings');  // Settings store persist
            localStorage.removeItem('pageel-collections'); // Already done in resetWorkspace, but ensure
            
            // 5. Reset setup state BEFORE reload
            setSetupComplete(false);
            
            // 6. Force page reload to restart from login/setup
            window.location.reload();
        } catch (e) {
            console.error("Failed to delete config:", e);
            alert("Failed to delete .pageelrc.json. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCollectionCreated = async () => {
        const latestWorkspace = useCollectionStore.getState().workspace;
        if (latestWorkspace) {
            // WF-06: Wrap with sync lock
            await withSyncLock(
                () => saveCollectionsToPageelrc(gitService, latestWorkspace),
                'Saving collection...'
            );
            setSuccessMessage(t('dashboard.success.collectionCreated'));
            setIsNewCollectionModalOpen(false);
        }
    };

    const handleEditCollection = (collection: Collection) => {
        setCollectionToEdit(collection);
        setIsEditCollectionModalOpen(true);
    };

    const handleCollectionUpdated = async () => {
        const latestWorkspace = useCollectionStore.getState().workspace;
        if (latestWorkspace) {
            // WF-06: Wrap with sync lock
            await withSyncLock(
                () => saveCollectionsToPageelrc(gitService, latestWorkspace),
                'Updating collection...'
            );
            setSuccessMessage(t('dashboard.success.collectionUpdated'));
            setIsEditCollectionModalOpen(false);
        }
    };

    const handleDeleteCollection = async () => {
        const latestWorkspace = useCollectionStore.getState().workspace;
        if (latestWorkspace) {
            // WF-06: Wrap with sync lock
            await withSyncLock(
                () => saveCollectionsToPageelrc(gitService, latestWorkspace),
                'Deleting collection...'
            );
            setSuccessMessage(t('dashboard.success.collectionDeleted'));
        }
    };

    const handleSelectPath = (type: 'posts' | 'images', callback: (path: string) => void) => {
        setCollectionPathPicker({ type, callback });
    };

    const navLinks = [
        { id: 'dashboard', label: t('dashboard.nav.manage'), icon: DatabaseIcon },
        { id: 'images', label: t('dashboard.nav.manageImages'), icon: ImageIcon },
        { id: 'template', label: t('dashboard.nav.template'), icon: TemplateIcon },
        { id: 'workflows', label: t('dashboard.nav.workflows'), icon: BoardIcon },
        { id: 'backup', label: t('dashboard.nav.backup'), icon: DownloadIcon },
        { id: 'settings', label: t('dashboard.nav.settings'), icon: SettingsIcon },
    ];

    const handleMobileNavClick = (view: string) => {
        setView(view as ViewType);
        setSidebarOpen(false);
    };

    if (isScanning) {
        return (
            <div className="flex justify-center items-center h-screen flex-col bg-white">
                <SpinnerIcon className="animate-spin h-8 w-8 text-notion-text mb-4" />
                <p className="text-notion-muted">{t('dashboard.setup.scanning')}</p>
            </div>
        );
    }

    if (!isSetupComplete) {
        return (
            <SetupWizard
                gitService={gitService}
                settings={settings}
                onSettingsChange={handleSettingsChange}
                suggestedPostPaths={suggestedPostPaths}
                suggestedImagePaths={suggestedImagePaths}
                onFinish={handleFinishSetup}
            />
        );
    }

    const getPageIcon = () => {
        switch (activeView) {
            case 'dashboard': return <DatabaseIcon className="w-8 h-8 text-notion-text mr-3" />;
            case 'images': return <ImageIcon className="w-8 h-8 text-notion-text mr-3" />;
            case 'template': return <TemplateIcon className="w-8 h-8 text-notion-text mr-3" />;
            case 'workflows': return <BoardIcon className="w-8 h-8 text-notion-text mr-3" />;
            case 'backup': return <DownloadIcon className="w-8 h-8 text-notion-text mr-3" />;
            case 'settings': return <SettingsIcon className="w-8 h-8 text-notion-text mr-3" />;
            default: return <DocumentIcon className="w-8 h-8 text-notion-text mr-3" />;
        }
    }

    const getPageTitle = () => {
        switch (activeView) {
            case 'dashboard': return t('dashboard.header.title');
            case 'images': return t('dashboard.nav.manageImages');
            case 'template': return t('dashboard.nav.template');
            case 'workflows': return t('dashboard.nav.workflows');
            case 'backup': return t('dashboard.nav.backup');
            case 'settings': return t('dashboard.nav.settings');
            default: return '';
        }
    }

    const renderContent = () => {
        switch (activeView) {
            case 'dashboard':
                return (
                    <PostList
                        gitService={gitService}
                        repo={currentRepo}
                        path={effectivePostsPath}
                        imagesPath={effectiveImagesPath}
                        domainUrl={settings.domainUrl}
                        projectType={settings.projectType}
                        onPostUpdate={fetchStats}
                        postFileTypes={settings.postFileTypes}
                        imageFileTypes={settings.imageFileTypes}
                        newImageCommitTemplate={settings.newImageCommit}
                        updatePostCommitTemplate={settings.updatePostCommit}
                        imageCompressionEnabled={settings.imageCompressionEnabled}
                        maxImageSize={settings.maxImageSize}
                        imageResizeMaxWidth={settings.imageResizeMaxWidth}
                        onAction={handleAction}
                    />
                );
            case 'workflows':
                return (
                    <CreatePostWrapper
                        gitService={gitService}
                        repo={currentRepo}
                        settings={settings}
                        postsPath={effectivePostsPath}
                        imagesPath={effectiveImagesPath}
                        collectionId={activeCollection?.id}
                        onComplete={() => {
                            setView('dashboard');
                        }}
                        onAction={handleAction}
                    />
                );
            case 'images': return (
                <ImageList
                    gitService={gitService}
                    repo={currentRepo}
                    path={effectiveImagesPath}
                    imageFileTypes={settings.imageFileTypes}
                    domainUrl={settings.domainUrl}
                    projectType={settings.projectType}
                    repoStats={repoStats}
                    imageCompressionEnabled={settings.imageCompressionEnabled}
                    maxImageSize={settings.maxImageSize}
                    imageResizeMaxWidth={settings.imageResizeMaxWidth}
                    commitTemplate={settings.newImageCommit}
                    onAction={handleAction}
                />
            );
            case 'template': return (
                <TemplateGenerator 
                    gitService={gitService} 
                    repo={currentRepo} 
                    postsPath={effectivePostsPath} 
                    collectionId={activeCollection?.id}
                    onTemplateSaved={async () => {
                        const latestWorkspace = useCollectionStore.getState().workspace;
                        if (latestWorkspace) {
                            // WF-06: Wrap with sync lock
                            await withSyncLock(
                                () => saveCollectionsToPageelrc(gitService, latestWorkspace),
                                'Saving template...'
                            );
                        }
                    }}
                />
            );
            case 'backup': return <BackupManager gitService={gitService} repo={currentRepo} postsPath={effectivePostsPath} imagesPath={effectiveImagesPath} />;
            case 'settings': return (
                <SettingsView
                    settings={settings}
                    onSettingsChange={handleSettingsChange}
                    onSave={handleSaveSettings}
                    isSaving={isSaving}
                    saveSuccess={saveSuccess}
                    user={user}
                    repo={currentRepo}
                    onLogout={onLogout}
                    onDeleteConfig={handleDeleteConfig}
                    onExport={handleExportSettings}
                    onImportClick={handleImportClick}
                    fileInputRef={importFileInputRef}
                    onFileImport={handleFileImport}
                    importStatus={importExportStatus}
                    onOpenPicker={(type) => setIsPickerOpen(type)}
                />
            );
            default: return null;
        }
    };

    const lastUpdated = currentRepo.pushed_at
        ? new Date(currentRepo.pushed_at).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')
        : '...';

    return (
        <div className="flex h-screen bg-white font-sans overflow-hidden text-notion-text">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)}></div>
            )}

            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 z-30 w-60 transform bg-notion-sidebar transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <Sidebar
                    activeView={activeView}
                    onNavClick={handleMobileNavClick}
                    navLinks={navLinks}
                    user={user}
                    serviceType={serviceType}
                    onLogout={onLogout}
                    onResetAndLogout={() => { }}
                    isSynced={isSynced}
                    repoStats={repoStats}
                    lastUpdated={lastUpdated}
                    onNewCollection={() => setIsNewCollectionModalOpen(true)}
                    onEditCollection={handleEditCollection}
                    onDeleteCollection={handleDeleteCollection}
                />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-white">
                {/* Sync Warning Banner */}
                {!isSynced && (
                    <div className="bg-white border-b border-notion-border px-4 py-2 flex items-center justify-center sticky top-0 z-40 shadow-sm animate-fade-in text-xs">
                        <div className="flex items-center text-yellow-600">
                            <ExclamationTriangleIcon className="h-3.5 w-3.5 mr-2" />
                            <span className="font-medium">{t('dashboard.syncWarning.description')}</span>
                        </div>
                    </div>
                )}
                
                {/* WF-06: Sync Progress Banner */}
                {isSyncing && (
                    <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-center sticky top-0 z-40 shadow-sm animate-fade-in text-xs">
                        <div className="flex items-center text-blue-700">
                            <SpinnerIcon className="h-3.5 w-3.5 mr-2 animate-spin" />
                            <span className="font-medium">{useAppStore.getState().syncMessage || 'Syncing...'}</span>
                        </div>
                    </div>
                )}

                {/* Mobile Header with Breadcrumb */}
                <div className="lg:hidden flex items-center justify-between bg-white border-b border-notion-border p-4">
                    <div className="flex items-center overflow-hidden">
                        <button onClick={() => setSidebarOpen(true)} className="p-1 -ml-1 rounded-sm text-gray-500 hover:bg-gray-100 focus:outline-none flex-shrink-0 mr-2">
                            <MenuIcon className="h-6 w-6" />
                        </button>
                        <div className="flex items-center text-sm overflow-hidden whitespace-nowrap leading-none">
                            <span className="text-gray-500 truncate max-w-[120px]">{currentRepo.name}</span>
                            <span className="mx-2 text-gray-300 text-lg font-light">/</span>
                            <span className="font-semibold text-gray-800 truncate">{getPageTitle()}</span>
                        </div>
                    </div>
                    <div className="flex items-center flex-shrink-0 ml-2">
                        <SyncStatusBadge isSynced={isSynced} />
                    </div>
                </div>

                <main className="flex-1 overflow-y-auto bg-white">
                    <div className="w-full max-w-full px-6 py-8 sm:px-8 lg:px-12 mx-auto">
                        {/* Notion-style Page Header */}
                        <div className="mb-8 group">
                            <div className="flex items-center mb-6">
                                {getPageIcon()}
                                <h1 className="text-4xl font-bold text-notion-text tracking-tight">{getPageTitle()}</h1>
                            </div>
                        </div>

                        {renderContent()}
                    </div>
                </main>
            </div>

            {isPickerOpen && (
                <DirectoryPicker
                    gitService={gitService}
                    repo={repo}
                    onClose={() => setIsPickerOpen(null)}
                    onSelect={(path) => {
                        handleSettingsChange(isPickerOpen === 'posts' ? 'postsPath' : 'imagesPath', path);
                        setIsPickerOpen(null);
                    }}
                    initialPath={isPickerOpen === 'posts' ? settings.postsPath : settings.imagesPath}
                />
            )}

            {/* New Collection Modal */}
            <NewCollectionModal
                isOpen={isNewCollectionModalOpen}
                onClose={() => setIsNewCollectionModalOpen(false)}
                onSelectPath={handleSelectPath}
                onCreated={handleCollectionCreated}
            />

            {/* Edit Collection Modal */}
            <EditCollectionModal
                isOpen={isEditCollectionModalOpen}
                onClose={() => setIsEditCollectionModalOpen(false)}
                collection={collectionToEdit}
                onSelectPath={handleSelectPath}
                onUpdated={handleCollectionUpdated}
            />

            {/* Collection Path Picker */}
            {collectionPathPicker && (
                <DirectoryPicker
                    gitService={gitService}
                    repo={repo}
                    onClose={() => setCollectionPathPicker(null)}
                    onSelect={(path) => {
                        collectionPathPicker.callback(path);
                        setCollectionPathPicker(null);
                    }}
                    initialPath=""
                />
            )}

            {/* Success Message Toast */}
            {successMessage && (
                <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg animate-fade-in z-50">
                    {successMessage}
                </div>
            )}
        </div>
    );
};

export default Dashboard;
