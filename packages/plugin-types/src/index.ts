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
  /** Initial markdown content — set once on mount, NOT controlled */
  initialValue: string;
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
  /** Callback to open image gallery picker — returns selected image path or null */
  onRequestImage?: () => Promise<string | null>;
  /** Base URL to prepend to relative image paths for display */
  imageBaseUrl?: string;
  /** Markdown set by parent (e.g. after Source tab edit). Plugin MUST sync when version changes. (Review L1) */
  externalMarkdown?: string;
  /** Change counter — plugin watches this to detect when externalMarkdown needs syncing */
  externalMarkdownVersion?: number;
  /** Ref để truy xuất các phương thức của Editor như getMarkdown() */
  editorRef?: React.MutableRefObject<any>;
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
