import { isHoliday, getHolidaysForYear } from 'colombian-holidays';

/** Verifica si una fecha es festivo en Colombia */
export function esFestivo(fecha: Date): boolean {
  return isHoliday(fecha);
}

/** Un festivo colombiano ya resuelto al día en que de verdad se descansa */
export interface Festivo {
  /** Día en que se descansa, en ISO (para los puentes, el lunes trasladado) */
  fechaISO: string;
  /** Nombre en español, como "Independencia de Cartagena" */
  nombre: string;
}

/**
 * Festivos del año, con la fecha en que REALMENTE se descansa.
 *
 * `colombian-holidays` entrega dos fechas por festivo: `date` es la fecha
 * histórica y `celebrationDate` es el día trasladado por la Ley Emiliani (los
 * "puentes"). Aquí solo interesa la segunda, que es la que el motor considera
 * festivo y la que le importa a alguien que quiere saber si mañana sale el carro.
 */
function festivosDelAño(año: number): Festivo[] {
  return getHolidaysForYear(año).map((f) => ({
    fechaISO: f.celebrationDate,
    nombre: f.name.es,
  }));
}

/** Nombre del festivo que cae en esa fecha, o null si es un día corriente */
export function nombreFestivo(fecha: Date): string | null {
  const iso = fechaISOLocal(fecha);
  const encontrado = festivosDelAño(fecha.getFullYear()).find(
    (f) => f.fechaISO === iso,
  );
  return encontrado ? encontrado.nombre : null;
}

/**
 * El próximo festivo estrictamente posterior a `desde`.
 *
 * Mira también el año siguiente, porque en diciembre los festivos que quedan
 * por delante ya son del año entrante.
 */
export function proximoFestivo(desde: Date): Festivo | null {
  const iso = fechaISOLocal(desde);
  const candidatos = [
    ...festivosDelAño(desde.getFullYear()),
    ...festivosDelAño(desde.getFullYear() + 1),
  ]
    .filter((f) => f.fechaISO > iso)
    .sort((a, b) => a.fechaISO.localeCompare(b.fechaISO));
  return candidatos[0] ?? null;
}

/**
 * Fecha en ISO leyendo el día LOCAL, no el UTC.
 *
 * No se usa `toISOString()` a propósito: como Colombia es UTC-5, convertir a
 * UTC corre la fecha al día siguiente durante toda la tarde y la noche, y el
 * festivo quedaría comparado contra el día equivocado.
 */
function fechaISOLocal(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}
