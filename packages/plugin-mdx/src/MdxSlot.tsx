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
  InsertImage,
  ListsToggle,
  CreateLink,
  type ImageUploadHandler,
  type MDXEditorMethods
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import type { EditorProps } from '@pageel/plugin-types';
import { useMemo, useCallback, useRef, useEffect } from 'react';

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

  return (
    // B2: CSS isolation — prevent Tailwind preflight from affecting editor
    <div className="pageel-editor-slot">
      <MDXEditor
        ref={activeRef}
        markdown={initialValue}
        onChange={debouncedOnChange}
        readOnly={readOnly}
        plugins={[
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
                <InsertImage />
                {onRequestImage && (
                  <button
                    type="button"
                    title="Choose from Library"
                    onClick={async () => {
                      const path = await onRequestImage();
                      if (path) {
                        activeRef.current?.insertMarkdown(`![](${path})`);
                      }
                    }}
                    className="flex items-center justify-center p-1.5 hover:bg-gray-100 rounded text-gray-700 text-sm ml-1"
                  >
                    🖼 Library
                  </button>
                )}
              </>
            ),
          }),
        ]}
      />
    </div>
  );
}
