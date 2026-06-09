import { isHoliday } from 'colombian-holidays';

/** Verifica si una fecha es festivo en Colombia */
export function esFestivo(fecha: Date): boolean {
  return isHoliday(fecha);
}
