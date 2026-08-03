/**
 * Descarga las geometrías reales de las vías exentas de Medellín desde OpenStreetMap.
 *
 * Ejecutar manualmente: npm run fetch-vias
 * Genera: src/data/ciudades/medellin.geo.json
 *
 * Cuidados aprendidos (ver LECCIONES.md):
 *  - Overpass responde 406 si no se manda User-Agent, y 504 cuando está saturado:
 *    por eso se prueban varios servidores.
 *  - Solo se piden vías por las que puede circular un carro. Si no se filtra el tipo,
 *    entran ciclorrutas y cruces peatonales, y el mapa termina mostrándole al conductor
 *    una ciclovía como si fuera vía exenta.
 *  - Cada vía se valida contra una longitud mínima esperada. Un tramo suelto de 200 m
 *    en vez de un corredor de varios kilómetros es la señal de que la consulta falló.
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';

const SERVIDORES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
];

const USER_AGENT = 'picoyplacahoy.co (mapa de vias exentas de pico y placa)';

/** Tipos de vía por los que circula un carro. Excluye cycleway, footway, path y service. */
const TIPOS_VEHICULARES = 'motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link|secondary_link';

const BBOX_CONSULTA = '6.15,-75.68,6.40,-75.44';

const QUERY = `
[out:json][timeout:120][bbox:${BBOX_CONSULTA}];
(
  way["name"~"Autopista Sur",i]["highway"~"${TIPOS_VEHICULARES}"];
  way["name"~"Avenida Regional",i]["highway"~"${TIPOS_VEHICULARES}"];
  way["name"~"Las Palmas",i]["highway"~"${TIPOS_VEHICULARES}"];
  way["name"~"^(Calle 33|Avenida 33|Calle 37)$",i]["highway"~"${TIPOS_VEHICULARES}"];
  way["name"~"^Calle 10$",i]["highway"~"${TIPOS_VEHICULARES}"];
  way["name"~"Iguan",i]["highway"~"${TIPOS_VEHICULARES}"];
  way["name"~"Guillermo Gaviria Correa|T[úu]nel de Occidente",i]["highway"~"${TIPOS_VEHICULARES}"];
);
out geom;
`;

/** Recuadro del casco urbano de Medellín, usado cuando la vía no define el suyo */
const BBOX_MEDELLIN = { latMin: 6.17, latMax: 6.34, lonMin: -75.66, lonMax: -75.52 };

interface Via {
  nombre: string;
  patron: RegExp;
  bbox?: { latMin: number; latMax: number; lonMin: number; lonMax: number };
  /** Longitud mínima esperada en km. Si sale menos, la consulta falló. */
  kmMinimo: number;
}

const VIAS: Via[] = [
  {
    // El decreto las agrupa como un solo corredor: es la vía exenta principal,
    // recorre la ciudad de norte a sur por la orilla del río.
    nombre: 'Sistema Vial del Río (Autopista Sur y Avenida Regional)',
    patron: /^(autopista sur|avenida regional)/i,
    kmMinimo: 8,
  },
  {
    nombre: 'Avenida Las Palmas',
    patron: /las palmas/i,
    // El decreto la exenta hasta los límites con Envigado. Sin este tope entran
    // los tramos que siguen hacia Rionegro y el mapa se aleja tanto que Medellín
    // deja de verse. Se corta en la latitud del límite con Envigado: es preferible
    // dibujar de menos que insinuar que un tramo restringido está exento.
    bbox: { latMin: 6.17, latMax: 6.26, lonMin: -75.60, lonMax: -75.50 },
    kmMinimo: 4,
  },
  {
    nombre: 'Avenida 33 (Calle 37)',
    patron: /^(calle 33|avenida 33|calle 37)$/i,
    bbox: { latMin: 6.22, latMax: 6.26, lonMin: -75.60, lonMax: -75.55 },
    kmMinimo: 2,
  },
  {
    nombre: 'Calle 10',
    patron: /^calle 10$/i,
    bbox: { latMin: 6.19, latMax: 6.23, lonMin: -75.60, lonMax: -75.55 },
    kmMinimo: 2,
  },
  {
    nombre: 'Corredor vial de La Iguaná',
    patron: /iguan/i,
    bbox: { latMin: 6.24, latMax: 6.30, lonMin: -75.62, lonMax: -75.56 },
    kmMinimo: 1,
  },
  {
    nombre: 'Conexión Vial Guillermo Gaviria Correa (Túnel de Occidente)',
    patron: /guillermo gaviria correa|t[úu]nel de occidente/i,
    // El decreto la exenta solo hasta el km 4.1. Sin este tope se dibuja toda la
    // Vía al Mar hacia el occidente antioqueño, que NO está exenta.
    bbox: { latMin: 6.26, latMax: 6.31, lonMin: -75.64, lonMax: -75.58 },
    kmMinimo: 1,
  },
];

interface ElementoOverpass {
  type: string;
  id: number;
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
}

interface Feature {
  type: 'Feature';
  properties: { name: string; segments: number; km: number };
  geometry: { type: 'MultiLineString'; coordinates: number[][][] };
}

