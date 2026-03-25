/**
 * CollectionPicker Component
 * 
 * Dropdown for selecting and managing collections within a workspace.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useCollectionStore, Collection } from '../features/collections';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { PlusIcon } from './icons/PlusIcon';
import { FolderIcon } from './icons/FolderIcon';
import { CheckIcon } from './icons/CheckIcon';
import { TrashIcon } from './icons/TrashIcon';
import { EditIcon } from './icons/EditIcon';

interface CollectionPickerProps {
  onNewCollection: () => void;
  onEditCollection?: (collection: Collection) => void;
  onDeleteCollection?: (collection: Collection) => void;
}

export const CollectionPicker: React.FC<CollectionPickerProps> = ({ 
  onNewCollection,
  onEditCollection,
  onDeleteCollection,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const { workspace, getActiveCollection, setActiveCollection, removeCollection } = useCollectionStore();
  const activeCollection = getActiveCollection();
  const collections = workspace?.collections || [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCollectionClick = (collectionId: string) => {
    setActiveCollection(collectionId);
    setIsOpen(false);
  };

  const handleDelete = (e: React.MouseEvent, collection: Collection) => {
    e.stopPropagation();
    if (confirm(`Delete collection "${collection.name}"? This cannot be undone.`)) {
      removeCollection(collection.id);
      onDeleteCollection?.(collection);
    }
  };

  const handleEdit = (e: React.MouseEvent, collection: Collection) => {
    e.stopPropagation();
    setIsOpen(false);
    onEditCollection?.(collection);
  };

  if (collections.length === 0) {
    return (
      <div className="px-3 py-2">
        <button
          onClick={onNewCollection}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-notion-muted hover:bg-notion-hover rounded-sm transition-colors border border-dashed border-notion-border"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Create Collection</span>
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 py-2" ref={menuRef}>
      {/* Active Collection Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-notion-text hover:bg-notion-hover rounded-sm transition-colors group"
      >
        <FolderIcon className="w-4 h-4 text-notion-muted" />
        <span className="flex-grow text-left truncate font-medium">
          {activeCollection?.name || 'Select Collection'}
        </span>
        <ChevronDownIcon className={`w-3 h-3 text-notion-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-2 right-2 mt-1 bg-white rounded-md shadow-lg border border-notion-border py-1 z-50 animate-fade-in">
          {/* Collection List */}
          <div className="max-h-48 overflow-y-auto">
            {collections.map((collection) => (
              <div
                key={collection.id}
                className="relative flex items-center hover:bg-notion-hover transition-colors group"
              >
                <button
                  onClick={() => handleCollectionClick(collection.id)}
                  className="flex-grow flex items-center gap-2 px-3 py-2 text-sm text-notion-text"
                >
                  <FolderIcon className="w-4 h-4 text-notion-muted" />
                  <span className="flex-grow text-left truncate">{collection.name}</span>
                  {activeCollection?.id === collection.id && (
                    <CheckIcon className="w-4 h-4 text-blue-500" />
                  )}
                </button>
                
                {/* Action buttons on hover */}
                <div className="absolute right-2 flex opacity-0 group-hover:opacity-100 gap-1 bg-inherit transition-opacity">
                  {onEditCollection && (
                    <button
                      onClick={(e) => handleEdit(e, collection)}
                      className="p-1 text-notion-muted hover:text-notion-text hover:bg-notion-sidebar rounded-sm"
                      title="Edit"
                    >
                      <EditIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(e, collection)}
                    className="p-1 text-notion-muted hover:text-red-500 hover:bg-red-50 rounded-sm"
                    title="Delete"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {/* Divider */}
          <div className="border-t border-notion-border my-1" />
          
          {/* New Collection Button */}
          <button
            onClick={() => {
              setIsOpen(false);
              onNewCollection();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-notion-muted hover:bg-notion-hover transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span>New Collection</span>
          </button>
        </div>
      )}
    </div>
  );
};
