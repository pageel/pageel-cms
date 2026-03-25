/**
 * Collection Types
 * 
 * TypeScript interfaces for multi-collection support.
 * A Workspace contains multiple Collections, each with independent paths.
 */

import { ProjectType } from '../../types';

/**
 * A Collection represents a content type within a workspace.
 * Examples: Blog, Projects, Documentation, Products
 */
export interface Collection {
  /** Unique identifier (e.g., 'blog', 'projects', 'docs') */
  id: string;
  
  /** Display name for UI */
  name: string;
  
  /** Optional icon identifier */
  icon?: string;
  
  /** Path to posts/content directory */
  postsPath: string;
  
  /** Path to images/assets directory */
  imagesPath: string;
  
  /** Frontmatter template for this collection */
  template?: CollectionTemplate;
  
  /** Visible columns in post table */
  tableColumns?: string[];
  
  /** Column widths (percentage) */
  columnWidths?: Record<string, number>;
  
  /** ISO timestamp */
  createdAt: string;
  
  /** ISO timestamp */
  updatedAt: string;
}

/**
 * Template definition for a collection's frontmatter
 */
export interface CollectionTemplate {
  /** Field definitions */
  fields: TemplateField[];
}

export interface TemplateField {
  /** Field name (key in frontmatter) */
  name: string;
  
  /** Field type */
  type: 'string' | 'date' | 'array' | 'boolean' | 'number' | 'object';
  
  /** Is this field required? */
  required?: boolean;
  
  /** Default value */
  defaultValue?: unknown;
  
  /** Description for UI */
  description?: string;
}

/**
 * Workspace-level settings shared across all collections
 */
export interface WorkspaceSettings {
  /** Project type (astro, github) */
  projectType: ProjectType;
  
  /** Domain URL for asset links */
  domainUrl: string;
  
  /** Allowed post file extensions */
  postFileTypes: string;
  
  /** Allowed image file extensions */
  imageFileTypes: string;
  
  /** Date source for new posts */
  publishDateSource: 'file' | 'system';
  
  /** Image compression settings */
  imageCompressionEnabled: boolean;
  maxImageSize: number;
  imageResizeMaxWidth: number;
  
  /** Commit message templates */
  newPostCommit: string;
  updatePostCommit: string;
  newImageCommit: string;
  updateImageCommit: string;
}

/**
 * A Workspace represents a Git repository with its collections and settings.
 */
export interface Workspace {
  /** Repository identifier (e.g., 'owner/repo') */
  repoId: string;
  
  /** List of collections in this workspace */
  collections: Collection[];
  
  /** Currently active collection ID */
  activeCollectionId: string | null;
  
  /** Shared workspace settings */
  settings: WorkspaceSettings;
  
  /** ISO timestamp */
  createdAt: string;
  
  /** ISO timestamp */
  updatedAt: string;
}

/**
 * Default collection for backward compatibility
 */
export const DEFAULT_COLLECTION: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Default',
  postsPath: '',
  imagesPath: '',
};

/**
 * Create a new collection with defaults
 */
export function createCollection(
  id: string,
  name: string,
  postsPath: string,
  imagesPath: string,
  template?: CollectionTemplate
): Collection {
  const now = new Date().toISOString();
  return {
    id,
    name,
    postsPath,
    imagesPath,
    template,
    createdAt: now,
    updatedAt: now,
  };
}