/** Longitud aproximada de una polilínea en kilómetros */
function longitudKm(lineas: number[][][]): number {
  let km = 0;
  for (const linea of lineas) {
    for (let i = 1; i < linea.length; i++) {
      const [x1, y1] = linea[i - 1];
      const [x2, y2] = linea[i];
      const dx = (x2 - x1) * 111.32 * Math.cos((y1 * Math.PI) / 180);
      const dy = (y2 - y1) * 110.57;
      km += Math.hypot(dx, dy);
    }
  }
  return km;
}

/** Un segmento cuenta si su punto medio cae dentro del recuadro */
function dentroDeBbox(coords: number[][], bbox: NonNullable<Via['bbox']>): boolean {
  const [lon, lat] = coords[Math.floor(coords.length / 2)];
  return lat >= bbox.latMin && lat <= bbox.latMax && lon >= bbox.lonMin && lon <= bbox.lonMax;
}

async function consultarOverpass(): Promise<ElementoOverpass[]> {
  for (const url of SERVIDORES) {
    try {
      const respuesta = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        body: `data=${encodeURIComponent(QUERY)}`,
      });
      if (!respuesta.ok) {
        console.log(`  ⚠️  ${new URL(url).hostname}: HTTP ${respuesta.status}`);
        continue;
      }
      const datos = (await respuesta.json()) as { elements: ElementoOverpass[] };
      console.log(`  ✅ ${new URL(url).hostname}: ${datos.elements.length} elementos\n`);
      return datos.elements;
    } catch (error) {
      console.log(`  ⚠️  ${new URL(url).hostname}: ${(error as Error).message}`);
    }
  }
  throw new Error('Ningún servidor de Overpass respondió');
}

async function main() {
  console.log('🗺️  Descargando vías exentas de Medellín desde OpenStreetMap\n');
  const elementos = await consultarOverpass();

  const agrupados = new Map<string, number[][][]>();
  for (const el of elementos) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    const nombre = el.tags?.name ?? '';
    const via = VIAS.find((v) => v.patron.test(nombre));
    if (!via) continue;
    if (!agrupados.has(via.nombre)) agrupados.set(via.nombre, []);
    agrupados.get(via.nombre)!.push(el.geometry.map((p) => [p.lon, p.lat]));
  }

  const features: Feature[] = [];
  const problemas: string[] = [];

  for (const via of VIAS) {
    const todas = agrupados.get(via.nombre) ?? [];
    if (todas.length === 0) {
      console.log(`  ❌ ${via.nombre}: no se encontró en OSM`);
      problemas.push(`${via.nombre}: no se encontró`);
      continue;
    }

    const bbox = via.bbox ?? BBOX_MEDELLIN;
    const dentro = todas.filter((c) => dentroDeBbox(c, bbox));
    const km = longitudKm(dentro);
    const descartados = todas.length - dentro.length;
    const nota = descartados > 0 ? ` · ${descartados} tramos fuera de zona descartados` : '';

    if (dentro.length === 0) {
      console.log(`  ❌ ${via.nombre}: ${todas.length} tramos, todos fuera de zona`);
      problemas.push(`${via.nombre}: todos los tramos quedaron fuera de zona`);
      continue;
    }

    if (km < via.kmMinimo) {
      console.log(`  ⚠️  ${via.nombre}: solo ${km.toFixed(1)} km (se esperaban ${via.kmMinimo}+)${nota}`);
      problemas.push(`${via.nombre}: ${km.toFixed(1)} km, por debajo del mínimo de ${via.kmMinimo} km`);
    } else {
      console.log(`  ✅ ${via.nombre}: ${dentro.length} tramos · ${km.toFixed(1)} km${nota}`);
    }

    features.push({
      type: 'Feature',
      properties: { name: via.nombre, segments: dentro.length, km: Number(km.toFixed(1)) },
      geometry: { type: 'MultiLineString', coordinates: dentro },
    });
  }

  const geojson = {
    type: 'FeatureCollection' as const,
    metadata: {
      generado: new Date().toISOString(),
      fuente: 'OpenStreetMap Overpass API',
      ciudad: 'medellin',
      nota: 'Corredores principales. La lista completa de vías exentas está en medellin.json.',
    },
    features,
  };

  const ruta = resolve('src/data/ciudades/medellin.geo.json');
  writeFileSync(ruta, JSON.stringify(geojson, null, 2), 'utf-8');

  const tamano = (JSON.stringify(geojson).length / 1024).toFixed(1);
  const kmTotal = features.reduce((s, f) => s + f.properties.km, 0);
  console.log(`\n✅ ${ruta} (${tamano} KB)`);
  console.log(`   ${features.length} de ${VIAS.length} vías · ${kmTotal.toFixed(1)} km en total`);

  if (problemas.length > 0) {
    console.log(`\n⚠️  Revisar antes de publicar (${problemas.length}):`);
    for (const p of problemas) console.log(`   - ${p}`);
    console.log('\n   Un mapa incompleto puede hacerle creer al usuario que una vía');
    console.log('   exenta no lo es. Verifica contra la lista de medellin.json.');
  }
}

main().catch((error) => {
  console.error('Error fatal:', error);
  process.exit(1);
});
