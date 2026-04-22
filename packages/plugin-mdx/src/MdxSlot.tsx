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
  insertImage$,
  usePublisher,
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

// ── Custom Image Button ──
const CustomImageButton = ({ 
  requestImageRef,
  activeRef
}: { 
  requestImageRef: React.MutableRefObject<(() => Promise<string | null>) | undefined>,
  activeRef: React.MutableRefObject<MDXEditorMethods | null>
}) => {
  const insertImage = usePublisher(insertImage$);

  return (
    <button
      type="button"
      title="Insert Image (Upload or from Repo)"
      onClick={async () => {
        const path = await requestImageRef.current?.();
        if (path) {
          // Khôi phục focus để editor biết vị trí chèn
          activeRef.current?.focus();
          
          // Đợi DOM cập nhật focus rồi mới insert
          setTimeout(() => {
            insertImage({ src: path });
          }, 50);
        }
      }}
      className="flex items-center justify-center p-1.5 hover:bg-gray-100 rounded text-gray-700 text-sm ml-1 transition-colors"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-gray-600"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
    </button>
  );
};

// ── Editor Component ──
export function MdxEditorSlot({
  initialValue,
  onChange,
  gitService,
  imageBaseUrl,
  externalMarkdown,
  externalMarkdownVersion,
  editorRef,
  readOnly = false,
  onRequestImage,
}: EditorProps) {
  const internalRef = useRef<MDXEditorMethods>(null);
  const activeRef = editorRef || internalRef;
  const [initialMarkdown] = useState(initialValue);

  // B1: Debounce onChange to 300ms
  const debouncedOnChange = useDebouncedCallback(onChange, 300);

  // Image upload handler via restricted EditorGitService
  const imageUploadHandler: ImageUploadHandler = useCallback(
    async (image: File) => {
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

  // Keep latest onRequestImage in ref to avoid triggering useMemo
  const requestImageRef = useRef(onRequestImage);
  useEffect(() => {
    requestImageRef.current = onRequestImage;
  }, [onRequestImage]);

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
          <BlockTypeSelect />
          <BoldItalicUnderlineToggles />
          <ListsToggle />
          <CreateLink />
          <CustomImageButton requestImageRef={requestImageRef} activeRef={activeRef} />
        </>
      ),
    }),
  ], [imagePluginConfig, activeRef]);

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
