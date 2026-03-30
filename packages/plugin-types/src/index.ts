/**
 * @pageel/plugin-types
 *
 * TypeScript interfaces for Pageel CMS plugin system.
 * Zero runtime dependencies — types only.
 */

import type { ComponentType } from 'react';

// ── Plugin Contract ──

export interface PageelPlugin {
  /** Unique plugin identifier (e.g. "@pageel/plugin-mdx") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semantic version */
  version: string;
  /** Slot components this plugin provides */
  slots: {
    editor?: ComponentType<EditorProps>;
    toolbar?: ComponentType<ToolbarProps>;
    preview?: ComponentType<PreviewProps>;
  };
  /** Optional settings UI component */
  settings?: ComponentType;
}

// ── Slot Props ──

export interface EditorProps {
  /** Current markdown content (body only, no frontmatter) */
  value: string;
  /** Callback when content changes — must emit valid markdown */
  onChange: (markdown: string) => void;
  /** Current frontmatter key-value pairs (read-only for editor) */
  frontmatter: Readonly<Record<string, unknown>>;
  /** Restricted git service — image operations only */
  gitService: EditorGitService;
  /** Path prefix for image uploads */
  imagesPath: string;
  /** Current UI locale (e.g. "en", "vi") */
  locale: string;
  /** Whether editor is in read-only mode */
  readOnly?: boolean;
}

export interface ToolbarProps {
  /** Dispatch toolbar action */
  onAction: (action: string, payload?: unknown) => void;
  /** Currently active features */
  activeFeatures: string[];
}

export interface PreviewProps {
  /** Markdown content to preview */
  markdown: string;
  /** Current frontmatter key-value pairs */
  frontmatter: Readonly<Record<string, unknown>>;
}

// ── Restricted Git Service (Security: L3) ──

export interface EditorGitService {
  /** Upload an image file, returns the resolved URL path */
  uploadImage(file: File): Promise<string>;
  /** Get image as blob for preview/display */
  getImageBlob(path: string): Promise<Blob>;
}
