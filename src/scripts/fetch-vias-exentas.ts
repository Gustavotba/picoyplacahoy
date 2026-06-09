/**
 * Script para descargar geometrías reales de vías exentas desde OpenStreetMap.
 * Usa la API Overpass con área de Medellín (relación 260700) para precisión.
 *
 * Ejecutar manualmente: npm run fetch-vias
 * Genera: src/data/ciudades/medellin.geo.json
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Bounding box del Valle de Aburrá para la query principal
const BBOX = '6.15,-75.65,6.35,-75.50';

// Medellín: latitud razonable para el casco urbano (filtro post-proceso)
const MEDELLIN_LAT_MIN = 6.17;
const MEDELLIN_LAT_MAX = 6.32;
const MEDELLIN_LON_MIN = -75.63;
const MEDELLIN_LON_MAX = -75.52;

// Query Overpass: una sola request con filtros estrictos por tipo de vía
const QUERY = `
[out:json][timeout:90][bbox:${BBOX}];
(
  way["name"~"Autopista Sur"]["highway"~"trunk|primary|motorway"];
  way["name"~"Avenida Regional|Regional"]["highway"~"trunk|primary|secondary"];
  way["name"~"Las Palmas"]["highway"~"trunk|primary|secondary"];
  way["name"~"^Calle 33$|^Avenida 33$"]["highway"~"primary|secondary|tertiary"];
  way["name"~"^Calle 10$"]["highway"~"primary|secondary|tertiary"];
  way["name"~"Iguaná"]["highway"];
);
out geom;
`;

// Clasificación de cada way en su vía exenta
const CLASIFICACIONES: Array<{
  nombre: string;
  patron: RegExp;
  // Bounding box específico para filtrar segmentos fuera de zona
  bbox?: { latMin: number; latMax: number; lonMin: number; lonMax: number };
}> = [
  {
    nombre: 'Autopista Sur',
    patron: /autopista sur/i,
  },
  {
    nombre: 'Avenida Regional',
    patron: /regional/i,
  },
  {
    nombre: 'Avenida Las Palmas',
    patron: /las palmas/i,
    // Las Palmas va del centro hacia el oriente, permitir longitud más amplia
    bbox: { latMin: 6.15, latMax: 6.26, lonMin: -75.60, lonMax: -75.44 },
  },
  {
    nombre: 'Avenida 33',
    patron: /calle 33|avenida 33/i,
    // Solo la Avenida 33 en el centro de Medellín
    bbox: { latMin: 6.22, latMax: 6.26, lonMin: -75.60, lonMax: -75.55 },
  },
  {
    nombre: 'Calle 10',
    patron: /^calle 10$/i,
    // Solo la Calle 10 en el sur-centro de Medellín
    bbox: { latMin: 6.19, latMax: 6.23, lonMin: -75.60, lonMax: -75.55 },
  },
  {
    nombre: 'Laterales Quebrada La Iguaná',
    patron: /iguan/i,
  },
];

interface OverpassElement {
  type: string;
  id: number;
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
}

interface GeoJSONFeature {
  type: 'Feature';
  properties: { name: string; segments: number };
  geometry: {
    type: 'MultiLineString';
    coordinates: number[][][];
  };
}

interface GeoJSONCollection {
  type: 'FeatureCollection';
  metadata: { generado: string; fuente: string; ciudad: string };
  features: GeoJSONFeature[];
}

/** Verifica si un segmento tiene su punto medio dentro de un bounding box */
function segmentoDentroDeBbox(
  coords: number[][],
  bbox: { latMin: number; latMax: number; lonMin: number; lonMax: number },
): boolean {
  // Usar el punto medio del segmento para verificar
  const midIdx = Math.floor(coords.length / 2);
  const [lon, lat] = coords[midIdx];
  return lat >= bbox.latMin && lat <= bbox.latMax && lon >= bbox.lonMin && lon <= bbox.lonMax;
}

