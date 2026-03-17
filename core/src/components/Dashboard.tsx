/**
 * Dashboard Component
 * 
 * TD-07: Refactored from 1246-line God Component to ~350-line layout component.
 * Business logic extracted to:
 * - useDashboardInit: settings, sync, scan, stats
 * - useConfigManager: save, export, import, delete, setup
 */

import React, { useState, useEffect } from "react";
import {
  GithubUser,
  GithubRepo,
  IGitService,
  ServiceType,
} from "../types";
import {
  useNavigation,
  ViewType,
  useAppStore,
  useSettingsStore,
  useCollectionStore,
  saveCollectionsToPageelrc,
  Collection,
  withSyncLock,
} from "../features";
import { useDashboardInit } from "../hooks/useDashboardInit";
import { useConfigManager } from "../hooks/useConfigManager";
import PostList from "./PostList";
import CreatePostWrapper from "./CreatePostWrapper";
import ImageList from "./ImageList";
import { SettingsIcon } from "./icons/SettingsIcon";
import { SpinnerIcon } from "./icons/SpinnerIcon";
import BackupManager from "./BackupManager";
import TemplateGenerator from "./TemplateGenerator";
import { useI18n } from "../i18n/I18nContext";
import { DocumentIcon } from "./icons/DocumentIcon";
import { ImageIcon } from "./icons/ImageIcon";
import { DownloadIcon } from "./icons/DownloadIcon";
import { MenuIcon } from "./icons/MenuIcon";
import DirectoryPicker from "./DirectoryPicker";
import { DatabaseIcon } from "./icons/DatabaseIcon";
import { BoardIcon } from "./icons/BoardIcon";
import { TemplateIcon } from "./icons/TemplateIcon";
import { Sidebar } from "./Sidebar";
import { SetupWizard } from "./SetupWizard";
import { SettingsView } from "./SettingsView";
import { SyncStatusBadge } from "./SyncStatusBadge";
import { ExclamationTriangleIcon } from "./icons/ExclamationTriangleIcon";
import { NewCollectionModal } from "./NewCollectionModal";
import { EditCollectionModal } from "./EditCollectionModal";

