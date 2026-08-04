/**
 * Resumen del Pico y Placa de una ciudad en una fecha, pensado para la portada.
 *
 * Sirve para responder "¿qué placas no circulan hoy?" sin que el usuario tenga
 * que entrar ciudad por ciudad. Los datos NO se recalculan aquí: se le piden a
 * `calcularPicoPlaca()`, el mismo motor que pinta las páginas de detalle, para
 * que la portada y el detalle no puedan discrepar.
 */
import { calcularPicoPlaca } from './calcular';
import { tiposVehiculo } from './ciudades';
import type { Ciudad, CriterioPlaca, TipoVehiculo } from './tipos';

/** Etiquetas cortas: en la portada no cabe "Transporte de Carga" */
export const ETIQUETA_CORTA: Record<TipoVehiculo, string> = {
  particulares: 'Carros',
  motos: 'Motos',
  taxis: 'Taxis',
  transporte_carga: 'Carga',
};

/**
 * Criterio de placa abreviado. Hace falta porque hay ciudades (Medellín) donde
 * los carros se miran por el último dígito y las motos por el primero: callarlo
 * en la portada haría que un motociclista consultara el dígito equivocado.
 */
export const CRITERIO_CORTO: Record<CriterioPlaca, string> = {
  ultimo_digito: 'último díg.',
  primer_digito: 'primer díg.',
};

/** Estado de un tipo de vehículo, ya resuelto para una fecha concreta */
export interface EstadoTipoHoy {
  tipo: TipoVehiculo;
  aplica: boolean;
  pendiente: boolean;
  desactualizado: boolean;
  digitos: number[];
  criterio?: CriterioPlaca;
  horario: string;
}

/** Estado completo de una ciudad para una fecha */
export interface ResumenCiudadHoy {
  slug: string;
  nombre: string;
  tipos: Record<TipoVehiculo, EstadoTipoHoy>;
  /** Al menos un tipo de vehículo tiene restricción ese día */
  algunoAplica: boolean;
  /** La ciudad no tiene Pico y Placa en absoluto */
  sinPicoYPlaca: boolean;
}

/** Calcula el estado de los 4 tipos de vehículo de una ciudad en una fecha */
export function resumirCiudad(ciudad: Ciudad, fecha: Date): ResumenCiudadHoy {
  // `as` explícito: el objeto se llena justo debajo con los 4 tipos, pero
  // TypeScript no puede saber que el bucle los cubre todos.
  const tipos = {} as Record<TipoVehiculo, EstadoTipoHoy>;

  for (const tipo of tiposVehiculo) {
    const resultado = calcularPicoPlaca(ciudad, tipo, fecha);
    tipos[tipo] = {
      tipo,
      aplica: resultado.aplica,
      pendiente: resultado.esPendiente,
      desactualizado: resultado.datosDesactualizados,
      digitos: resultado.placasRestringidas,
      criterio: resultado.criterioPlaca,
      horario: resultado.horarioTexto,
    };
  }

  return {
    slug: ciudad.slug,
    nombre: ciudad.nombre,
    tipos,
    algunoAplica: tiposVehiculo.some((t) => tipos[t].aplica),
    sinPicoYPlaca: ciudad.decreto_actual === 'No aplica',
  };
}

/** Resume varias ciudades de una sola pasada */
export function resumirCiudades(lista: Ciudad[], fecha: Date): ResumenCiudadHoy[] {
  return lista.map((ciudad) => resumirCiudad(ciudad, fecha));
}

/**
 * Dígitos en formato compacto para las insignias de la portada: "4", "1·4".
 * Cuando la restricción cubre los 10 dígitos no se enumeran, no caben.
 */
export function digitosCompactos(digitos: number[]): string {
  if (digitos.length >= 10) return 'TODAS';
  return digitos.join('·');
}

/** Cómo pintar la respuesta de una ciudad en la portada */
export type EstadoInsignia = 'aplica' | 'libre' | 'pendiente' | 'desactualizado' | 'sin_pyp';

export interface InsigniaHoy {
  estado: EstadoInsignia;
  /** Texto principal: los dígitos, o "Libre", "Sin P&P", "?" */
  texto: string;
  /**
   * Tipo de vehículo al que corresponden los dígitos, SOLO cuando no son los
   * de particulares (ej. Manizales, donde únicamente los taxis tienen turno).
   * Si va vacío, la insignia habla de carros particulares.
   */
  etiqueta?: string;
}

/**
 * Reduce el resumen de una ciudad a la única línea que cabe en la portada.
 *
 * Habla de **particulares**, que es lo que busca casi todo el mundo. Solo
 * cambia de tipo de vehículo cuando los particulares no tienen restricción
 * pero otro tipo sí, y en ese caso lo dice explícitamente para no confundir.
 */
export function insigniaDe(resumen: ResumenCiudadHoy): InsigniaHoy {
  const particulares = resumen.tipos.particulares;

  if (resumen.sinPicoYPlaca) {
    return { estado: 'sin_pyp', texto: 'Sin P&P' };
  }

  if (particulares.desactualizado) {
    return { estado: 'desactualizado', texto: 'Verificar' };
  }

  if (particulares.aplica && particulares.digitos.length > 0) {
    return { estado: 'aplica', texto: digitosCompactos(particulares.digitos) };
  }

  // Los particulares están libres, pero puede que otro tipo de vehículo no.
  const otro = tiposVehiculo
    .filter((t) => t !== 'particulares')
    .map((t) => resumen.tipos[t])
    .find((t) => t.aplica && t.digitos.length > 0);

  if (otro) {
    return {
      estado: 'aplica',
      texto: digitosCompactos(otro.digitos),
      etiqueta: ETIQUETA_CORTA[otro.tipo],
    };
  }

  if (particulares.pendiente) {
    return { estado: 'pendiente', texto: '?' };
  }

  return { estado: 'libre', texto: 'Libre' };
}