function clasificarElemento(el: OverpassElement): string | null {
  const nombre = el.tags?.name ?? '';
  for (const c of CLASIFICACIONES) {
    if (c.patron.test(nombre)) return c.nombre;
  }
  return null;
}

async function main() {
  console.log('🗺️  Descargando geometrías de vías exentas de Medellín...\n');

  const respuesta = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(QUERY)}`,
  });

  if (!respuesta.ok) {
    console.log(`⚠️  Overpass principal: ${respuesta.status}. Intentando servidor alternativo...`);
    const resp2 = await fetch('https://overpass.kumi.systems/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(QUERY)}`,
    });
    if (!resp2.ok) {
      console.error(`❌ Ambos servidores fallaron. Último: ${resp2.status}`);
      process.exit(1);
    }
    return procesarRespuesta(resp2);
  }
  return procesarRespuesta(respuesta);
}

async function procesarRespuesta(respuesta: Response) {
  const datos = await respuesta.json() as { elements: OverpassElement[] };
  console.log(`   Recibidos ${datos.elements.length} elementos de OSM\n`);

  // Agrupar por clasificación
  const agrupados = new Map<string, OverpassElement[]>();

  for (const el of datos.elements) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    const clase = clasificarElemento(el);
    if (clase) {
      if (!agrupados.has(clase)) agrupados.set(clase, []);
      agrupados.get(clase)!.push(el);
    }
  }

  // Generar features GeoJSON con filtrado por bbox
  const features: GeoJSONFeature[] = [];
  const noEncontradas: string[] = [];
  const defaultBbox = {
    latMin: MEDELLIN_LAT_MIN,
    latMax: MEDELLIN_LAT_MAX,
    lonMin: MEDELLIN_LON_MIN,
    lonMax: MEDELLIN_LON_MAX,
  };

  for (const c of CLASIFICACIONES) {
    const elementos = agrupados.get(c.nombre);
    if (!elementos || elementos.length === 0) {
      console.log(`  ⚠️  ${c.nombre}: no encontrada`);
      noEncontradas.push(c.nombre);
      continue;
    }

    const bbox = c.bbox ?? defaultBbox;
    const todasLineas = elementos.map((e) => e.geometry!.map((p) => [p.lon, p.lat]));
    const lineasFiltradas = todasLineas.filter((coords) => segmentoDentroDeBbox(coords, bbox));

    if (lineasFiltradas.length === 0) {
      console.log(`  ⚠️  ${c.nombre}: ${todasLineas.length} segmentos encontrados pero todos fuera de zona`);
      noEncontradas.push(c.nombre);
      continue;
    }

    features.push({
      type: 'Feature',
      properties: { name: c.nombre, segments: lineasFiltradas.length },
      geometry: { type: 'MultiLineString', coordinates: lineasFiltradas },
    });

    const descartados = todasLineas.length - lineasFiltradas.length;
    const extra = descartados > 0 ? ` (${descartados} fuera de zona descartados)` : '';
    console.log(`  ✅ ${c.nombre}: ${lineasFiltradas.length} segmento(s)${extra}`);
  }

  const geojson: GeoJSONCollection = {
    type: 'FeatureCollection',
    metadata: {
      generado: new Date().toISOString(),
      fuente: 'OpenStreetMap Overpass API',
      ciudad: 'medellin',
    },
    features,
  };

  const ruta = resolve('src/data/ciudades/medellin.geo.json');
  writeFileSync(ruta, JSON.stringify(geojson, null, 2), 'utf-8');
  const tamano = (JSON.stringify(geojson).length / 1024).toFixed(1);

  console.log(`\n✅ Guardado en ${ruta} (${tamano} KB)`);
  console.log(`   ${features.length} vías con geometría de ${CLASIFICACIONES.length} buscadas`);

  if (noEncontradas.length > 0) {
    console.log(`\n⚠️  Vías NO encontradas (${noEncontradas.length}):`);
    for (const v of noEncontradas) console.log(`   - ${v}`);
  }
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
