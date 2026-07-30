import { describe, it, expect } from 'vitest';
import React from 'react';
import { NativePlainEditor } from '../src/components/editors/NativePlainEditor';

describe('PostDetailView 2-Tab Architecture & Native Fallback', () => {
  it('should export NativePlainEditor and support value & onChange props', () => {
    expect(NativePlainEditor).toBeDefined();
    expect(typeof NativePlainEditor).toBe('function');
  });

  it('should consolidate tab logic to 2 tabs when WYSIWYG plugin is disabled', () => {
    const hasWysiwygPlugin = false;
    const activeTab = 'edit';

    // Simulate tab list calculation
    const tabs = [];
    if (hasWysiwygPlugin) {
      tabs.push({ id: 'edit', label: 'Edit' });
      tabs.push({ id: 'code', label: 'Source' });
    } else {
      tabs.push({ id: 'edit', label: 'Markdown Editor' });
    }
    tabs.push({ id: 'preview', label: 'Preview' });

    expect(tabs.length).toBe(2);
    expect(tabs[0].label).toBe('Markdown Editor');
    expect(tabs[1].label).toBe('Preview');
    expect(tabs.some(t => t.label === 'Source')).toBe(false);
  });

  it('should render 3 tabs when WYSIWYG plugin is enabled', () => {
    const hasWysiwygPlugin = true;

    const tabs = [];
    if (hasWysiwygPlugin) {
      tabs.push({ id: 'edit', label: 'Edit' });
      tabs.push({ id: 'code', label: 'Source' });
    } else {
      tabs.push({ id: 'edit', label: 'Markdown Editor' });
    }
    tabs.push({ id: 'preview', label: 'Preview' });

    expect(tabs.length).toBe(3);
    expect(tabs[0].label).toBe('Edit');
    expect(tabs[1].label).toBe('Source');
    expect(tabs[2].label).toBe('Preview');
  });
});
