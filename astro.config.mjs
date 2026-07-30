// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://astro.build/config
// For VPS/Docker: replace adapter with @astrojs/node
// See docs/deployment.md for details
export default defineConfig({
  output: 'server',

  integrations: [react()],

  adapter: vercel(),

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: [
        '@mdxeditor/editor',
        '@mdxeditor/editor > react',
        '@mdxeditor/editor > react-dom',
        '@mdxeditor/editor > react/jsx-runtime',
        'react',
        'react-dom',
        'react/jsx-runtime',
      ],
    },
    resolve: {
      dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
      alias: {
        '@pageel/plugin-types': path.resolve(__dirname, './packages/plugin-types/src/index.ts'),
        '@pageel/plugin-mdx': path.resolve(__dirname, './packages/plugin-mdx/src/index.ts'),
        '@pageel/cms': path.resolve(__dirname, './packages/cms-bridge/src/index.ts'),
      },
    },
    server: {
      fs: {
        allow: [__dirname, path.resolve(__dirname, 'packages')],
      },
    },
  },
});