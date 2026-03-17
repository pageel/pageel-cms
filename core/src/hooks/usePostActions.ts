/**
 * usePostActions Hook
 * 
 * TD-10: Extracted from PostList.tsx.
 * Handles all post CRUD actions:
 * - Upload new post file
 * - Update post file content
 * - Update post image (via frontmatter)
 * - Delete post
 */

import React, { useState, useRef } from 'react';
import { IGitService } from '../types';
import { updateFrontmatter } from '../utils/parsing';

export interface PostData {
  frontmatter: Record<string, any>;
  body: string;
  rawContent: string;
  name: string;
  sha: string;
  path: string;
  html_url: string;
  thumbnailUrl: string | null;
}

interface UsePostActionsParams {
  gitService: IGitService;
  path: string;
  imagesPath: string;
  updatePostCommitTemplate: string;
  onAction: () => void;
  fetchPosts: () => void;
  selectedPost: PostData | null;
  setSelectedPost: (post: PostData | null) => void;
}

interface UsePostActionsReturn {
  // Upload
  uploadPostInputRef: React.RefObject<HTMLInputElement>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  confirmUpload: () => Promise<void>;
  uploadFile: File | null;
  isUploadModalOpen: boolean;
  setIsUploadModalOpen: (v: boolean) => void;
  setUploadFile: (f: File | null) => void;
  isUploading: boolean;

  // Update post file
  updatePostFileInputRef: React.RefObject<HTMLInputElement>;
  handleUpdatePostFile: (post: PostData) => void;
  confirmUpdatePostFile: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;

  // Update post image
  handleUpdateImage: (post: PostData) => void;
  handleImageConfirm: (result: { type: 'new' | 'existing'; file?: File; path?: string }) => Promise<void>;
  isImageModalOpen: boolean;
  setIsImageModalOpen: (v: boolean) => void;
  postToUpdateImage: PostData | null;

  // Delete
  postToDelete: PostData | null;
  setPostToDelete: (post: PostData | null) => void;
  confirmDelete: () => Promise<void>;
  isDeleting: boolean;
}

export function usePostActions({
  gitService,
  path,
  imagesPath,
  updatePostCommitTemplate,
  onAction,
  fetchPosts,
  selectedPost,
  setSelectedPost,
}: UsePostActionsParams): UsePostActionsReturn {
  // Upload state
  const uploadPostInputRef = useRef<HTMLInputElement>(null!);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Update post file state
  const updatePostFileInputRef = useRef<HTMLInputElement>(null!);
  const [postToUpdateFile, setPostToUpdateFile] = useState<PostData | null>(null);

  // Update post image state
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [postToUpdateImage, setPostToUpdateImage] = useState<PostData | null>(null);

  // Delete state
  const [postToDelete, setPostToDelete] = useState<PostData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
      setIsUploadModalOpen(true);
      e.target.value = '';
    }
  };

  const confirmUpload = async () => {
    if (!uploadFile) return;
    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        const commitMsg = `feat(content): add post "${uploadFile.name}"`;
        const filePath = path ? `${path}/${uploadFile.name}` : uploadFile.name;

        await gitService.createFileFromString(filePath, content, commitMsg);
        onAction();
        fetchPosts();
        setIsUploadModalOpen(false);
        setUploadFile(null);
      };
      reader.readAsText(uploadFile);
    } catch (e) {
      alert("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdatePostFile = (post: PostData) => {
    setPostToUpdateFile(post);
    updatePostFileInputRef.current?.click();
  };

  const confirmUpdatePostFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !postToUpdateFile) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const content = ev.target?.result as string;
        const commitMsg = updatePostCommitTemplate.replace('{filename}', postToUpdateFile.name) || `fix(content): update post "${postToUpdateFile.name}"`;

        await gitService.updateFileContent(postToUpdateFile.path, content, commitMsg, postToUpdateFile.sha);
        onAction();
        fetchPosts();
        setPostToUpdateFile(null);
      };
      reader.readAsText(file);
    } catch (err) {
      alert("Update failed");
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleUpdateImage = (post: PostData) => {
    setPostToUpdateImage(post);
    setIsImageModalOpen(true);
  };

  const handleImageConfirm = async (result: { type: 'new' | 'existing'; file?: File; path?: string }) => {
    if (!postToUpdateImage) return;
    setIsUploading(true);
    try {
      let imageUrl = '';
      if (result.type === 'new' && result.file) {
        const commitMsg = `feat(assets): add image "${result.file.name}"`;
        const fullPath = imagesPath ? `${imagesPath}/${result.file.name}` : result.file.name;
        await gitService.uploadFile(fullPath, result.file, commitMsg);
        imageUrl = fullPath;
      } else if (result.type === 'existing' && result.path) {
        imageUrl = result.path;
      }

      if (imageUrl) {
        let finalUrl = imageUrl;
        if (finalUrl.startsWith('public/')) {
          finalUrl = finalUrl.replace('public/', '/');
        } else if (!finalUrl.startsWith('http') && !finalUrl.startsWith('/')) {
          finalUrl = '/' + finalUrl;
        }

        const fm = postToUpdateImage.frontmatter;
        let targetField = 'image';
        if (fm.cover) targetField = 'cover';
        else if (fm.thumbnail) targetField = 'thumbnail';
        else if (fm.heroImage) targetField = 'heroImage';

        const newContent = updateFrontmatter(postToUpdateImage.rawContent, { [targetField]: finalUrl });
        const commitMsg = `fix(content): update image for "${postToUpdateImage.name}"`;

        await gitService.updateFileContent(postToUpdateImage.path, newContent, commitMsg, postToUpdateImage.sha);
        onAction();
        fetchPosts();
      }
    } catch (e) {
      alert("Failed to update image");
      console.error(e);
    } finally {
      setIsUploading(false);
      setIsImageModalOpen(false);
      setPostToUpdateImage(null);
    }
  };

  const confirmDelete = async () => {
    if (!postToDelete) return;
    setIsDeleting(true);
    try {
      const commitMsg = `chore(content): delete post "${postToDelete.name}"`;
      await gitService.deleteFile(postToDelete.path, postToDelete.sha, commitMsg);
      onAction();
      fetchPosts();
      if (selectedPost?.path === postToDelete.path) setSelectedPost(null);
    } catch (e) {
      alert("Delete failed");
    } finally {
      setIsDeleting(false);
      setPostToDelete(null);
    }
  };

  return {
    uploadPostInputRef,
    handleFileUpload,
    confirmUpload,
    uploadFile,
    isUploadModalOpen,
    setIsUploadModalOpen,
    setUploadFile,
    isUploading,
    updatePostFileInputRef,
    handleUpdatePostFile,
    confirmUpdatePostFile,
    handleUpdateImage,
    handleImageConfirm,
    isImageModalOpen,
    setIsImageModalOpen,
    postToUpdateImage,
    postToDelete,
    setPostToDelete,
    confirmDelete,
    isDeleting,
  };
}
