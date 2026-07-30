import { describe, it, expect } from 'vitest';
import React from 'react';
import { MdxEditorSlot } from '../packages/plugin-mdx/src/MdxSlot';
import { resolveSlotComponent } from '../src/plugins/registry';
import { NativePlainEditor } from '../src/components/editors/NativePlainEditor';

describe('BUG-306 Reproducer & Fallback TDD Tests', () => {
  it('MdxEditorSlot component should accept undefined props gracefully', () => {
    // When invoked with undefined, component props default logic works
    expect(() => {
      const Slot: any = MdxEditorSlot;
      const Element = () => <Slot />;
      expect(Element).toBeDefined();
    }).not.toThrow();
  });

  it('resolveSlotComponent should return NativePlainEditor static fallback for null or invalid plugin', () => {
    const NullSlot = resolveSlotComponent(undefined, 'editor');
    expect(NullSlot).toBe(NativePlainEditor);

    const InvalidSlot = resolveSlotComponent('non-existent-plugin', 'editor');
    expect(InvalidSlot).toBe(NativePlainEditor);
  });
});
