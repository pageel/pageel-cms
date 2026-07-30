/**
 * Plugin Registry — Static import map
 *
 * Security (L1): Vite KHÔNG hỗ trợ dynamic import(variable).
 * Plugin phải có static import entry tại build time.
 *
 * Security (S3): Plugin name phải match @pageel/plugin-* pattern.
 */

import type { PageelPlugin } from '@pageel/plugin-types';
import type { ComponentType } from 'react';
import { lazy } from 'react';
import { NativePlainEditor } from '../components/editors/NativePlainEditor';

import mdxPlugin from '@pageel/plugin-mdx';

// @para-doc [#csa-plugin-status-metadata]
export type PluginStatus = 'stable' | 'beta' | 'experimental' | 'dev';

export interface PluginMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  type: 'editor';
  author?: string;
  status?: PluginStatus;
}

// @para-doc [#csa-plugins-view-metadata]
export const SUPPORTED_PLUGINS: PluginMetadata[] = [
  {
    id: '@pageel/plugin-mdx',
    name: 'MDX Rich Editor',
    description: 'WYSIWYG MDX editor supporting visual formatting and custom JSX components.',
    version: '1.0.0',
    type: 'editor',
    author: 'Pageel Team',
    status: 'stable'
  },
  {
    id: '@pageel/plugin-easymde',
    name: 'EasyMDE Markdown Editor',
    description: 'Intuitive Markdown editor supporting syntax highlighting, dynamic toolbar formatting, and side-by-side preview.',
    version: '1.0.0',
    type: 'editor',
    author: 'Pageel Team',
    status: 'dev'
  }
];

// ── Static Registry ──
// Mỗi supported plugin = 1 static import entry.
// Thêm entry khi CMS bundle hỗ trợ thêm plugin mới.
const PLUGIN_LOADERS: Record<string, () => Promise<{ default: PageelPlugin }>> = {
  '@pageel/plugin-mdx': () => Promise.resolve({ default: mdxPlugin }),
  '@pageel/plugin-easymde': () => Promise.resolve({
    default: {
      id: '@pageel/plugin-easymde',
      name: 'EasyMDE Markdown Editor',
      version: '1.0.0',
      slots: {
        editor: () => null // Mock component temporarily
      }
    }
  } as any),
};

// ── Plugin Name Validation (Security: S3) ──
const VALID_PLUGIN_PATTERN = /^@pageel\/plugin-[a-z][a-z0-9-]*$/;

export function isValidPluginName(name: string): boolean {
  return VALID_PLUGIN_PATTERN.test(name);
}

// Track plugins that have fallen back at runtime
const fallbackPlugins = new Set<string>();

export function isPluginFallback(pluginName: string | undefined): boolean {
  if (!pluginName) return true;
  if (fallbackPlugins.has(pluginName)) return true;
  if (!isValidPluginName(pluginName)) return true;
  const loader = PLUGIN_LOADERS[pluginName];
  const meta = SUPPORTED_PLUGINS.find(p => p.id === pluginName);
  if (!loader || meta?.status === 'dev') return true;
  return false;
}

// @para-doc [#csa-zero-plugin-native-fallback]
// ── Source Editor Fallback Component Singleton Reference ──
const DEFAULT_MDX_SLOT: ComponentType<any> = NativePlainEditor as ComponentType<any>;
(DEFAULT_MDX_SLOT as any).__isMdxFallback = true;

// ── Resolve slot component ──
const lazyCache: Record<string, ComponentType<any>> = {};

// @para-doc [#csa-loader-fallback-guard]
// @para-doc [#csa-plugins-ui-dev-guard-boundary]
export function resolveSlotComponent<T>(
  pluginName: string | undefined,
  slot: keyof PageelPlugin['slots']
): ComponentType<T> | null {
  if (!pluginName) return DEFAULT_MDX_SLOT as ComponentType<T>;

  if (!isValidPluginName(pluginName)) {
    console.warn(`[pageel] Invalid plugin name: "${pluginName}"`);
    fallbackPlugins.add(pluginName);
    return DEFAULT_MDX_SLOT as ComponentType<T>;
  }

  const loader = PLUGIN_LOADERS[pluginName];
  const meta = SUPPORTED_PLUGINS.find(p => p.id === pluginName);
  if (!loader || meta?.status === 'dev') {
    console.warn(`[pageel] Plugin "${pluginName}" is in dev status or missing loader. Falling back to Source Editor.`);
    fallbackPlugins.add(pluginName);
    return DEFAULT_MDX_SLOT as ComponentType<T>;
  }

  const cacheKey = `${pluginName}:${slot}`;
  if (lazyCache[cacheKey]) {
    return lazyCache[cacheKey] as ComponentType<T>;
  }

  const Component = lazy(async () => {
    try {
      const mod = await loader();
      const component = mod.default.slots[slot];
      if (!component) {
        fallbackPlugins.add(pluginName);
        console.warn(`[pageel] Plugin "${pluginName}" slot "${String(slot)}" returned empty/null component. Falling back to Source Editor.`);
        return { default: DEFAULT_MDX_SLOT as ComponentType<any> };
      }
      return { default: component as ComponentType<any> };
    } catch (err: any) {
      fallbackPlugins.add(pluginName);
      console.warn(`[pageel] Plugin "${pluginName}" failed to load: ${err.message}. Falling back to Source Editor.`);
      return { default: DEFAULT_MDX_SLOT as ComponentType<any> };
    }
  });

  lazyCache[cacheKey] = Component;
  return Component as ComponentType<T>;
}


// ── Get plugin metadata (non-lazy) ──
export async function getPluginInfo(pluginName: string): Promise<PageelPlugin | null> {
  if (!isValidPluginName(pluginName)) return null;
  const loader = PLUGIN_LOADERS[pluginName];
  if (!loader) return null;

  try {
    const mod = await loader();
    return mod.default;
  } catch {
    return null;
  }
}
