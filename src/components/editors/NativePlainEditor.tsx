// @para-doc [#csa-zero-plugin-native-fallback]
import React, { useState, useCallback, useRef } from 'react';

export interface NativePlainEditorProps {
  initialValue?: string;
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}

export function NativePlainEditor({
  initialValue = '',
  value: controlledValue,
  onChange,
  placeholder = 'Write your markdown content here...',
  className = '',
  readOnly = false,
}: NativePlainEditorProps) {
  const [internalValue, setInternalValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentValue = controlledValue !== undefined ? controlledValue : internalValue;

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      if (controlledValue === undefined) {
        setInternalValue(newValue);
      }
      onChange?.(newValue);
    },
    [controlledValue, onChange]
  );

  const insertSnippet = useCallback(
    (prefix: string, suffix: string = '') => {
      const textarea = textareaRef.current;
      if (!textarea || readOnly) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = currentValue.substring(start, end);
      const replacement = `${prefix}${selectedText || 'text'}${suffix}`;
      const updatedValue =
        currentValue.substring(0, start) + replacement + currentValue.substring(end);

      if (controlledValue === undefined) {
        setInternalValue(updatedValue);
      }
      onChange?.(updatedValue);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + prefix.length,
          start + prefix.length + (selectedText ? selectedText.length : 4)
        );
      }, 0);
    },
    [currentValue, controlledValue, onChange, readOnly]
  );

  return (
    <div className={`w-full border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900 ${className}`}>
      {/* Native Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-xs font-mono select-none">
        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-[10px] font-semibold uppercase tracking-wider">
          Native Core Editor
        </span>
        <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-1" />
        <button
          type="button"
          onClick={() => insertSnippet('**', '**')}
          className="px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300 font-bold"
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => insertSnippet('*', '*')}
          className="px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300 italic"
          title="Italic"
        >
          I
        </button>

        <button
          type="button"
          onClick={() => insertSnippet('### ')}
          className="px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300 font-bold"
          title="Heading 3"
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => insertSnippet('`', '`')}
          className="px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300"
          title="Inline Code"
        >
          {`</>`}
        </button>
        <button
          type="button"
          onClick={() => insertSnippet('[', '](https://example.com)')}
          className="px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300"
          title="Link"
        >
          Link
        </button>
        <button
          type="button"
          onClick={() => insertSnippet('- ')}
          className="px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300"
          title="List Item"
        >
          List
        </button>
      </div>

      {/* Editor Textarea */}
      <textarea
        ref={textareaRef}
        value={currentValue}
        onChange={handleTextChange}
        placeholder={placeholder}
        readOnly={readOnly}
        className="w-full min-h-[350px] p-4 font-mono text-sm bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none resize-y"
      />
    </div>
  );
}

export default NativePlainEditor;
