/**
 * MdxEditorSlot — Bridge EditorProps → MDXEditor
 *
 * Features:
 * - B1: onChange debounce (300ms) — prevent re-render storm
 * - B2: CSS isolation — prevent Tailwind reset from affecting editor
 * - Image upload via EditorGitService (restricted API)
 * - Full toolbar: headings, bold, italic, lists, links, images, code
 */

import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  imagePlugin,
  codeBlockPlugin,
  toolbarPlugin,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  ListsToggle,
  CreateLink,
  InsertImage,
  UndoRedo,
  type ImageUploadHandler,
  type MDXEditorMethods
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import type { EditorProps } from '@pageel/plugin-types';
import { useMemo, useCallback, useRef, useEffect, useState } from 'react';

// ── B1: Debounce utility ──
function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useMemo(() => {
    const debounced = (...args: any[]) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    };
    return debounced as T;
  }, [delay]);
}

// @para-doc [#csa-safe-props-protection]
// ── Editor Component ──
export function MdxEditorSlot(props: EditorProps = {} as EditorProps) {
  const {
    initialValue = '',
    onChange,
    gitService,
    imageBaseUrl,
    externalMarkdown,
    externalMarkdownVersion,
    editorRef,
    readOnly = false,
  } = props || {};

  const internalRef = useRef<MDXEditorMethods>(null);
  const activeRef = editorRef || internalRef;
  const [initialMarkdown] = useState(initialValue || '');

  const safeOnChange = onChange || (() => {});
  const debouncedOnChange = useDebouncedCallback(safeOnChange, 300);

  // Image upload handler via restricted EditorGitService with safe fallback
  const imageUploadHandler: ImageUploadHandler = useCallback(
    async (image: File) => {
      if (!gitService || typeof gitService.uploadImage !== 'function') return '';
      const url = await gitService.uploadImage(image);
      return url;
    },
    [gitService]
  );

  // imagePlugin custom: resolve relative paths
  const imagePluginConfig = useMemo(() => imagePlugin({
    imageUploadHandler,
    // Transform image src for display
    imagePreviewHandler: async (src) => {
      if (src.startsWith('http')) return src;
      return imageBaseUrl ? `${imageBaseUrl}${src}` : src;
    },
  }), [imageUploadHandler, imageBaseUrl]);

  // L1 fix: sync external markdown when Source tab edits happen
  useEffect(() => {
    if (externalMarkdownVersion && externalMarkdown !== undefined) {
      activeRef.current?.setMarkdown(externalMarkdown);
    }
  }, [externalMarkdownVersion, externalMarkdown, activeRef]);

  // B3: Memoize plugins to prevent infinite re-mounts of MDXEditor
  const memoizedPlugins = useMemo(() => [
    headingsPlugin(),
    listsPlugin(),
    quotePlugin(),
    thematicBreakPlugin(),
    linkPlugin(),
    imagePluginConfig,
    codeBlockPlugin({ defaultCodeBlockLanguage: '' }),
    markdownShortcutPlugin(),
    toolbarPlugin({
      toolbarContents: () => (
        <>
          <UndoRedo />
          <BlockTypeSelect />
          <BoldItalicUnderlineToggles />
          <ListsToggle />
          <CreateLink />
          <InsertImage />
        </>
      ),
    }),
  ], [imagePluginConfig]);

  return (
    // B2: CSS isolation — prevent Tailwind preflight from affecting editor
    <div className="pageel-editor-slot">
      <MDXEditor
        ref={activeRef}
        markdown={initialMarkdown}
        onChange={debouncedOnChange}
        readOnly={readOnly}
        plugins={memoizedPlugins}
      />
    </div>
  );
}
