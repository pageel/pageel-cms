
import React, { useState } from 'react';
import { GithubUser, GithubRepo, AppSettings } from '../types';
import { useI18n } from '../i18n/I18nContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ToggleSwitch } from './ToggleSwitch';
import { SettingsIcon } from './icons/SettingsIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { PhotoIcon } from './icons/PhotoIcon';
import { FolderIcon } from './icons/FolderIcon';
import { ImageIcon } from './icons/ImageIcon';
import { AstroIcon } from './icons/AstroIcon';
import { ConfirmationModal } from './ConfirmationModal';

interface SettingsViewProps {
    settings: AppSettings;
    onSettingsChange: (field: keyof AppSettings, value: any) => void;
    onSave: () => void;
    isSaving: boolean;
    saveSuccess: boolean;
    user: GithubUser;
    repo: GithubRepo;
    onLogout: () => void;
    onDeleteConfig: () => void;
    onExport: () => void;
    onImportClick: () => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    onFileImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
    importStatus: { type: 'success' | 'error', message: string } | null;
    onOpenPicker: (type: 'posts' | 'images') => void;
}

const SettingRow: React.FC<{ label: string, description?: string, children: React.ReactNode }> = ({ label, description, children }) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 px-6 border-b border-notion-border last:border-b-0 hover:bg-notion-hover/20 transition-colors gap-4">
        <div className="flex-1">
            <label className="text-sm font-medium text-notion-text block">{label}</label>
            {description && <p className="text-xs text-notion-muted mt-0.5">{description}</p>}
        </div>
        <div className="flex-shrink-0 sm:min-w-[200px] flex justify-end">
            {children}
        </div>
    </div>
);

const SectionHeader: React.FC<{ title: string, icon: React.ReactNode }> = ({ title, icon }) => (
    <div className="px-6 py-3 bg-notion-sidebar border-b border-notion-border flex items-center mt-8 first:mt-0 rounded-t-md">
        <span className="text-notion-muted mr-2">{icon}</span>
        <h3 className="text-xs font-bold text-notion-text uppercase tracking-wider">{title}</h3>
    </div>
);

