
import React, { createContext, useState, useContext, useCallback } from 'react';
import { translations } from './translations';

type Language = 'en' | 'vi';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, options?: { [key: string]: string | number }) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Helper function to get nested values from an object using a dot-notation string
const getNestedTranslation = (obj: any, key: string): string | undefined => {
  return key.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
};

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('pageel-cms-lang') as Language) || 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('pageel-cms-lang', lang);
  };

  const t = useCallback((key: string, options?: { [key: string]: string | number }): string => {
    const translationSet = translations[language] || translations['en'];
    let text = getNestedTranslation(translationSet, key);

    if (text === undefined) {
      console.warn(`Translation key "${key}" not found for language "${language}"`);
      // Fallback to English
      text = getNestedTranslation(translations['en'], key) || key;
    }

    if (options) {
      Object.keys(options).forEach(optKey => {
        const regex = new RegExp(`{{${optKey}}}`, 'g');
        text = text.replace(regex, String(options[optKey]));
      });
    }

    return text;
  }, [language]);


  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
