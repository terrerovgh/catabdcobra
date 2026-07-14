// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Deployed under terrerov.com/catandcobra — keep this for asset + link prefixes.
  // Local: open http://localhost:4321/catandcobra/  (not bare /)
  base: '/catandcobra',
  integrations: [react()],
  i18n: {
    locales: ['en', 'es'],
    defaultLocale: 'en',
  },
  server: {
    host: true,
    open: '/catandcobra/',
  },
  vite: {
    plugins: [tailwindcss()],
    esbuild: {
      jsx: 'automatic',
      jsxImportSource: 'react',
    },
  },
});
