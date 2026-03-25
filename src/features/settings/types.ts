/**
 * Settings Feature Types
 * 
 * These interfaces enable swappable settings storage:
 * - Core: GitSettingsProvider (.pageelrc.json on repo + localStorage cache)
 * - Pro: DatabaseSettingsProvider (Database per user/org)
 */

import { AppSettings } from '../../types';

/**
 * Settings Provider Interface
 * 
 * Implement this interface for different storage strategies:
 * - GitSettingsProvider: .pageelrc.json on repo + localStorage
 * - DatabaseSettingsProvider (Pro): Database per user/org
 */
export interface ISettingsProvider {
  /**
   * Load settings for a repository
   * @param repoId - Repository full name (e.g., "owner/repo")
   */
  load(repoId: string): Promise<AppSettings>;
  
  /**
   * Save settings for a repository
   * @param repoId - Repository full name
   * @param settings - Settings to save
   */
  save(repoId: string, settings: AppSettings): Promise<void>;
  
  /**
   * Export settings as downloadable file
   */
  export(repoId: string): Promise<Blob>;
  
  /**
   * Import settings from file
   */
  import(file: File): Promise<AppSettings>;
  
  /**
   * Validate settings object
   */
  validate(settings: Partial<AppSettings>): boolean;
}

/**
 * Settings validation schema
 */
export const SETTINGS_SCHEMA: { [key: string]: (v: unknown) => boolean } = {
  projectType: (v) => typeof v === 'string' && ['astro', 'github'].includes(v),
  postsPath: (v) => typeof v === 'string',
  imagesPath: (v) => typeof v === 'string',
  domainUrl: (v) => typeof v === 'string',
  postTemplate: (v) => typeof v === 'string',
  postFileTypes: (v) => typeof v === 'string' && (v as string).length < 100,
  imageFileTypes: (v) => typeof v === 'string' && (v as string).length < 100,
  publishDateSource: (v) => typeof v === 'string' && ['file', 'system'].includes(v),
  imageCompressionEnabled: (v) => typeof v === 'boolean',
  maxImageSize: (v) => typeof v === 'number' && (v as number) >= 10 && (v as number) <= 1024,
  imageResizeMaxWidth: (v) => typeof v === 'number' && (v as number) >= 0 && (v as number) <= 10000,
  newPostCommit: (v) => typeof v === 'string' && (v as string).length < 200,
  updatePostCommit: (v) => typeof v === 'string' && (v as string).length < 200,
  newImageCommit: (v) => typeof v === 'string' && (v as string).length < 200,
  updateImageCommit: (v) => typeof v === 'string' && (v as string).length < 200,
  'pageel-cms-lang': (v) => typeof v === 'string' && ['en', 'vi'].includes(v),
};

/**
 * Default settings values
 */
export const DEFAULT_SETTINGS: AppSettings = {
  projectType: 'astro',
  postsPath: '',
  imagesPath: 'public/images',
  domainUrl: '',
  postFileTypes: '.md,.mdx',
  imageFileTypes: 'image/*',
  publishDateSource: 'file',
  imageCompressionEnabled: false,
  maxImageSize: 500,
  imageResizeMaxWidth: 1024,
  newPostCommit: 'feat(content): add post "{filename}"',
  updatePostCommit: 'fix(content): update post "{filename}"',
  newImageCommit: 'feat(assets): add image "{filename}"',
  updateImageCommit: 'refactor(assets): update image for "{filename}"',
};
