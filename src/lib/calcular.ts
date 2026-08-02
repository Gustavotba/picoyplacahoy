import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { esFestivo } from './festivos';
import type { Ciudad, TipoVehiculo, DiaSemana, ResultadoPicoPlaca } from './tipos';
import { esPlaceholder, esSemanalPorDia, esQuincenalPorFecha } from './tipos';

/** Mapa de número de día (0=dom) a DiaSemana */
const DIAS_SEMANA: DiaSemana[] = [
  'domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado',
];

/** Nombres legibles de los días */
export const DIAS_LEGIBLES: Record<string, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

/** Nombres legibles para criterio de placa */
export const CRITERIO_LEGIBLE: Record<string, string> = {
  ultimo_digito: 'último dígito',
  primer_digito: 'primer dígito',
};

/**
 * Obtiene la fecha actual en zona horaria de Colombia.
 * Útil porque el servidor puede estar en otra zona horaria.
 */
export function fechaColombia(): Date {
  const ahora = new Date();
  const opciones = ahora.toLocaleString('en-US', { timeZone: 'America/Bogota' });
  return new Date(opciones);
}

/** Formatea una fecha al estilo colombiano: "lunes 12 de abril de 2026" */
export function formatearFechaColombia(fecha: Date): string {
  return format(fecha, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
}

/** Formatea una fecha como ISO: "2026-04-12" */
export function formatearISO(fecha: Date): string {
  return format(fecha, 'yyyy-MM-dd');
}

/** Verifica si una fecha está dentro del rango de vigencia de la ciudad */
function dentroDeVigencia(ciudad: Ciudad, fecha: Date): boolean {
  if (!ciudad.vigencia_desde || !ciudad.vigencia_hasta) return true;
  const fechaISO = formatearISO(fecha);
  return fechaISO >= ciudad.vigencia_desde && fechaISO <= ciudad.vigencia_hasta;
}

/** Verifica si una fecha es fin de semana */
function esFinDeSemana(fecha: Date): boolean {
  const dia = fecha.getDay();
  return dia === 0 || dia === 6;
}

/**
 * Motor principal: calcula si aplica pico y placa para un tipo de vehículo
 * en una ciudad y fecha dada.
 */
export function calcularPicoPlaca(
  ciudad: Ciudad,
  tipo: TipoVehiculo,
  fecha: Date,
): ResultadoPicoPlaca {
  const vehiculo = ciudad.vehiculos[tipo];

  // Vehículo sin restricción (formato nuevo, aplica: false sin restricciones)
  if (!vehiculo.aplica && !('restricciones' in vehiculo)) {
    const desc = 'descripcion' in vehiculo ? vehiculo.descripcion : '';
    return {
      aplica: false,
      esFestivo: false,
      esDiaHabil: false,
      esPendiente: false,
      datosDesactualizados: false,
      placasRestringidas: [],
      horarioTexto: '',
      descripcionVehiculo: desc,
      mensaje: desc || `No hay Pico y Placa para este tipo de vehículo en ${ciudad.nombre}.`,
    };
  }

  // Formato placeholder (ciudades sin datos verificados)
  if (esPlaceholder(vehiculo)) {
    const tieneDatos = Object.values(vehiculo.restricciones).some(
      (placas) => placas && placas.some((p) => p !== 'pendiente_verificar'),
    );
    if (!tieneDatos) {
      return {
        aplica: false,
        esFestivo: esFestivo(fecha),
        esDiaHabil: true,
        esPendiente: true,
        datosDesactualizados: false,
        placasRestringidas: [],
        horarioTexto: vehiculo.horario,
        mensaje: 'Datos pendientes de verificación. Consulta la fuente oficial.',
      };
    }
    // Si hay datos reales en formato viejo, procesar normalmente
    const festivo = esFestivo(fecha);
    const diaSemana = DIAS_SEMANA[fecha.getDay()];
    if (festivo && !vehiculo.aplica_festivos) {
      return {
        aplica: false, esFestivo: true, esDiaHabil: true,
        esPendiente: false, datosDesactualizados: false,
        placasRestringidas: [], horarioTexto: vehiculo.horario,
        mensaje: 'Hoy es festivo. No aplica Pico y Placa.',
      };
    }
    const placas = vehiculo.restricciones[diaSemana] ?? [];
    return {
      aplica: placas.length > 0,
      esFestivo: festivo, esDiaHabil: true,
      esPendiente: false, datosDesactualizados: false,
      placasRestringidas: placas.filter((p) => p !== 'pendiente_verificar').map(Number),
      horarioTexto: vehiculo.horario,
      mensaje: placas.length > 0
        ? `Hoy aplica Pico y Placa para placas: ${placas.join(', ')}.`
        : 'Hoy no aplica Pico y Placa.',
    };
  }

  // --- Formato nuevo (con modalidad) ---

  const festivo = esFestivo(fecha);
  const finDeSemana = esFinDeSemana(fecha);
  const diaSemana = DIAS_SEMANA[fecha.getDay()];

  // Campos comunes de vehículos con restricción activa
  const vehiculoActivo = vehiculo as { aplica_festivos: boolean; aplica_fines_de_semana: boolean; horario_texto: string; criterio_placa?: string; descripcion?: string };

  // Los festivos y fines de semana se resuelven ANTES de mirar la vigencia:
  // en esos días nunca hay restricción, así que la respuesta sigue siendo
  // correcta aunque el decreto cargado ya haya vencido o todavía no empiece
  // a regir (por ejemplo, el fin de semana que separa dos semestres).

  // Si es festivo y no aplica en festivos
  if (festivo && !vehiculoActivo.aplica_festivos) {
    return {
      aplica: false,
      esFestivo: true,
      esDiaHabil: false,
      esPendiente: false,
      datosDesactualizados: false,
      placasRestringidas: [],
      horarioTexto: vehiculoActivo.horario_texto,
      criterioPlaca: vehiculoActivo.criterio_placa as ResultadoPicoPlaca['criterioPlaca'],
      descripcionVehiculo: vehiculoActivo.descripcion,
      mensaje: 'Hoy es festivo. No aplica Pico y Placa.',
    };
  }

  // Si es fin de semana y no aplica en fines de semana
  if (finDeSemana && !vehiculoActivo.aplica_fines_de_semana) {
    return {
      aplica: false,
      esFestivo: festivo,
      esDiaHabil: false,
      esPendiente: false,
      datosDesactualizados: false,
      placasRestringidas: [],
      horarioTexto: vehiculoActivo.horario_texto,
      criterioPlaca: vehiculoActivo.criterio_placa as ResultadoPicoPlaca['criterioPlaca'],
      descripcionVehiculo: vehiculoActivo.descripcion,
      mensaje: 'Hoy es fin de semana. No aplica Pico y Placa.',
    };
  }

  // Verificar vigencia (solo para días hábiles, donde sí importa qué decreto rige)
  if (!dentroDeVigencia(ciudad, fecha)) {
    return {
      aplica: false,
      esFestivo: false,
      esDiaHabil: false,
      esPendiente: false,
      datosDesactualizados: true,
      placasRestringidas: [],
      horarioTexto: '',
      mensaje: 'Los datos de restricción están fuera del periodo de vigencia. Verifica con la fuente oficial.',
    };
  }

  // Modalidad semanal por día
  if (esSemanalPorDia(vehiculo)) {
    const placas = vehiculo.rotacion[diaSemana] ?? [];
    return {
      aplica: placas.length > 0,
      esFestivo: festivo,
      esDiaHabil: true,
      esPendiente: false,
      datosDesactualizados: false,
      placasRestringidas: placas,
      horarioTexto: vehiculo.horario_texto,
      criterioPlaca: vehiculo.criterio_placa,
      descripcionVehiculo: vehiculo.descripcion,
      mensaje: placas.length > 0
        ? `Hoy aplica Pico y Placa para placas con ${CRITERIO_LEGIBLE[vehiculo.criterio_placa]} ${placas.join(' y ')}.`
        : 'Hoy no aplica Pico y Placa para este tipo de vehículo.',
    };
  }

  // Modalidad quincenal por fecha
  if (esQuincenalPorFecha(vehiculo)) {
    const fechaISO = formatearISO(fecha);
    const placasHoy: number[] = [];
    for (const [digito, fechas] of Object.entries(vehiculo.fechas_restriccion)) {
      if (fechas.includes(fechaISO)) {
        placasHoy.push(Number(digito));
      }
    }
    placasHoy.sort((a, b) => a - b);
    return {
      aplica: placasHoy.length > 0,
      esFestivo: festivo,
      esDiaHabil: true,
      esPendiente: false,
      datosDesactualizados: false,
      placasRestringidas: placasHoy,
      horarioTexto: vehiculo.horario_texto,
      criterioPlaca: vehiculo.criterio_placa,
      descripcionVehiculo: vehiculo.descripcion,
      mensaje: placasHoy.length > 0
        ? `Hoy aplica Pico y Placa para taxis con ${CRITERIO_LEGIBLE[vehiculo.criterio_placa]} ${placasHoy.join(' y ')}.`
        : 'Hoy no hay restricción de Pico y Placa para taxis.',
    };
  }

  // Fallback (no debería llegar aquí)
  return {
    aplica: false,
    esFestivo: festivo,
    esDiaHabil: true,
    esPendiente: false,
    datosDesactualizados: false,
    placasRestringidas: [],
    horarioTexto: '',
    mensaje: 'No se pudo determinar el estado de Pico y Placa.',
  };
}

/**
 * Calcula el pico y placa para los próximos N días a partir de una fecha.
 * Útil para mostrar un calendario en la página de detalle.
 */
export interface DiaCalendario {
  fecha: Date;
  fechaTexto: string;
  diaCorto: string;
  numeroDia: number;
  mesCorto: string;
  esHoy: boolean;
  resultado: ResultadoPicoPlaca;
}

export function calcularProximosDias(
  ciudad: Ciudad,
  tipo: TipoVehiculo,
  fechaInicio: Date,
  dias: number = 7,
): DiaCalendario[] {
  const resultados: DiaCalendario[] = [];
  for (let i = 0; i < dias; i++) {
    const fecha = new Date(fechaInicio);
    fecha.setDate(fecha.getDate() + i);
    resultados.push({
      fecha,
      fechaTexto: format(fecha, "EEE d 'de' MMM", { locale: es }),
      diaCorto: format(fecha, 'EEE', { locale: es }).replace('.', ''),
      numeroDia: fecha.getDate(),
      mesCorto: format(fecha, 'MMM', { locale: es }).replace('.', ''),
      esHoy: i === 0,
      resultado: calcularPicoPlaca(ciudad, tipo, fecha),
    });
  }
  return resultados;
}
