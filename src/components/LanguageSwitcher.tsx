
import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { TranslateIcon } from './icons/TranslateIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';

type LanguageCode = 'en' | 'vi';

const languages: { code: LanguageCode; key: string }[] = [
    { code: 'en', key: 'language.en' },
    { code: 'vi', key: 'language.vi' },
];

interface LanguageSwitcherProps {
    position?: 'up' | 'down';
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ position = 'down' }) => {
    const { language, setLanguage, t } = useI18n();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const selectLanguage = (langCode: LanguageCode) => {
        setLanguage(langCode);
        setIsOpen(false);
    };
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const currentLanguageLabel = t(languages.find(l => l.code === language)?.key || 'language.en');

    // Determine positioning classes based on prop
    const positionClasses = position === 'up' 
        ? 'bottom-full mb-1 origin-bottom-left' 
        : 'top-full mt-1 origin-top-left';

    return (
        <div className="relative inline-block text-left" ref={menuRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center justify-center rounded-sm border border-notion-border shadow-sm px-3 py-1.5 bg-white text-sm font-medium text-notion-text hover:bg-notion-hover transition-colors focus:outline-none"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <TranslateIcon className="w-4 h-4 mr-2 text-notion-muted" />
                {currentLanguageLabel}
            </button>

            {isOpen && (
                <div
                    className={`absolute left-0 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50 border border-notion-border animate-scale-in ${positionClasses}`}
                    role="menu"
                >
                    <div className="py-1" role="none">
                        {languages.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => selectLanguage(lang.code)}
                                className={`group flex items-center justify-between w-full px-4 py-2 text-sm text-left ${
                                    language === lang.code
                                        ? 'bg-notion-select text-notion-text font-medium'
                                        : 'text-notion-text hover:bg-notion-hover'
                                }`}
                                role="menuitem"
                            >
                                <span>{t(lang.key)}</span>
                                {language === lang.code && <CheckCircleIcon className="w-4 h-4 text-notion-blue" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
