
import React, { useState, useEffect, useRef } from 'react';
import { GithubUser, ServiceType } from '../types';
import { useI18n } from '../i18n/I18nContext';
import { AstroIcon } from './icons/AstroIcon';
import { GithubIcon } from './icons/GithubIcon';
import { GiteaIcon } from './icons/GiteaIcon';
import { GogsIcon } from './icons/GogsIcon';
import { EllipsisVerticalIcon } from './icons/EllipsisVerticalIcon';
import { LogoutIcon } from './icons/LogoutIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { SyncStatusBadge } from './SyncStatusBadge';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { CollectionPicker } from './CollectionPicker';
import { Collection } from '../features/collections';

interface SidebarProps {
    activeView: string;
    onNavClick: (view: string) => void;
    navLinks: { id: string; label: string; icon: React.FC<any>; }[];
    user: GithubUser;
    serviceType: ServiceType;
    onLogout: () => void;
    onResetAndLogout: () => void;
    isSynced: boolean;
    repoStats: { postCount: number | null, imageCount: number | null };
    lastUpdated: string;
    onNewCollection?: () => void;
    onEditCollection?: (collection: Collection) => void;
    onDeleteCollection?: (collection: Collection) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
    activeView, 
    onNavClick, 
    navLinks, 
    user, 
    serviceType, 
    onLogout, 
    isSynced, 
    repoStats, 
    lastUpdated, 
    onNewCollection,
    onEditCollection,
    onDeleteCollection
}) => {
    const { t } = useI18n();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [menuRef]);

    const getServiceIcon = () => {
        const serviceName = serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
        const tooltip = t('dashboard.userMenu.serviceTooltip', { service: serviceName });

        switch (serviceType) {
            case 'github': return <GithubIcon className="w-3.5 h-3.5 text-notion-muted" title={tooltip} />;
            case 'gitea': return <GiteaIcon className="w-3.5 h-3.5" title={tooltip} />;
            case 'gogs': return <GogsIcon className="w-3.5 h-3.5" title={tooltip} />;
            default: return null;
        }
    }

    return (
        <aside className="w-60 bg-notion-sidebar flex-shrink-0 border-r border-notion-border flex flex-col h-full text-notion-text transition-all duration-300 font-sans">
            {/* Notion Style Workspace Switcher */}
            <div className="relative px-3 py-2 hover:bg-notion-hover cursor-pointer transition-colors m-2 rounded-sm group" ref={menuRef} onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-sm overflow-hidden flex-shrink-0 bg-white border border-notion-border flex items-center justify-center">
                        <img src={user.avatar_url} alt={user.login} className="w-full h-full" />
                    </div>
                    <div className="flex-grow min-w-0">
                        <p className="text-sm font-medium truncate leading-none text-notion-text">{user.login}'s Repo</p>
                    </div>
                    <div className="text-notion-muted opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronDownIcon className="w-3 h-3" />
                    </div>
                </div>

                {isUserMenuOpen && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-md shadow-lg border border-notion-border py-1 z-50 animate-fade-in">
                        <div className="px-3 py-2 border-b border-notion-border mb-1">
                            <p className="text-xs text-notion-muted truncate">{user.name || user.login} ({serviceType})</p>
                        </div>
                        <a href={user.html_url} target="_blank" rel="noopener noreferrer" className="flex items-center px-3 py-1.5 text-sm text-notion-text hover:bg-notion-hover mx-1 rounded-sm">
                            <span className="flex-grow">{t('dashboard.userMenu.viewProfile')}</span>
                        </a>
                        <div className="border-t border-notion-border my-1"></div>
                        <button onClick={onLogout} className="w-full text-left flex items-center px-3 py-1.5 text-sm text-notion-text hover:bg-notion-hover mx-1 rounded-sm">
                            <LogoutIcon className="w-4 h-4 mr-2 text-notion-muted" />
                            {t('app.logout')}
                        </button>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-grow px-2 space-y-0.5 overflow-y-auto">
                {/* Collection Picker */}
                <div className="relative">
                    <CollectionPicker 
                        onNewCollection={onNewCollection || (() => {})} 
                        onEditCollection={onEditCollection}
                        onDeleteCollection={onDeleteCollection}
                    />
                </div>
                
                <div className="px-3 pt-3 pb-1">
                    <p className="text-[11px] font-semibold text-notion-muted opacity-60">WORKSPACE</p>
                </div>
                {navLinks.map((link) => {
                    const isActive = activeView === link.id;
                    return (
                        <button
                            key={link.id}
                            onClick={() => onNavClick(link.id)}
                            className={`flex items-center w-full text-left px-3 py-1.5 text-[14px] transition-colors rounded-sm group ${isActive
                                    ? 'bg-notion-hover text-notion-text font-medium'
                                    : 'text-notion-text hover:bg-notion-hover text-opacity-90 hover:text-opacity-100'
                                }`}
                        >
                            <span className={`mr-2.5 flex-shrink-0 ${isActive ? 'text-notion-text' : 'text-notion-muted group-hover:text-notion-text'}`}>
                                <link.icon className="w-[18px] h-[18px]" />
                            </span>
                            {link.label}
                        </button>
                    )
                })}
            </nav>

            {/* Bottom Status Area */}
            <div className="mt-auto border-t border-notion-border bg-notion-sidebar">
                <div className="p-3 space-y-3">
                    {/* Row 1: Sync Status */}
                    <div className="flex items-center justify-between">
                        <SyncStatusBadge isSynced={isSynced} />
                        {/* Last Updated - Small text on right */}
                        <span className="text-[10px] text-notion-muted whitespace-nowrap" title={`Last updated: ${lastUpdated}`}>
                            {lastUpdated}
                        </span>
                    </div>

                    {/* Row 2: Stats Grid */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white border border-notion-border rounded-sm p-1.5 flex flex-col items-center">
                            <span className="text-[10px] text-notion-muted uppercase tracking-wide">Posts</span>
                            <span className="text-sm font-semibold text-notion-text">{repoStats.postCount ?? '-'}</span>
                        </div>
                        <div className="bg-white border border-notion-border rounded-sm p-1.5 flex flex-col items-center">
                            <span className="text-[10px] text-notion-muted uppercase tracking-wide">Images</span>
                            <span className="text-sm font-semibold text-notion-text">{repoStats.imageCount ?? '-'}</span>
                        </div>
                    </div>
                </div>

                {/* Version footer - Changed to Link */}
                <a href="https://github.com/pageel/pageel-cms" target="_blank" rel="noopener noreferrer" className="px-3 py-2 border-t border-notion-border text-xs text-notion-muted flex items-center opacity-60 hover:opacity-100 transition-opacity no-underline hover:bg-notion-hover cursor-pointer">
                    <div className="w-5 h-5 bg-white border border-gray-200 shadow-sm rounded flex items-center justify-center mr-1.5">
                        <GithubIcon className="w-3.5 h-3.5 text-notion-text" />
                    </div>
                    <span>Pageel CMS v1.0.0</span>
                </a>
            </div>
        </aside>
    );
};
