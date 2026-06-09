// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://picoyplacahoy.co',
  // Adaptador para desplegar en Cloudflare Pages.
  // Las páginas con prerender=true se generan estáticas; las que necesitan
  // conocer "hoy" (prerender=false) se ejecutan bajo demanda en Cloudflare.
  adapter: cloudflare(),
  vite: {
    plugins: [tailwindcss()]
  }
});
