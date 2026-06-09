import type { Ciudad, TipoVehiculo } from './tipos';

// Importar todas las ciudades
import medellin from '../data/ciudades/medellin.json';
import bogota from '../data/ciudades/bogota.json';
import cali from '../data/ciudades/cali.json';
import barranquilla from '../data/ciudades/barranquilla.json';
import bucaramanga from '../data/ciudades/bucaramanga.json';
import cartagena from '../data/ciudades/cartagena.json';
import bello from '../data/ciudades/bello.json';
import envigado from '../data/ciudades/envigado.json';
import itagui from '../data/ciudades/itagui.json';
import sabaneta from '../data/ciudades/sabaneta.json';
import laEstrella from '../data/ciudades/la-estrella.json';
import caldas from '../data/ciudades/caldas.json';
import copacabana from '../data/ciudades/copacabana.json';
import girardota from '../data/ciudades/girardota.json';
import barbosa from '../data/ciudades/barbosa.json';
import cucuta from '../data/ciudades/cucuta.json';
import ibague from '../data/ciudades/ibague.json';
import villavicencio from '../data/ciudades/villavicencio.json';
import pasto from '../data/ciudades/pasto.json';
import manizales from '../data/ciudades/manizales.json';
import pereira from '../data/ciudades/pereira.json';
import armenia from '../data/ciudades/armenia.json';
import santaMarta from '../data/ciudades/santa-marta.json';
import popayan from '../data/ciudades/popayan.json';
import tunja from '../data/ciudades/tunja.json';
import soacha from '../data/ciudades/soacha.json';
import palmira from '../data/ciudades/palmira.json';
import dosquebradas from '../data/ciudades/dosquebradas.json';
import rionegro from '../data/ciudades/rionegro.json';
import fusagasuga from '../data/ciudades/fusagasuga.json';
import buenaventura from '../data/ciudades/buenaventura.json';
import ipiales from '../data/ciudades/ipiales.json';
import ocana from '../data/ciudades/ocana.json';
import pamplona from '../data/ciudades/pamplona.json';
import quibdo from '../data/ciudades/quibdo.json';
import santaCruzDeLorica from '../data/ciudades/santa-cruz-de-lorica.json';
import malambo from '../data/ciudades/malambo.json';
import soledad from '../data/ciudades/soledad.json';
import turbaco from '../data/ciudades/turbaco.json';

/** Todas las ciudades disponibles, ordenadas alfabéticamente */
export const ciudades: Ciudad[] = ([
  medellin, bogota, cali, barranquilla, bucaramanga, cartagena,
  bello, envigado, itagui, sabaneta, laEstrella, caldas, copacabana, girardota, barbosa,
  cucuta, ibague, villavicencio, pasto, manizales, pereira, armenia,
  santaMarta, popayan, tunja, soacha, palmira, dosquebradas, rionegro,
  fusagasuga, buenaventura, ipiales, ocana, pamplona, quibdo,
  santaCruzDeLorica, malambo, soledad, turbaco,
] as Ciudad[]).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

/** Buscar ciudad por slug */
export function obtenerCiudad(slug: string): Ciudad | undefined {
  return ciudades.find((c) => c.slug === slug);
}

/** Lista de slugs válidos */
export function obtenerSlugs(): string[] {
  return ciudades.map((c) => c.slug);
}

/** Los 4 tipos de vehículo del MVP */
export const tiposVehiculo: TipoVehiculo[] = [
  'particulares',
  'motos',
  'taxis',
  'transporte_carga',
];

/** Convierte un texto a un slug amigable para URL (sin tildes ni espacios) */
export function aSlug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Un departamento con la lista de ciudades que tenemos en él */
export interface Departamento {
  nombre: string;
  slug: string;
  ciudades: Ciudad[];
}

/** Agrupa todas las ciudades por departamento, ordenado alfabéticamente */
export function obtenerDepartamentos(): Departamento[] {
  const mapa = new Map<string, Ciudad[]>();
  for (const ciudad of ciudades) {
    const lista = mapa.get(ciudad.departamento) ?? [];
    lista.push(ciudad);
    mapa.set(ciudad.departamento, lista);
  }
  return [...mapa.entries()]
    .map(([nombre, lista]) => ({ nombre, slug: aSlug(nombre), ciudades: lista }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Buscar un departamento por su slug */
export function obtenerDepartamento(slug: string): Departamento | undefined {
  return obtenerDepartamentos().find((d) => d.slug === slug);
}

/** Indica si una ciudad tiene datos de Pico y Placa disponibles */
export function tieneDatos(ciudad: Ciudad): boolean {
  return (
    ciudad.decreto_actual !== 'pendiente_verificar' &&
    ciudad.decreto_actual !== 'No aplica'
  );
}
