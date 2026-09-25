/**
 * Valor en pesos de la multa por Pico y Placa (infracción C.14), año por año.
 *
 * Los datos viven en `src/data/multas.json` y se copian de la tabla oficial de
 * autoliquidación que la Secretaría Distrital de Movilidad de Bogotá publica
 * cada enero. Todo el sitio (página de multas, páginas de ciudad, preguntas
 * frecuentes) le pide el valor a este archivo, para que ninguna página pueda
 * quedar diciendo una cifra distinta.
 *
 * CADA ENERO: agregar el año nuevo en multas.json. La variación frente al año
 * anterior (sube o baja), los descuentos y la tabla por tipo se calculan solos.
 * `npm run auditar` avisa si falta el año o si una cifra no cuadra.
 */
import datos from '../data/multas.json';
import { fechaColombia } from './calcular';

export interface AnioMulta {
  anio: number;
  /** UVT hasta 2023; UVB desde 2024 (artículo 313 de la Ley 2294 de 2023) */
  unidad: 'UVT' | 'UVB';
  /** Valor en pesos de una unidad ese año */
  valor_unidad: number;
  /** Cuántas unidades vale la multa tipo C, la del Pico y Placa */
  cantidad_unidades: number;
  /** Multa en pesos aproximada a la centena, copiada de la tabla oficial */
  multa: number;
  norma_valor_unidad: string;
  url_norma?: string;
  fuente: string;
  url_fuente: string;
}

export interface MultaDelAnio extends AnioMulta {
  /** Lo que se paga con curso dentro de los 5 días hábiles (50 %) */
  conCurso5Dias: number;
  /** Lo que se paga con curso del día 6 al 20 hábil (75 %) */
  conCurso20Dias: number;
  /** El año anterior cargado, para comparar; null en el primero */
  anterior: AnioMulta | null;
  /** Cambio frente al año anterior, como fracción (0.048 = sube 4,8 %) */
  variacion: number | null;
}

export interface MultaVigente extends MultaDelAnio {
  /** El año por el que se preguntó (el de hoy en Colombia, o el de ?fecha=) */
  anioConsultado: number;
  /** true si ese año todavía no está cargado y se muestra el anterior */
  desactualizada: boolean;
}

export type TipoInfraccion = 'A' | 'B' | 'C' | 'D';

// Se fuerza el tipo porque TypeScript lee "unidad" del JSON como un texto
// cualquiera, no como 'UVT' | 'UVB'. `npm run auditar` revisa los valores.
const anios = ([...datos.anios] as AnioMulta[]).sort((a, b) => a.anio - b.anio);

/** Unidades (UVB) de cada tipo de infracción, de la tabla oficial de Bogotá */
export const cantidadUvbPorTipo = datos.cantidad_uvb_por_tipo as Record<TipoInfraccion, number>;

/**
 * La conversión de la Circular Externa 20244000000077 de 2024 de MinTransporte
 * para la tipo C. Bogotá y los decretos de 2026 usan 52,29: por eso algunas
 * fuentes publican unos $100 menos. Solo se usa para explicarlo en pantalla.
 */
export const cantidadUvbCircular: number = datos.cantidad_uvb_c_segun_circular_mintransporte;

export const fechaActualizacionMultas: string = datos.fecha_ultima_actualizacion;

/**
 * Lo que cuesta la inmovilización en Bogotá: grúa + primer día de patios. Es un
 * EJEMPLO (cada ciudad fija sus tarifas) y cambia cada enero, como la multa.
 */
export interface InmovilizacionEjemplo {
  anio: number;
  grua: { carro: number; moto: number };
  patio_primer_dia: { carro: number; moto: number };
  nota: string;
  fuente: string;
  url_fuente: string;
}
export const inmovilizacionBogota: InmovilizacionEjemplo = datos.inmovilizacion_bogota;

