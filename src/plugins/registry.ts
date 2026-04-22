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

// ── Static Registry ──
// Mỗi supported plugin = 1 static import entry.
// Thêm entry khi CMS bundle hỗ trợ thêm plugin mới.
const PLUGIN_LOADERS: Record<string, () => Promise<{ default: PageelPlugin }>> = {
  '@pageel/plugin-mdx': () => import('@pageel/plugin-mdx'),
  // Future plugins:
  // '@pageel/plugin-milkdown': () => import('@pageel/plugin-milkdown'),
};

// ── Plugin Name Validation (Security: S3) ──
const VALID_PLUGIN_PATTERN = /^@pageel\/plugin-[a-z][a-z0-9-]*$/;

export function isValidPluginName(name: string): boolean {
  return VALID_PLUGIN_PATTERN.test(name);
}

// ── Resolve slot component ──
const lazyCache: Record<string, ComponentType<any>> = {};

export function resolveSlotComponent<T>(
  pluginName: string | undefined,
  slot: keyof PageelPlugin['slots']
): ComponentType<T> | null {
  if (!pluginName) return null;

  if (!isValidPluginName(pluginName)) {
    console.warn(`[pageel] Invalid plugin name: "${pluginName}"`);
    return null;
  }

  const cacheKey = `${pluginName}:${slot}`;
  if (lazyCache[cacheKey]) {
    return lazyCache[cacheKey] as ComponentType<T>;
  }

  const loader = PLUGIN_LOADERS[pluginName];
  if (!loader) {
    console.warn(`[pageel] Plugin "${pluginName}" not in registry. Install it first.`);
    return null;
  }

  const Component = lazy(async () => {
    const mod = await loader();
    const component = mod.default.slots[slot];
    if (!component) {
      throw new Error(`Plugin "${pluginName}" has no "${String(slot)}" slot`);
    }
    return { default: component as ComponentType<any> };
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
