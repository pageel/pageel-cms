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
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import type { EditorProps } from '@pageel/plugin-types';
import { useMemo, useCallback, useRef } from 'react';

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
  value,
  onChange,
  gitService,
  readOnly = false,
}: EditorProps) {
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

  return (
    // B2: CSS isolation — prevent Tailwind preflight from affecting editor
    <div className="pageel-editor-slot">
      <MDXEditor
        markdown={value}
        onChange={debouncedOnChange}
        readOnly={readOnly}
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          linkPlugin(),
          imagePlugin({ imageUploadHandler }),
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
              </>
            ),
          }),
        ]}
      />
    </div>
  );
}
