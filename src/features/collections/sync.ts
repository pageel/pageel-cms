/**
 * Collection Sync Utils
 * 
 * Functions to sync collections with .pageelrc.json on the Git repo.
 */

import { IGitService } from '../../types';
import { Collection, Workspace, WorkspaceSettings, createCollection } from './types';

/**
 * Structure of .pageelrc.json v2 with collections support
 */
export interface PageelrcConfig {
  version: 2;
  collections: {
    id: string;
    name: string;
    postsPath: string;
    imagesPath: string;
    template?: object;
    tableColumns?: string[];
    columnWidths?: Record<string, number>;
  }[];
  activeCollectionId?: string;
  settings: {
    projectType: string;
    domainUrl?: string;
    postFileTypes?: string;
    imageFileTypes?: string;
    publishDateSource?: string;
    imageCompressionEnabled?: boolean;
    maxImageSize?: number;
    imageResizeMaxWidth?: number;
  };
  commitMessages?: {
    newPost?: string;
    updatePost?: string;
    newImage?: string;
    updateImage?: string;
  };
}

/**
 * Load collections from .pageelrc.json
 */
export async function loadCollectionsFromPageelrc(
  gitService: IGitService,
  repoId: string
): Promise<{ collections: Collection[]; activeCollectionId: string | null; settings: Partial<WorkspaceSettings> } | null> {
  try {
    const content = await gitService.getFileContent('.pageelrc.json');
    const config = JSON.parse(content);

    // Check if it's v2 format with collections
    if (config.version === 2 && Array.isArray(config.collections)) {
      const collections: Collection[] = config.collections.map((c: any) => ({
        id: c.id,
        name: c.name,
        postsPath: c.postsPath,
        imagesPath: c.imagesPath,
        template: c.template,
        tableColumns: c.tableColumns,
        columnWidths: c.columnWidths,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const settings: Partial<WorkspaceSettings> = {
        projectType: config.settings?.projectType,
        domainUrl: config.settings?.domainUrl,
        postFileTypes: config.settings?.postFileTypes,
        imageFileTypes: config.settings?.imageFileTypes,
        publishDateSource: config.settings?.publishDateSource,
        imageCompressionEnabled: config.settings?.imageCompressionEnabled,
        maxImageSize: config.settings?.maxImageSize,
        imageResizeMaxWidth: config.settings?.imageResizeMaxWidth,
        newPostCommit: config.commitMessages?.newPost,
        updatePostCommit: config.commitMessages?.updatePost,
        newImageCommit: config.commitMessages?.newImage,
        updateImageCommit: config.commitMessages?.updateImage,
      };

      return {
        collections,
        activeCollectionId: config.activeCollectionId || collections[0]?.id || null,
        settings,
      };
    }

    // v1 format - convert single paths to a "default" collection
    if (config.projectType || config.paths || config.postsPath) {
      const postsPath = config.paths?.posts || config.postsPath || '';
      const imagesPath = config.paths?.images || config.imagesPath || '';
      
      if (postsPath && imagesPath) {
        const defaultCollection = createCollection('default', 'Default', postsPath, imagesPath);
        
        const settings: Partial<WorkspaceSettings> = {
          projectType: config.projectType,
          domainUrl: config.domainUrl,
          postFileTypes: config.settings?.postFileTypes,
          imageFileTypes: config.settings?.imageFileTypes,
          publishDateSource: config.settings?.publishDateSource,
          imageCompressionEnabled: config.settings?.imageCompressionEnabled,
          maxImageSize: config.settings?.maxImageSize || config.settings?.imageCompression?.maxSize,
          imageResizeMaxWidth: config.settings?.imageResizeMaxWidth || config.settings?.imageCompression?.maxWidth,
          newPostCommit: config.commitMessages?.newPost || config.commits?.newPost,
          updatePostCommit: config.commitMessages?.updatePost || config.commits?.updatePost,
          newImageCommit: config.commitMessages?.newImage || config.commits?.newImage,
          updateImageCommit: config.commitMessages?.updateImage || config.commits?.updateImage,
        };

        return {
          collections: [defaultCollection],
          activeCollectionId: 'default',
          settings,
        };
      }
    }

    return null;
  } catch (e) {
    console.log('No .pageelrc.json found or failed to parse');
    return null;
  }
}

/**
 * Save collections to .pageelrc.json
 */
export async function saveCollectionsToPageelrc(
  gitService: IGitService,
  workspace: Workspace
): Promise<boolean> {
  try {
    const config: PageelrcConfig = {
      version: 2,
      collections: workspace.collections.map(c => ({
        id: c.id,
        name: c.name,
        postsPath: c.postsPath,
        imagesPath: c.imagesPath,
        template: c.template,
        tableColumns: c.tableColumns,
        columnWidths: c.columnWidths,
      })),
      activeCollectionId: workspace.activeCollectionId || undefined,
      settings: {
        projectType: workspace.settings.projectType,
        domainUrl: workspace.settings.domainUrl || undefined,
        postFileTypes: workspace.settings.postFileTypes,
        imageFileTypes: workspace.settings.imageFileTypes,
        publishDateSource: workspace.settings.publishDateSource,
        imageCompressionEnabled: workspace.settings.imageCompressionEnabled,
        maxImageSize: workspace.settings.maxImageSize,
        imageResizeMaxWidth: workspace.settings.imageResizeMaxWidth,
      },
      commitMessages: {
        newPost: workspace.settings.newPostCommit,
        updatePost: workspace.settings.updatePostCommit,
        newImage: workspace.settings.newImageCommit,
        updateImage: workspace.settings.updateImageCommit,
      },
    };

    // Check if file exists
    let sha: string | null = null;
    try {
      sha = await gitService.getFileSha('.pageelrc.json');
    } catch (e) {
      // File doesn't exist
    }

    const content = JSON.stringify(config, null, 2);

    if (sha) {
      await gitService.updateFileContent('.pageelrc.json', content, 'chore: update pageel config', sha);
    } else {
      await gitService.createFileFromString('.pageelrc.json', content, 'chore: create pageel config');
    }

    return true;
  } catch (e) {
    console.error('Failed to save .pageelrc.json:', e);
    return false;
  }
}
