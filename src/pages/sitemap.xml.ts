import type { APIRoute } from 'astro';
import { ciudades, tiposVehiculo, obtenerDepartamentos } from '../lib/ciudades';
import { canonicalDe } from '../lib/seo';

// El sitemap se genera de forma estática aunque el resto del sitio use SSR.
export const prerender = true;

/** Rutas fijas del sitio. */
const RUTAS_FIJAS = [
  '/',
  '/politica-de-privacidad',
  '/widget',
  '/exenciones-pico-y-placa',
  '/multas-pico-y-placa',
  '/preguntas-frecuentes',
  '/pico-y-placa-manana',
  '/pico-y-placa-lunes',
  '/pico-y-placa-martes',
  '/pico-y-placa-miercoles',
  '/pico-y-placa-jueves',
  '/pico-y-placa-viernes',
];

export const GET: APIRoute = () => {
  const rutas = new Set<string>(RUTAS_FIJAS);

  // Página de cada ciudad y de cada tipo de vehículo
  for (const ciudad of ciudades) {
    rutas.add(`/${ciudad.slug}`);
    for (const tipo of tiposVehiculo) {
      rutas.add(`/${ciudad.slug}/${tipo}`);
    }
  }

  // Página de cada departamento
  for (const depto of obtenerDepartamentos()) {
    rutas.add(`/departamento/${depto.slug}`);
  }

  const hoy = new Date().toISOString().split('T')[0];

  const urls = [...rutas]
    .map(
      (ruta) =>
        `  <url>\n    <loc>${canonicalDe(ruta)}</loc>\n    <lastmod>${hoy}</lastmod>\n  </url>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
