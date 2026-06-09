/**
 * Utilidades centrales de SEO para todo el sitio.
 * Aquí vive la URL canónica del dominio y los ayudantes para construir
 * URLs limpias, breadcrumbs y datos estructurados (JSON-LD).
 */

/** Dominio oficial del sitio (sin barra final). */
export const SITE_URL = 'https://picoyplacahoy.co';

/** Nombre del sitio para Open Graph y datos estructurados. */
export const SITE_NAME = 'Pico y Placa Hoy Colombia';

/** Imagen por defecto para compartir en redes (Open Graph / Twitter Card). */
export const OG_IMAGEN_DEFECTO = '/og-default.png';

/**
 * Construye una URL canónica absoluta y limpia (sin query strings)
 * a partir de la ruta de la página.
 */
export function canonicalDe(pathname: string): string {
  // Quita barras duplicadas y asegura que empiece con "/"
  const ruta = pathname.replace(/\/+$/, '') || '/';
  return new URL(ruta, SITE_URL).href;
}

/** Un eslabón del rastro de migas (breadcrumb). */
export interface Miga {
  nombre: string;
  ruta: string;
}

/**
 * Genera el JSON-LD de tipo BreadcrumbList a partir de una lista de migas.
 * Cada miga usa su ruta relativa; aquí se convierte en URL absoluta.
 */
export function breadcrumbJsonLd(migas: Miga[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: migas.map((miga, indice) => ({
      '@type': 'ListItem',
      position: indice + 1,
      name: miga.nombre,
      item: canonicalDe(miga.ruta),
    })),
  };
}