export const SettingsView: React.FC<SettingsViewProps> = ({
    settings,
    onSettingsChange,
    onSave,
    isSaving,
    saveSuccess,
    user,
    repo,
    onDeleteConfig,
    onExport,
    onImportClick,
    fileInputRef,
    onFileImport,
    importStatus,
    onOpenPicker
}) => {
    const { t } = useI18n();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    return (
        <div className="pb-20">
             {/* Header Info */}
            <div className="mb-8 flex items-center p-4 border border-notion-border rounded-md bg-white shadow-sm">
                <img src={user.avatar_url} alt={user.login} className="w-10 h-10 rounded-full mr-4 border border-notion-border" />
                <div>
                    <h2 className="text-lg font-bold text-notion-text">{repo.full_name}</h2>
                    <p className="text-xs text-notion-muted">
                        {repo.private ? t('dashboard.settings.repoInfo.private') : t('dashboard.settings.repoInfo.public')} Repository
                    </p>
                </div>
            </div>

            <ConfirmationModal 
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={onDeleteConfig}
                title={t('dashboard.settings.dangerZone.title')}
                description={t('dashboard.settings.dangerZone.confirmDelete')}
                confirmLabel={t('dashboard.settings.dangerZone.resetButtonLogout')}
                isProcessing={isSaving}
                variant="danger"
            />

            <div className="bg-white border border-notion-border rounded-md shadow-sm overflow-hidden">
                
                {/* --- Project Config --- */}
                <SectionHeader title={t('dashboard.settings.project.title')} icon={<AstroIcon className="w-4 h-4" />} />
                <div className="divide-y divide-notion-border">
                    <SettingRow label={t('dashboard.settings.projectType.label')} description={t('dashboard.settings.projectType.help')}>
                        <div className="flex rounded-sm shadow-sm">
                            <button
                                onClick={() => onSettingsChange('projectType', 'astro')}
                                className={`px-3 py-1 text-xs font-medium border border-notion-border rounded-l-sm transition-colors ${settings.projectType === 'astro' ? 'bg-notion-text text-white' : 'bg-white text-notion-text hover:bg-notion-hover'}`}
                            >
                                Web Project
                            </button>
                            <button
                                onClick={() => onSettingsChange('projectType', 'github')}
                                className={`px-3 py-1 text-xs font-medium border border-notion-border border-l-0 rounded-r-sm transition-colors ${settings.projectType === 'github' ? 'bg-notion-text text-white' : 'bg-white text-notion-text hover:bg-notion-hover'}`}
                            >
                                File Library
                            </button>
                        </div>
                    </SettingRow>

                    {settings.projectType === 'astro' && (
                        <SettingRow 
                            label={t('dashboard.settings.domain.label')} 
                            description="Leave empty to use file library (Raw GitHub URLs). Enter your production URL for deployed sites."
                        >
                             <input 
                                type="url" 
                                value={settings.domainUrl} 
                                onChange={(e) => onSettingsChange('domainUrl', e.target.value)} 
                                className="w-full max-w-xs px-3 py-1.5 text-sm border border-notion-border rounded-sm focus:outline-none focus:ring-1 focus:ring-notion-blue placeholder-notion-muted/50"
                                placeholder="https://example.com (optional)"
                             />
                        </SettingRow>
                    )}
                </div>

                {/* --- Workflow Config --- */}
                <SectionHeader title={t('dashboard.settings.workflow.title')} icon={<CheckCircleIcon className="w-4 h-4" />} />
                <div className="divide-y divide-notion-border border-t border-notion-border">
                    <SettingRow label={t('dashboard.settings.commits.newPostLabel')}>
                        <input type="text" value={settings.newPostCommit} onChange={(e) => onSettingsChange('newPostCommit', e.target.value)} className="w-full max-w-xs px-3 py-1.5 text-sm border border-notion-border rounded-sm focus:outline-none focus:ring-1 focus:ring-notion-blue" />
                    </SettingRow>
                    <SettingRow label={t('dashboard.settings.commits.updatePostLabel')}>
                        <input type="text" value={settings.updatePostCommit} onChange={(e) => onSettingsChange('updatePostCommit', e.target.value)} className="w-full max-w-xs px-3 py-1.5 text-sm border border-notion-border rounded-sm focus:outline-none focus:ring-1 focus:ring-notion-blue" />
                    </SettingRow>
                    
                    <SettingRow label={t('dashboard.settings.creation.title')}>
                         <div className="flex items-center space-x-3 text-sm">
                            <label className="inline-flex items-center cursor-pointer">
                                <input type="radio" className="mr-1.5" name="publishDateSource" value="file" checked={settings.publishDateSource === 'file'} onChange={() => onSettingsChange('publishDateSource', 'file')} />
                                {t('dashboard.settings.creation.dateFromFile')}
                            </label>
                            <label className="inline-flex items-center cursor-pointer">
                                <input type="radio" className="mr-1.5" name="publishDateSource" value="system" checked={settings.publishDateSource === 'system'} onChange={() => onSettingsChange('publishDateSource', 'system')} />
                                {t('dashboard.settings.creation.dateFromSystem')}
                            </label>
                         </div>
                    </SettingRow>
                </div>

                {/* --- Media Config --- */}
                <SectionHeader title={t('dashboard.settings.compression.title')} icon={<PhotoIcon className="w-4 h-4" />} />
                <div className="divide-y divide-notion-border border-t border-notion-border">
                    <SettingRow label={t('dashboard.settings.compression.enableLabel')} description={t('dashboard.settings.compression.enableHelp')}>
                        <ToggleSwitch checked={settings.imageCompressionEnabled} onChange={(val) => onSettingsChange('imageCompressionEnabled', val)} />
                    </SettingRow>

                    {settings.imageCompressionEnabled && (
                        <>
                            <SettingRow label={t('dashboard.settings.compression.maxSizeLabel')}>
                                <div className="flex items-center">
                                    <input 
                                        type="number" 
                                        min="10" 
                                        max="1024"
                                        step="10" 
                                        value={settings.maxImageSize} 
                                        onChange={(e) => onSettingsChange('maxImageSize', parseInt(e.target.value))} 
                                        className="w-24 px-2 py-1 text-sm border border-notion-border rounded-sm focus:outline-none focus:ring-1 focus:ring-notion-blue text-right" 
                                    />
                                    <span className="ml-2 text-xs text-notion-muted">KB</span>
                                </div>
                            </SettingRow>
                            <SettingRow label={t('dashboard.settings.compression.resizeLabel')}>
                                <div className="flex items-center">
                                    <input 
                                        type="number" 
                                        min="0" 
                                        step="100" 
                                        value={settings.imageResizeMaxWidth} 
                                        onChange={(e) => onSettingsChange('imageResizeMaxWidth', parseInt(e.target.value))} 
                                        className="w-24 px-2 py-1 text-sm border border-notion-border rounded-sm focus:outline-none focus:ring-1 focus:ring-notion-blue text-right" 
                                        placeholder="0"
                                    />
                                    <span className="ml-2 text-xs text-notion-muted">px</span>
                                </div>
                            </SettingRow>
                        </>
                    )}
                </div>

                {/* --- System Config --- */}
                <SectionHeader title={t('dashboard.settings.system.title')} icon={<SettingsIcon className="w-4 h-4" />} />
                <div className="divide-y divide-notion-border border-t border-notion-border">
                    <SettingRow label={t('dashboard.settings.system.languageLabel')}>
                        <LanguageSwitcher />
                    </SettingRow>

                    <SettingRow label={t('dashboard.settings.importExport.title')}>
                         <div className="flex gap-2">
                             <button onClick={onExport} className="px-3 py-1.5 bg-white border border-notion-border rounded-sm text-xs font-medium text-notion-text hover:bg-notion-hover shadow-sm">
                                 {t('dashboard.settings.importExport.exportButton')}
                             </button>
                             <button onClick={onImportClick} className="px-3 py-1.5 bg-white border border-notion-border rounded-sm text-xs font-medium text-notion-text hover:bg-notion-hover shadow-sm">
                                 {t('dashboard.settings.importExport.importButton')}
                             </button>
                             <input type="file" ref={fileInputRef} onChange={onFileImport} className="hidden" accept=".json" />
                         </div>
                         {importStatus && (
                            <p className={`mt-1 text-[10px] ${importStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{importStatus.message}</p>
                         )}
                    </SettingRow>

                    <SettingRow label={t('dashboard.settings.dangerZone.title')} description={t('dashboard.settings.dangerZone.descriptionLogout')}>
                         <button onClick={() => setShowDeleteConfirm(true)} className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-sm text-xs font-medium text-red-600 hover:bg-red-100 flex items-center shadow-sm">
                             <ExclamationTriangleIcon className="w-3.5 h-3.5 mr-1.5" />
                             {t('dashboard.settings.dangerZone.resetButtonLogout')}
                         </button>
                    </SettingRow>
                </div>
            </div>

             {/* Sticky Save Bar */}
             <div className="fixed bottom-6 right-6 z-30">
                <button 
                    onClick={onSave} 
                    disabled={isSaving}
                    className="flex items-center justify-center bg-notion-blue hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-full shadow-lg transition-all duration-200 disabled:opacity-50 hover:scale-105"
                >
                    {isSaving && <SpinnerIcon className="w-4 h-4 mr-2 animate-spin" />}
                    {saveSuccess ? (
                        <><CheckCircleIcon className="w-4 h-4 mr-2" /> {t('dashboard.settings.saveSuccess')}</>
                    ) : (
                        t('dashboard.settings.saveButton')
                    )}
                </button>
             </div>
        </div>
    );
};
