
import React, { useState, useEffect, useCallback } from 'react';
import { GithubRepo, GithubContent, IGitService } from '../types';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { FolderIcon } from './icons/FolderIcon';
import { FileIcon } from './icons/FileIcon';
import { ArrowUpIcon } from './icons/ArrowUpIcon';
import { useI18n } from '../i18n/I18nContext';
import { CloseIcon } from './icons/CloseIcon';

interface DirectoryPickerProps {
  gitService: IGitService;
  repo: GithubRepo;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath: string;
}

const DirectoryPicker: React.FC<DirectoryPickerProps> = ({ gitService, repo, onClose, onSelect, initialPath }) => {
  const [currentPath, setCurrentPath] = useState(initialPath || '');
  const [contents, setContents] = useState<GithubContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  const fetchContents = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await gitService.getRepoContents(path);
      const sortedItems = items.sort((a, b) => {
        if (a.type === 'dir' && b.type !== 'dir') return -1;
        if (a.type !== 'dir' && b.type === 'dir') return 1;
        return a.name.localeCompare(b.name);
      });
      setContents(sortedItems);
    } catch (err) {
      setError(t('directoryPicker.error'));
    } finally {
      setIsLoading(false);
    }
  }, [gitService, t]);

  useEffect(() => {
    fetchContents(currentPath);
  }, [currentPath, fetchContents]);

  const handleItemClick = (item: GithubContent) => {
    if (item.type === 'dir') {
      setCurrentPath(item.path);
    }
  };

  const goUp = () => {
    if (currentPath === '') return;
    const parts = currentPath.split('/').filter(p => p);
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col border border-notion-border overflow-hidden">
        <header className="px-4 py-3 border-b border-notion-border flex items-center justify-between bg-white">
          <div>
             <h3 className="text-sm font-semibold text-notion-text">{t('directoryPicker.title')}</h3>
             <div className="flex items-center text-xs text-notion-muted mt-0.5">
                <span className="bg-notion-sidebar px-1 rounded-sm border border-notion-border mr-1">/</span>
                <span className="truncate max-w-[250px]">{currentPath}</span>
             </div>
          </div>
          <button onClick={onClose} className="text-notion-muted hover:text-notion-text p-1 hover:bg-notion-hover rounded-sm transition-colors">
             <CloseIcon className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-grow overflow-y-auto p-2 bg-white">
          {currentPath !== '' && (
             <button
                onClick={goUp}
                disabled={isLoading}
                className="w-full flex items-center px-2 py-1.5 mb-1 rounded-sm text-sm text-notion-text hover:bg-notion-hover transition-colors text-left"
              >
                <div className="w-5 h-5 flex items-center justify-center mr-2">
                    <ArrowUpIcon className="w-4 h-4 text-notion-muted" />
                </div>
                <span className="text-notion-muted font-medium">..</span>
              </button>
          )}

          {isLoading ? (
             <div className="flex justify-center items-center py-10">
                <SpinnerIcon className="animate-spin h-5 w-5 text-notion-muted" />
            </div>
          ) : error ? (
            <div className="text-center text-red-500 p-4 text-sm">{error}</div>
          ) : (
            <ul className="space-y-0.5">
              {contents.map(item => (
                <li
                  key={item.sha}
                  onClick={() => handleItemClick(item)}
                  className={`flex items-center px-2 py-1.5 rounded-sm transition-colors text-sm ${
                    item.type === 'dir'
                      ? 'cursor-pointer hover:bg-notion-hover text-notion-text'
                      : 'cursor-not-allowed text-notion-muted opacity-60'
                  }`}
                >
                  <div className="w-5 h-5 flex items-center justify-center mr-2">
                      {item.type === 'dir' ? (
                        <FolderIcon className="w-4 h-4 text-notion-muted" />
                      ) : (
                        <FileIcon className="w-4 h-4 text-notion-muted" />
                      )}
                  </div>
                  <span className="truncate">{item.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="px-4 py-3 border-t border-notion-border flex justify-end items-center bg-gray-50 gap-2">
            <button
                onClick={onClose}
                className="px-3 py-1.5 bg-white border border-notion-border rounded-sm text-notion-text font-medium hover:bg-notion-hover transition-colors text-sm shadow-sm"
            >
                {t('directoryPicker.cancel')}
            </button>
            <button
                onClick={() => onSelect(currentPath)}
                disabled={isLoading || !!error}
                className="px-4 py-1.5 bg-notion-blue text-white font-medium rounded-sm hover:bg-blue-600 transition-all text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {t('directoryPicker.select')}
            </button>
        </footer>
      </div>
    </div>
  );
};

export default DirectoryPicker;
