// @para-doc [#csa-zero-plugin-native-fallback]
import React, { useState, useCallback, useRef, useEffect } from 'react';

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

  useEffect(() => {
    if (controlledValue === undefined) {
      setInternalValue(initialValue);
    }
  }, [initialValue, controlledValue]);

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
    <div className={`w-full border border-notion-border rounded-lg overflow-hidden bg-white shadow-sm ${className}`}>
      {/* Source Editor Toolbar */}
      <div className="flex items-center gap-1.5 p-2 bg-notion-sidebar/40 border-b border-notion-border text-xs font-mono select-none">
        <span className="px-2 py-0.5 bg-notion-bg/80 text-notion-muted rounded border border-notion-border text-[10px] font-semibold tracking-wide">
          Source Editor
        </span>
        <div className="h-4 w-px bg-notion-border mx-1" />
        <button
          type="button"
          onClick={() => insertSnippet('**', '**')}
          className="px-2 py-1 hover:bg-notion-sidebar rounded text-notion-text font-bold transition-colors"
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => insertSnippet('*', '*')}
          className="px-2 py-1 hover:bg-notion-sidebar rounded text-notion-text italic transition-colors"
          title="Italic"
        >
          I
        </button>

        <button
          type="button"
          onClick={() => insertSnippet('### ')}
          className="px-2 py-1 hover:bg-notion-sidebar rounded text-notion-text font-bold transition-colors"
          title="Heading 3"
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => insertSnippet('`', '`')}
          className="px-2 py-1 hover:bg-notion-sidebar rounded text-notion-text transition-colors"
          title="Inline Code"
        >
          {`</>`}
        </button>
        <button
          type="button"
          onClick={() => insertSnippet('[', '](https://example.com)')}
          className="px-2 py-1 hover:bg-notion-sidebar rounded text-notion-text transition-colors"
          title="Link"
        >
          Link
        </button>
        <button
          type="button"
          onClick={() => insertSnippet('- ')}
          className="px-2 py-1 hover:bg-notion-sidebar rounded text-notion-text transition-colors"
          title="List Item"
        >
          List
        </button>
      </div>

      {/* Editor Textarea with Notion Aesthetics */}
      <textarea
        ref={textareaRef}
        value={currentValue}
        onChange={handleTextChange}
        placeholder={placeholder}
        readOnly={readOnly}
        spellCheck={false}
        className="w-full min-h-[450px] p-5 font-mono text-xs bg-white text-notion-text leading-relaxed focus:outline-none resize-y"
      />
    </div>
  );
}

export default NativePlainEditor;
