// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
// For VPS/Docker: replace adapter with @astrojs/node
// See docs/deployment.md for details
export default defineConfig({
  output: 'server',

  integrations: [react()],

  adapter: vercel(),

  vite: {
    plugins: [tailwindcss()],
  },
});