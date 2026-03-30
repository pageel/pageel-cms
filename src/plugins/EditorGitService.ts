/**
 * EditorGitService — Restricted adapter for plugin editor
 *
 * Security (L3): Plugin KHÔNG nhận IGitService đầy đủ (13 methods).
 * Chỉ nhận 2 methods: uploadImage, getImageBlob.
 *
 * Flow: Plugin → EditorGitService → ProxyGitAdapter → /api/proxy/upload
 */

import type { IGitService } from '../types';
import type { EditorGitService } from '@pageel/plugin-types';

export function createEditorGitService(
  gitService: IGitService,
  imagesPath: string
): EditorGitService {
  return {
    async uploadImage(file: File): Promise<string> {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${imagesPath}/${safeName}`;
      const commitMsg = `feat(assets): add image "${safeName}"`;
      await gitService.uploadFile(path, file, commitMsg);
      // Normalize path for frontmatter/markdown references
      return path.startsWith('public/')
        ? path.replace('public/', '/')
        : `/${path}`;
    },

    async getImageBlob(path: string): Promise<Blob> {
      return gitService.getFileAsBlob(path);
    },
  };
}
