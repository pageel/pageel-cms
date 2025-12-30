
import React, { useState } from 'react';
import { KeyIcon } from './icons/KeyIcon';
import { GithubIcon } from './icons/GithubIcon';
import { LinkIcon } from './icons/LinkIcon';
import { InfoIcon } from './icons/InfoIcon';
import { useI18n } from '../i18n/I18nContext';
import { ServiceType } from '../types';

interface GitServiceConnectProps {
    onSubmit: (token: string, repoUrl: string, serviceType: ServiceType, instanceUrl?: string) => void;
    error: string | null;
}

const GitServiceConnect: React.FC<GitServiceConnectProps> = ({ onSubmit, error }) => {
    const [token, setToken] = useState('');
    const [repoUrl, setRepoUrl] = useState('');
    const [serviceType, setServiceType] = useState<ServiceType>('github');
    const [instanceUrl, setInstanceUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showTokenHelp, setShowTokenHelp] = useState(false);
    const { t } = useI18n();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const isSelfHosted = serviceType === 'gitea' || serviceType === 'gogs';
        if (token && repoUrl && (!isSelfHosted || (isSelfHosted && instanceUrl))) {
            setIsLoading(true);
            await onSubmit(token, repoUrl, serviceType, instanceUrl);
            setIsLoading(false);
        }
    };

    const ServiceButton: React.FC<{ type: ServiceType, label: string }> = ({ type, label }) => {
        const activeClasses = 'bg-white text-notion-text shadow-sm ring-1 ring-notion-border font-semibold z-10';
        const inactiveClasses = 'text-notion-muted hover:text-notion-text hover:bg-black/5';

        return (
            <button
                type="button"
                onClick={() => setServiceType(type)}
                className={`flex-1 py-1.5 text-xs rounded-sm transition-all duration-200 ${serviceType === type ? activeClasses : inactiveClasses}`}
            >
                {label}
            </button>
        );
    }

    const isSelfHosted = serviceType === 'gitea' || serviceType === 'gogs';

    const renderTokenHelp = () => {
        switch (serviceType) {
            case 'gitea':
                return (
                    <p>
                        {t('githubConnect.tokenHelpGitea.p1')} <b className="text-notion-text font-medium">{t('githubConnect.tokenHelpGitea.b')}</b>
                    </p>
                );
            case 'gogs':
                return (
                    <p>
                        {t('githubConnect.tokenHelpGogs.p1')} <b className="text-notion-text font-medium">{t('githubConnect.tokenHelpGogs.b')}</b>
                    </p>
                );
            case 'github':
            default:
                return (
                    <p>
                        {t('githubConnect.tokenHelpGithub.p1')}
                        <a href="https://github.com/settings/tokens/new?type=beta" target="_blank" rel="noopener noreferrer" className="text-notion-blue hover:underline font-medium">
                            {t('githubConnect.tokenHelpGithub.link')}
                        </a>
                        {t('githubConnect.tokenHelpGithub.p2')} <b className="text-notion-text font-medium">{t('githubConnect.tokenHelpGithub.b')}</b>
                        {t('githubConnect.tokenHelpGithub.p3')}
                    </p>
                );
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-2xl border border-notion-border w-full max-w-sm mx-4 overflow-hidden flex flex-col transition-all duration-300">
            {/* Header - Row Layout */}
            <div className="px-6 py-5 border-b border-notion-border bg-white flex flex-row items-center justify-center gap-4">
                <a href="https://pageel.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group no-underline">
                    <div className="w-10 h-10 bg-white border border-gray-200 shadow-sm rounded-lg flex items-center justify-center group-hover:bg-gray-50 transition-colors">
                        {/* Icon Color: #FF5D01 */}
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-[#FF5D01]">
                            <path fillRule="evenodd" d="M9.315 7.584C12.195 3.883 16.695 1.5 21.75 1.5a.75.75 0 01.75.75c0 5.056-2.383 9.555-6.084 12.436h.001c-1.228 1.65-2.82 3.043-4.66 4.102l-1.554.894a.75.75 0 01-1.077-.925l1.625-3.525-3.525 1.625a.75.75 0 01-.925-1.077l.894-1.554c1.059-1.84 2.453-3.432 4.102-4.66zm-5.12 11.232a.75.75 0 00-.75.75v3a.75.75 0 00.75.75h3a.75.75 0 00.75-.75v-3a.75.75 0 00-.75-.75h-3z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <span className="font-bold text-xl text-[#050505]">Pageel CMS</span>
                </a>
            </div>

            <div className="p-5 bg-white flex-grow">
                <form onSubmit={handleSubmit} className="space-y-3">
                    {/* Service Switcher - Tab Style */}
                    <div className="bg-notion-sidebar p-1 rounded-md border border-notion-border flex">
                        <ServiceButton type="github" label="GitHub" />
                        {/* 
                <ServiceButton type="gitea" label="Gitea" />
                <ServiceButton type="gogs" label="Gogs" /> 
                */}
                    </div>

                    {isSelfHosted && (
                        <div>
                            <label htmlFor="instanceUrl" className="block text-[10px] font-bold text-notion-muted uppercase tracking-wider mb-1">{t('githubConnect.instanceUrlLabel')}</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                    <LinkIcon className="h-3.5 w-3.5 text-notion-muted" />
                                </div>
                                <input
                                    id="instanceUrl"
                                    type="url"
                                    value={instanceUrl}
                                    onChange={(e) => setInstanceUrl(e.target.value)}
                                    placeholder="https://git.example.com"
                                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-notion-border rounded-sm text-sm text-notion-text placeholder-notion-muted/50 focus:outline-none focus:ring-1 focus:ring-notion-blue focus:border-notion-blue transition-all shadow-sm"
                                    required
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label htmlFor="repoUrl" className="block text-[10px] font-bold text-notion-muted uppercase tracking-wider mb-1">{t('githubConnect.repoUrlLabel')}</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                <LinkIcon className="h-3.5 w-3.5 text-notion-muted" />
                            </div>
                            <input
                                id="repoUrl"
                                type="url"
                                value={repoUrl}
                                onChange={(e) => setRepoUrl(e.target.value)}
                                placeholder="owner/repo-name"
                                className="w-full pl-8 pr-3 py-1.5 bg-white border border-notion-border rounded-sm text-sm text-notion-text placeholder-notion-muted/50 focus:outline-none focus:ring-1 focus:ring-notion-blue focus:border-notion-blue transition-all shadow-sm"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor="token" className="block text-[10px] font-bold text-notion-muted uppercase tracking-wider">{t('githubConnect.tokenLabel')}</label>
                            <button
                                type="button"
                                onClick={() => setShowTokenHelp(!showTokenHelp)}
                                className="text-[10px] text-notion-blue hover:underline flex items-center transition-colors hover:text-blue-700"
                            >
                                <InfoIcon className="w-3 h-3 mr-1" />
                                Help
                            </button>
                        </div>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                <KeyIcon className="h-3.5 w-3.5 text-notion-muted" />
                            </div>
                            <input
                                id="token"
                                type="password"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                placeholder="ghp_..."
                                className="w-full pl-8 pr-3 py-1.5 bg-white border border-notion-border rounded-sm text-sm text-notion-text placeholder-notion-muted/50 focus:outline-none focus:ring-1 focus:ring-notion-blue focus:border-notion-blue transition-all shadow-sm"
                                required
                            />
                        </div>
                        {/* Collapsible Help Text */}
                        {showTokenHelp && (
                            <div className="mt-2 p-2 bg-notion-sidebar border border-notion-border rounded-sm text-[10px] text-notion-muted leading-relaxed animate-fade-in">
                                {renderTokenHelp()}
                            </div>
                        )}
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={!token || !repoUrl || (isSelfHosted && !instanceUrl) || isLoading}
                            className="w-full inline-flex items-center justify-center bg-notion-text hover:bg-black text-white font-medium py-1.5 px-4 rounded-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm h-8"
                        >
                            {isLoading ? t('githubConnect.connecting') : (
                                <>
                                    <GithubIcon className="w-3.5 h-3.5 mr-2" />
                                    Connect
                                </>
                            )}
                        </button>
                    </div>
                </form>

                {error && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-100 rounded-sm">
                        <p className="text-red-600 text-[10px] text-center font-medium leading-tight">{error}</p>
                    </div>
                )}

                <div className="mt-4 pt-3 border-t border-notion-border text-center">
                    <p className="text-[9px] text-notion-muted">Local Encryption • No Server Tracking</p>
                </div>
            </div>
        </div>
    );
};

export default GitServiceConnect;
