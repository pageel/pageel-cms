/**
 * EditCollectionModal Component
 * 
 * Modal for editing an existing collection.
 */

import React, { useState, useEffect } from 'react';
import { useCollectionStore, Collection } from '../features/collections';
import { CloseIcon } from './icons/CloseIcon';
import { FolderIcon } from './icons/FolderIcon';
import { useI18n } from '../i18n/I18nContext';

interface EditCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: Collection | null;
  onSelectPath: (type: 'posts' | 'images', callback: (path: string) => void) => void;
  onUpdated?: (collection: Collection) => void;
}

export const EditCollectionModal: React.FC<EditCollectionModalProps> = ({
  isOpen,
  onClose,
  collection,
  onSelectPath,
  onUpdated,
}) => {
  const [name, setName] = useState('');
  const [postsPath, setPostsPath] = useState('');
  const [imagesPath, setImagesPath] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { updateCollection, workspace } = useCollectionStore();

  const { t } = useI18n();

  useEffect(() => {
    if (collection) {
      setName(collection.name);
      setPostsPath(collection.postsPath);
      setImagesPath(collection.imagesPath);
      setError(null);
    }
  }, [collection]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collection) return;
    setError(null);

    // Validate
    if (!name.trim()) {
      setError(t('collectionModal.error.nameRequired'));
      return;
    }
    if (!postsPath.trim()) {
      setError(t('collectionModal.error.postsPathRequired'));
      return;
    }
    if (!imagesPath.trim()) {
      setError(t('collectionModal.error.imagesPathRequired'));
      return;
    }

    // Check for duplicate name (excluding self)
    const newId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (newId !== collection.id && workspace?.collections.some(c => c.id === newId)) {
      setError(t('collectionModal.error.duplicateName'));
      return;
    }

    // Update collection
    const updates: Partial<Collection> = {
      name: name.trim(),
      postsPath: postsPath.trim(),
      imagesPath: imagesPath.trim(),
    };
    
    updateCollection(collection.id, updates);

    // Notify parent to sync
    onUpdated?.({ ...collection, ...updates });

    onClose();
  };

  if (!isOpen || !collection) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-notion-border">
          <h2 className="text-lg font-semibold text-notion-text">{t('collectionModal.editTitle')}</h2>
          <button
            onClick={onClose}
            className="p-1 text-notion-muted hover:text-notion-text hover:bg-notion-hover rounded-sm transition-colors"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-sm text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-notion-text mb-1">
              {t('collectionModal.nameLabel')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('collectionModal.namePlaceholder')}
              className="w-full px-3 py-2 border border-notion-border rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Posts Path */}
          <div>
            <label className="block text-sm font-medium text-notion-text mb-1">
              {t('collectionModal.postsPathLabel')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={postsPath}
                onChange={(e) => setPostsPath(e.target.value)}
                placeholder={t('collectionModal.postsPathPlaceholder')}
                className="flex-grow px-3 py-2 border border-notion-border rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => onSelectPath('posts', setPostsPath)}
                className="px-3 py-2 border border-notion-border rounded-sm text-sm text-notion-muted hover:bg-notion-hover transition-colors"
              >
                <FolderIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Images Path */}
          <div>
            <label className="block text-sm font-medium text-notion-text mb-1">
              {t('collectionModal.imagesPathLabel')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={imagesPath}
                onChange={(e) => setImagesPath(e.target.value)}
                placeholder={t('collectionModal.imagesPathPlaceholder')}
                className="flex-grow px-3 py-2 border border-notion-border rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => onSelectPath('images', setImagesPath)}
                className="px-3 py-2 border border-notion-border rounded-sm text-sm text-notion-muted hover:bg-notion-hover transition-colors"
              >
                <FolderIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-notion-border rounded-sm text-sm text-notion-text hover:bg-notion-hover transition-colors"
            >
              {t('collectionModal.cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-sm text-sm hover:bg-blue-600 transition-colors"
            >
              {t('collectionModal.saveButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
