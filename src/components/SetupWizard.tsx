import React from 'react';
import { IGitService, AppSettings } from '../types';
import { useI18n } from '../i18n/I18nContext';
import { RepoFileTree } from './RepoFileTree';
import { AstroIcon } from './icons/AstroIcon';
import { GithubIcon } from './icons/GithubIcon';
import { FolderIcon } from './icons/FolderIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { ImageIcon } from './icons/ImageIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { useAppStore } from '../features';

interface SetupWizardProps {
    gitService: IGitService;
    settings: AppSettings;
    onSettingsChange: (field: keyof AppSettings, value: any) => void;
    suggestedPostPaths: string[];
    suggestedImagePaths: string[];
    onFinish: (collectionName: string) => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ 
    gitService, 
    settings, 
    onSettingsChange, 
    suggestedPostPaths, 
    suggestedImagePaths, 
    onFinish 
}) => {
    const { t } = useI18n();
    const { isScanning, scanPhase, scanProgress } = useAppStore();
    const [collectionName, setCollectionName] = React.useState('Main Collection');

    const isReady = settings.projectType === 'github'
      ? !!settings.postsPath && !!settings.imagesPath && !!collectionName.trim()
      : !!settings.postsPath && !!settings.imagesPath && !!settings.domainUrl && !!collectionName.trim();

    return (
        <div className="min-h-screen flex items-center justify-center bg-white p-4">
            <div className="w-full max-w-5xl h-[80vh] bg-white rounded-xl shadow-2xl border border-notion-border flex overflow-hidden">
                
                {/* Left Sidebar - File Explorer */}
                <div className="w-1/3 min-w-[280px] bg-notion-sidebar border-r border-notion-border flex flex-col">
                    <div className="p-4 border-b border-notion-border bg-notion-sidebar">
                        <h3 className="text-xs font-semibold text-notion-muted uppercase tracking-wider mb-1">{t('dashboard.setup.explorerTitle')}</h3>
                        <p className="text-[10px] text-notion-muted">{t('dashboard.setup.explorerHint')}</p>
                    </div>
                    <div className="flex-grow overflow-y-auto p-2 custom-scrollbar">
                        <RepoFileTree 
                            gitService={gitService} 
                            onSelectPath={(path) => onSettingsChange('postsPath', path)} 
                            selectedPath={settings.postsPath} 
                            suggestedPaths={suggestedPostPaths} 
                        />
                    </div>
                </div>

                {/* Right Content - Configuration */}
                <div className="flex-grow flex flex-col bg-white w-2/3">
                    <div className="p-8 overflow-y-auto flex-grow custom-scrollbar">
                        <div className="max-w-2xl mx-auto">
                            <h2 className="text-2xl font-bold text-notion-text mb-2">{t('dashboard.setup.wizardTitle')}</h2>
                            <p className="text-notion-muted text-sm mb-8">{t('dashboard.setup.wizardDesc')}</p>

                            {/* MA-08: Scan Progress Bar */}
                            {isScanning && scanPhase && (
                                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center">
                                            <SpinnerIcon className="w-4 h-4 mr-2 animate-spin text-blue-600" />
                                            <span className="text-sm font-medium text-blue-900">{scanPhase}</span>
                                        </div>
                                        <span className="text-sm text-blue-700 font-semibold">{scanProgress}%</span>
                                    </div>
                                    <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                                        <div 
                                            className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                                            style={{ width: `${scanProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-8">
                                {/* Project Type */}
                                <section>
                                    <h3 className="text-sm font-semibold text-notion-text mb-3">{t('dashboard.setup.configTitle')}</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <button 
                                            onClick={() => onSettingsChange('projectType', 'astro')} 
                                            className={`text-left p-4 border rounded-md transition-all duration-200 group relative ${
                                                settings.projectType === 'astro' 
                                                ? 'bg-white border-notion-blue ring-1 ring-notion-blue shadow-sm' 
                                                : 'bg-white border-notion-border hover:bg-notion-hover hover:border-gray-300'
                                            }`}
                                        >
                                            {settings.projectType === 'astro' && (
                                                <div className="absolute top-2 right-2 text-notion-blue"><CheckCircleIcon className="w-4 h-4"/></div>
                                            )}
                                            <AstroIcon className={`w-6 h-6 mb-3 ${settings.projectType === 'astro' ? 'text-notion-blue' : 'text-notion-muted'}`}/>
                                            <p className="font-semibold text-sm text-notion-text mb-1">{t('dashboard.setup.projectTypeAstroName')}</p>
                                            <p className="text-xs text-notion-muted leading-relaxed">{t('dashboard.setup.projectTypeAstroDesc')}</p>
                                        </button>
                                        
                                        <button 
                                            onClick={() => onSettingsChange('projectType', 'github')} 
                                            className={`text-left p-4 border rounded-md transition-all duration-200 group relative ${
                                                settings.projectType === 'github' 
                                                ? 'bg-white border-notion-blue ring-1 ring-notion-blue shadow-sm' 
                                                : 'bg-white border-notion-border hover:bg-notion-hover hover:border-gray-300'
                                            }`}
                                        >
                                            {settings.projectType === 'github' && (
                                                <div className="absolute top-2 right-2 text-notion-blue"><CheckCircleIcon className="w-4 h-4"/></div>
                                            )}
                                            <GithubIcon className={`w-6 h-6 mb-3 ${settings.projectType === 'github' ? 'text-notion-blue' : 'text-notion-muted'}`}/>
                                            <p className="font-semibold text-sm text-notion-text mb-1">{t('dashboard.setup.projectTypeGithubName')}</p>
                                            <p className="text-xs text-notion-muted leading-relaxed">{t('dashboard.setup.projectTypeGithubDesc')}</p>
                                        </button>
                                    </div>
                                </section>

                                {/* Content Path */}
                                <section>
                                    <label className="block text-xs font-semibold text-notion-muted uppercase tracking-wider mb-2">{t('dashboard.settings.directories.postsLabel')}</label>
                                    <div className="bg-notion-sidebar p-1 rounded-md border border-notion-border">
                                        <div className="flex items-center px-3 py-2 bg-white rounded-sm border border-notion-border shadow-sm">
                                            <FolderIcon className="w-4 h-4 mr-2 text-notion-muted" />
                                            <span className="text-sm font-mono text-notion-text flex-grow truncate">{settings.postsPath || 'Not selected'}</span>
                                        </div>
                                    </div>
                                    
                                    {suggestedPostPaths.length > 0 ? ( 
                                        <div className="mt-3 space-y-1"> 
                                            <p className="text-xs text-notion-muted mb-2">{t('dashboard.setup.suggestionsDesc')}</p> 
                                            {suggestedPostPaths.map(path => ( 
                                                <button 
                                                    key={path} 
                                                    onClick={() => onSettingsChange('postsPath', path)} 
                                                    className={`w-full text-left px-3 py-1.5 rounded-sm flex items-center justify-between text-xs transition-colors ${
                                                        settings.postsPath === path 
                                                        ? 'bg-blue-50 text-notion-blue font-medium' 
                                                        : 'text-notion-text hover:bg-notion-hover'
                                                    }`}
                                                >
                                                    <span className="truncate">{path}</span>
                                                    {settings.postsPath === path && <CheckCircleIcon className="w-3.5 h-3.5" />}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-red-500 mt-2">{t('dashboard.setup.selectFromTree')}</p>
                                    )}
                                </section>

                                {/* Images Path */}
                                <section>
                                    <label className="block text-xs font-semibold text-notion-muted uppercase tracking-wider mb-2">{t('dashboard.settings.directories.imagesLabel')}</label>
                                    <div className="bg-notion-sidebar p-1 rounded-md border border-notion-border">
                                        <div className="flex items-center px-3 py-2 bg-white rounded-sm border border-notion-border shadow-sm">
                                            <ImageIcon className="w-4 h-4 mr-2 text-notion-muted" />
                                            <span className="text-sm font-mono text-notion-text flex-grow truncate">{settings.imagesPath || 'Not selected'}</span>
                                        </div>
                                    </div>
                                    {suggestedImagePaths.length > 0 && (
                                        <div className="mt-3 space-y-1">
                                            <p className="text-xs text-notion-muted mb-2">{t('dashboard.setup.imagesSuggestionsDesc')}</p>
                                            {suggestedImagePaths.map(path => (
                                                <button 
                                                    key={path} 
                                                    onClick={() => onSettingsChange('imagesPath', path)} 
                                                    className={`w-full text-left px-3 py-1.5 rounded-sm flex items-center justify-between text-xs transition-colors ${
                                                        settings.imagesPath === path 
                                                        ? 'bg-purple-50 text-purple-600 font-medium' 
                                                        : 'text-notion-text hover:bg-notion-hover'
                                                    }`}
                                                >
                                                    <span className="truncate">{path}</span>
                                                    {settings.imagesPath === path && <CheckCircleIcon className="w-3.5 h-3.5" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                {/* Collection Name */}
                                <section>
                                    <label htmlFor="setup-collection-name" className="block text-xs font-semibold text-notion-muted uppercase tracking-wider mb-2">Collection Name</label>
                                    <input 
                                        type="text" 
                                        id="setup-collection-name" 
                                        value={collectionName} 
                                        onChange={(e) => setCollectionName(e.target.value)} 
                                        className="w-full px-3 py-2 bg-white border border-notion-border rounded-sm text-sm text-notion-text focus:outline-none focus:ring-1 focus:ring-notion-blue focus:border-notion-blue shadow-sm" 
                                        placeholder="Main Collection" 
                                    />
                                    <p className="text-xs text-notion-muted mt-1.5">Name for your first content collection</p>
                                </section>

                                {/* Domain (Astro Only) */}
                                {settings.projectType === 'astro' && (
                                    <section>
                                        <label htmlFor="setup-domain-url" className="block text-xs font-semibold text-notion-muted uppercase tracking-wider mb-2">{t('dashboard.settings.domain.label')}</label>
                                        <input 
                                            type="url" 
                                            id="setup-domain-url" 
                                            value={settings.domainUrl} 
                                            onChange={(e) => onSettingsChange('domainUrl', e.target.value)} 
                                            className="w-full px-3 py-2 bg-white border border-notion-border rounded-sm text-sm text-notion-text focus:outline-none focus:ring-1 focus:ring-notion-blue focus:border-notion-blue shadow-sm" 
                                            placeholder="https://my-site.com" 
                                        />
                                        <p className="text-xs text-notion-muted mt-1.5">{t('dashboard.setup.domainHelp')}</p>
                                    </section>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-notion-border bg-white flex justify-between items-center flex-shrink-0">
                        <span className="text-xs text-notion-muted flex items-center">
                            <span className="inline-block w-2 h-2 rounded-full bg-notion-blue mr-2"></span>
                            {t('dashboard.setup.createConfigHelp')}
                        </span>
                        <button 
                            onClick={() => onFinish(collectionName)} 
                            disabled={!isReady} 
                            className="inline-flex items-center justify-center bg-notion-blue hover:bg-blue-600 text-white font-medium py-1.5 px-4 rounded-sm transition-colors text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {t('dashboard.setup.finishButton')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
