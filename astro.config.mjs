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
  // Las páginas estáticas salen como `pagina.html` y no como `pagina/index.html`.
  // Con el formato de carpeta, Cloudflare respondía /preguntas-frecuentes con un
  // salto a /preguntas-frecuentes/ (con barra), mientras el sitemap y el canonical
  // dicen la dirección SIN barra: Google veía 27 páginas que se mandaban a otra.
  build: {
    format: 'file',
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