/** Unidades × valor de la unidad, aproximado a la centena como en la tabla oficial */
export function aproximarACentena(valor: number): number {
  return Math.round(valor / 100) * 100;
}

/** La multa que sale de la cuenta. Debe coincidir con la copiada de la tabla. */
export function multaCalculada(a: AnioMulta): number {
  return aproximarACentena(a.cantidad_unidades * a.valor_unidad);
}

/** Todos los años cargados, del más viejo al más nuevo, con su variación */
export const historialMulta: MultaDelAnio[] = anios.map((a, i) => {
  const anterior = i > 0 ? anios[i - 1] : null;
  return {
    ...a,
    conCurso5Dias: a.multa * 0.5,
    conCurso20Dias: a.multa * 0.75,
    anterior,
    variacion: anterior ? a.multa / anterior.multa - 1 : null,
  };
});

/**
 * La multa del año de `fecha` (por defecto, hoy en Colombia). Si ese año aún no
 * está cargado, devuelve el último que sí lo está y lo marca como
 * desactualizado, para que la página lo diga en vez de fingir que es el vigente.
 */
export function multaVigente(fecha: Date = fechaColombia()): MultaVigente {
  // Una fecha inválida (un ?fecha= mal escrito) cuenta como hoy
  const anioConsultado = Number.isNaN(fecha.getTime()) ? fechaColombia().getFullYear() : fecha.getFullYear();
  const cargados = historialMulta.filter((m) => m.anio <= anioConsultado);
  const multa = cargados.at(-1) ?? historialMulta[0];
  return { ...multa, anioConsultado, desactualizada: multa.anio < anioConsultado };
}

/** Valor en pesos de cada tipo de infracción (A-D) con la UVB de ese año */
export function valoresPorTipo(m: AnioMulta): Record<TipoInfraccion, number> {
  const valor = (tipo: TipoInfraccion) => aproximarACentena(cantidadUvbPorTipo[tipo] * m.valor_unidad);
  return { A: valor('A'), B: valor('B'), C: valor('C'), D: valor('D') };
}

/**
 * Las sanciones de las ciudades que son multa tipo C: la del Pico y Placa.
 * Es la escala del artículo 131 de la Ley 769 de 2002 (15 SMLDV).
 */
export function esMultaTipoC(valorSmldv: string | undefined): boolean {
  return valorSmldv === '15 SMLDV';
}

/** "$633.200". Se arma a mano para no depender del idioma del servidor. */
export function formatearPesos(valor: number): string {
  return '$' + Math.round(valor).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** "52,29" */
export function formatearUnidades(cantidad: number): string {
  return cantidad.toFixed(2).replace('.', ',');
}

export interface Variacion {
  sentido: 'sube' | 'baja' | 'igual';
  /** Flecha para pantalla; los lectores de pantalla leen `sentido` */
  flecha: '▲' | '▼' | '=';
  /** "4,8 %" (siempre positivo: la flecha dice hacia dónde) */
  porcentaje: string;
}

export function describirVariacion(variacion: number): Variacion {
  const porcentaje = (Math.abs(variacion) * 100).toFixed(1).replace('.', ',') + ' %';
  if (porcentaje === '0,0 %') return { sentido: 'igual', flecha: '=', porcentaje: '0 %' };
  return variacion > 0
    ? { sentido: 'sube', flecha: '▲', porcentaje }
    : { sentido: 'baja', flecha: '▼', porcentaje };
}

/** "Subió 4,8 % frente a 2025" / "Bajó…" / "Igual que en 2025" */
export function fraseVariacion(m: MultaDelAnio): string | null {
  if (m.variacion === null || !m.anterior) return null;
  const v = describirVariacion(m.variacion);
  if (v.sentido === 'igual') return `Igual que en ${m.anterior.anio}`;
  return `${v.sentido === 'sube' ? 'Subió' : 'Bajó'} ${v.porcentaje} frente a ${m.anterior.anio}`;
}
