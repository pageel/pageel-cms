/**
 * @pageel/plugin-mdx
 *
 * MDXEditor WYSIWYG plugin for Pageel CMS.
 * Provides a rich text editor slot using @mdxeditor/editor.
 *
 * License: MIT (MDXEditor is also MIT)
 */

import type { PageelPlugin } from '@pageel/plugin-types';
import { MdxEditorSlot } from './MdxSlot';

const plugin: PageelPlugin = {
  id: '@pageel/plugin-mdx',
  name: 'MDX Editor',
  version: '0.1.0',
  slots: {
    editor: MdxEditorSlot,
  },
};

export default plugin;

// Named exports for direct usage
export { MdxEditorSlot } from './MdxSlot';
