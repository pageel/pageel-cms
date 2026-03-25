// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel/serverless';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'server',

  integrations: [react()],

  adapter: process.env.VERCEL ? vercel() : node({
    mode: 'standalone',
  }),

  vite: {
    plugins: [tailwindcss()],
  },
});