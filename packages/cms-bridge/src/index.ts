/**
 * @pageel/cms — Astro Integration
 *
 * Adds /cms admin route to your Astro site.
 * Auto-detects content collections and generates .pageelrc.json.
 *
 * Usage:
 *   // astro.config.mjs
 *   import pageelCms from '@pageel/cms';
 *   export default defineConfig({
 *     integrations: [pageelCms()]
 *   });
 */

import type { AstroIntegration } from 'astro';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface PageelCmsOptions {
  /** CMS backend URL (default: 'https://cms.pageel.app') */
  cmsUrl?: string;
  /** Admin route path (default: '/cms') */
  adminRoute?: string;
  /** Auto-generate .pageelrc.json from content collections (default: true) */
  autoConfig?: boolean;
  /** Content directory to scan (default: 'src/content') */
  contentDir?: string;
}

interface DetectedCollection {
  name: string;
  path: string;
}

/**
 * Scan content directory for Astro content collections
 */
function detectCollections(rootDir: string, contentDir: string): DetectedCollection[] {
  const fullPath = resolve(rootDir, contentDir);
  if (!existsSync(fullPath)) return [];

  const collections: DetectedCollection[] = [];
  try {
    const entries = readdirSync(fullPath);
    for (const entry of entries) {
      const entryPath = join(fullPath, entry);
      if (statSync(entryPath).isDirectory() && !entry.startsWith('.') && !entry.startsWith('_')) {
        collections.push({
          name: entry,
          path: `${contentDir}/${entry}`,
        });
      }
    }
  } catch {
    // Silently fail — no collections detected
  }
  return collections;
}

/**
 * Generate or sync .pageelrc.json
 */
function syncPageelConfig(rootDir: string, collections: DetectedCollection[]): void {
  const configPath = join(rootDir, '.pageelrc.json');
  let config: Record<string, any> = { version: 2, collections: [], settings: {} };

  // Merge with existing config
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      // Invalid JSON — overwrite
    }
  }

  // Add newly detected collections (don't remove existing)
  const existingNames = new Set(
    (config.collections || []).map((c: any) => c.name)
  );

  for (const coll of collections) {
    if (!existingNames.has(coll.name)) {
      config.collections = config.collections || [];
      config.collections.push({
        name: coll.name,
        postsPath: coll.path,
        imagesPath: `public/images/${coll.name}`,
        imageFileTypes: '.jpg,.jpeg,.png,.webp,.gif,.avif,.svg',
      });
    }
  }

  config.version = 2;
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export default function pageelCms(options: PageelCmsOptions = {}): AstroIntegration {
  const {
    cmsUrl = 'https://cms.pageel.app',
    adminRoute = '/cms',
    autoConfig = true,
    contentDir = 'src/content',
  } = options;

  return {
    name: '@pageel/cms',
    hooks: {
      'astro:config:setup': ({ config, injectRoute, logger }) => {
        // 4.5: Inject /cms route → redirect to CMS backend
        injectRoute({
          pattern: adminRoute,
          entrypoint: '@pageel/cms/redirect',
          prerender: true,
        });

        logger.info(`Admin route: ${adminRoute} → ${cmsUrl}`);

        // 4.3 + 4.4: Auto-detect and sync config
        if (autoConfig) {
          const rootDir = config.root?.pathname || process.cwd();
          const collections = detectCollections(rootDir, contentDir);
          if (collections.length > 0) {
            syncPageelConfig(rootDir, collections);
            logger.info(`Detected ${collections.length} collection(s): ${collections.map(c => c.name).join(', ')}`);
          }
        }
      },
    },
  };
}

// Re-export types
export type { PageelCmsOptions };