// --- MAIN DASHBOARD ---
interface DashboardProps {
  gitService: IGitService;
  repo: GithubRepo;
  user: GithubUser;
  serviceType: ServiceType;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  gitService,
  repo,
  user,
  serviceType,
  onLogout,
}) => {
  // Zustand stores
  const {
    activeView,
    setView,
    isSidebarOpen,
    setSidebarOpen,
    isScanning,
    repoStats,
    scanPhase,
    scanProgress,
  } = useAppStore();
  const { isSaving, saveSuccess, isSetupComplete } = useSettingsStore();
  const { workspace, getActiveCollection } = useCollectionStore();
  const activeCollection = getActiveCollection();

  // TD-07: Extracted hooks
  const {
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
  } = useDashboardInit({ gitService, repo });

  const {
    handleSettingsChange,
    handleSaveSettings,
    handleExportSettings,
    handleImportClick,
    handleFileImport,
    importFileInputRef,
    importExportStatus,
    handleDeleteConfig,
    handleFinishSetup,
  } = useConfigManager({ gitService, repo, settings, handleAction });

  // Local UI state
  const [isNewCollectionModalOpen, setIsNewCollectionModalOpen] = useState(false);
  const [isEditCollectionModalOpen, setIsEditCollectionModalOpen] = useState(false);
  const [collectionToEdit, setCollectionToEdit] = useState<Collection | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState<"posts" | "images" | null>(null);
  const [collectionPathPicker, setCollectionPathPicker] = useState<{
    type: "posts" | "images";
    callback: (path: string) => void;
  } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { t, language } = useI18n();

  // Auto-clear success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Collection handlers
  const handleCollectionCreated = async () => {
    const latestWorkspace = useCollectionStore.getState().workspace;
    if (latestWorkspace) {
      await withSyncLock(
        () => saveCollectionsToPageelrc(gitService, latestWorkspace),
        "Saving collection...",
      );
      setSuccessMessage(t("dashboard.success.collectionCreated"));
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
      await withSyncLock(
        () => saveCollectionsToPageelrc(gitService, latestWorkspace),
        "Updating collection...",
      );
      setSuccessMessage(t("dashboard.success.collectionUpdated"));
      setIsEditCollectionModalOpen(false);
    }
  };

  const handleDeleteCollection = async () => {
    const latestWorkspace = useCollectionStore.getState().workspace;
    if (latestWorkspace) {
      await withSyncLock(
        () => saveCollectionsToPageelrc(gitService, latestWorkspace),
        "Deleting collection...",
      );
      setSuccessMessage(t("dashboard.success.collectionDeleted"));
    }
  };

  const handleMobileNavClick = (view: string) => {
    setView(view as ViewType);
    setSidebarOpen(false);
  };

  // Scanning state
  if (isScanning) {
    return (
      <div className="flex justify-center items-center h-screen flex-col bg-white">
        <SpinnerIcon className="animate-spin h-8 w-8 text-notion-text mb-4" />
        <p className="text-notion-muted">{t("dashboard.setup.scanning")}</p>
      </div>
    );
  }

  // Setup wizard
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

  // Navigation
  const navLinks = [
    { id: "dashboard", label: t("dashboard.nav.manage"), icon: DatabaseIcon },
    { id: "images", label: t("dashboard.nav.manageImages"), icon: ImageIcon },
    { id: "template", label: t("dashboard.nav.template"), icon: TemplateIcon },
    { id: "workflows", label: t("dashboard.nav.workflows"), icon: BoardIcon },
    { id: "backup", label: t("dashboard.nav.backup"), icon: DownloadIcon },
    { id: "settings", label: t("dashboard.nav.settings"), icon: SettingsIcon },
  ];

  const getPageIcon = () => {
    const icons: Record<string, React.ReactNode> = {
      dashboard: <DatabaseIcon className="w-8 h-8 text-notion-text mr-3" />,
      images: <ImageIcon className="w-8 h-8 text-notion-text mr-3" />,
      template: <TemplateIcon className="w-8 h-8 text-notion-text mr-3" />,
      workflows: <BoardIcon className="w-8 h-8 text-notion-text mr-3" />,
      backup: <DownloadIcon className="w-8 h-8 text-notion-text mr-3" />,
      settings: <SettingsIcon className="w-8 h-8 text-notion-text mr-3" />,
    };
    return icons[activeView] || <DocumentIcon className="w-8 h-8 text-notion-text mr-3" />;
  };

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      dashboard: t("dashboard.header.title"),
      images: t("dashboard.nav.manageImages"),
      template: t("dashboard.nav.template"),
      workflows: t("dashboard.nav.workflows"),
      backup: t("dashboard.nav.backup"),
      settings: t("dashboard.nav.settings"),
    };
    return titles[activeView] || "";
  };

  const renderContent = () => {
    switch (activeView) {
      case "dashboard":
        return (
          <PostList
            gitService={gitService}
            repo={currentRepo}
            onPostUpdate={fetchStats}
            onAction={handleAction}
          />
        );
      case "workflows":
        return (
          <CreatePostWrapper
            gitService={gitService}
            repo={currentRepo}
            settings={settings}
            postsPath={effectivePostsPath}
            imagesPath={effectiveImagesPath}
            collectionId={activeCollection?.id}
            onComplete={() => setView("dashboard")}
            onAction={handleAction}
          />
        );
      case "images":
        return (
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
      case "template":
        return (
          <TemplateGenerator
            gitService={gitService}
            repo={currentRepo}
            postsPath={effectivePostsPath}
            collectionId={activeCollection?.id}
            onTemplateSaved={async () => {
              const latestWorkspace = useCollectionStore.getState().workspace;
              if (latestWorkspace) {
                await withSyncLock(
                  () => saveCollectionsToPageelrc(gitService, latestWorkspace),
                  "Saving template...",
                );
              }
            }}
          />
        );
      case "backup":
        return (
          <BackupManager
            gitService={gitService}
            repo={currentRepo}
            postsPath={effectivePostsPath}
            imagesPath={effectiveImagesPath}
          />
        );
      case "settings":
        return (
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
      default:
        return null;
    }
  };

  const lastUpdated = currentRepo.pushed_at
    ? new Date(currentRepo.pushed_at).toLocaleString(
        language === "vi" ? "vi-VN" : "en-US",
      )
    : "...";

  return (
    <div className="flex h-screen bg-white font-sans overflow-hidden text-notion-text">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-60 transform bg-notion-sidebar transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <Sidebar
          activeView={activeView}
          onNavClick={handleMobileNavClick}
          navLinks={navLinks}
          user={user}
          serviceType={serviceType}
          onLogout={onLogout}
          onResetAndLogout={() => {}}
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
              <span>{t("dashboard.sync.syncing")}</span>
            </div>
          </div>
        )}

        {/* Top Bar - Mobile */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-notion-border lg:hidden bg-white">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-notion-text hover:text-notion-text/70"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <h2 className="text-sm font-semibold text-notion-text truncate">
            {repo.name}
          </h2>
          <div className="flex items-center flex-shrink-0 ml-2">
            <SyncStatusBadge isSynced={isSynced} />
          </div>
        </div>

        <main className="flex-1 overflow-y-auto bg-white">
          <div className="w-full mx-auto py-8 px-4 sm:px-6 lg:px-6">
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
          onSelect={(path) => {
            handleSettingsChange(
              isPickerOpen === "posts" ? "postsPath" : "imagesPath",
              path,
            );
            setIsPickerOpen(null);
          }}
          onClose={() => setIsPickerOpen(null)}
          title={
            isPickerOpen === "posts"
              ? t("dashboard.settings.postsPath.pickerTitle")
              : t("dashboard.settings.imagesPath.pickerTitle")
          }
        />
      )}

      {collectionPathPicker && (
        <DirectoryPicker
          gitService={gitService}
          onSelect={(path) => {
            collectionPathPicker.callback(path);
            setCollectionPathPicker(null);
          }}
          onClose={() => setCollectionPathPicker(null)}
          title={
            collectionPathPicker.type === "posts"
              ? t("dashboard.settings.postsPath.pickerTitle")
              : t("dashboard.settings.imagesPath.pickerTitle")
          }
        />
      )}

      {successMessage && (
        <div className="fixed bottom-20 right-6 z-50 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-md shadow-lg animate-fade-in flex items-center text-sm">
          <span>{successMessage}</span>
        </div>
      )}

      <NewCollectionModal
        isOpen={isNewCollectionModalOpen}
        onClose={() => setIsNewCollectionModalOpen(false)}
        onSave={handleCollectionCreated}
        gitService={gitService}
        onSelectPath={(type, callback) => setCollectionPathPicker({ type, callback })}
      />

      {collectionToEdit && (
        <EditCollectionModal
          isOpen={isEditCollectionModalOpen}
          onClose={() => {
            setIsEditCollectionModalOpen(false);
            setCollectionToEdit(null);
          }}
          onSave={handleCollectionUpdated}
          collection={collectionToEdit}
          gitService={gitService}
          onSelectPath={(type, callback) => setCollectionPathPicker({ type, callback })}
        />
      )}
    </div>
  );
};

export default Dashboard;
