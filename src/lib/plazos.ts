/**
 * Plazos para pagar la multa con descuento (artículo 136 de la Ley 769 de 2002,
 * modificado por el artículo 118 del Decreto 2106 de 2019).
 *
 * Los días son HÁBILES: sin sábados, domingos ni festivos. Así los cuentan
 * Bogotá y Medellín en sus guías oficiales, y es la regla general de los plazos
 * legales en días (artículo 62 de la Ley 4 de 1913). El día 1 es el primer día
 * hábil DESPUÉS del comparendo o de la notificación.
 *
 * - Comparendo de un agente: 50 % hasta el día 5; 75 % del día 6 al 20. Para
 *   pedir audiencia hay que presentarse en 3 días hábiles (artículo 135).
 * - Fotomulta: todo se cuenta desde que llega la notificación. La Ley 1843 de
 *   2017 (artículo 8) da 11 días hábiles para presentarse; Bogotá y Medellín
 *   aplican el 50 % hasta el día 11 y el 75 % del día 12 al 26.
 *
 * Las fechas se manejan siempre a mediodía: `colombian-holidays` compara en
 * UTC, y a mediodía el día es el mismo en Colombia y en el servidor.
 */
import { esFestivo, nombreFestivo } from './festivos';

export type MedioComparendo = 'agente' | 'camara';

export const DIAS_PLAZO: Record<MedioComparendo, { audiencia: number; cincuenta: number; setentaYCinco: number }> = {
  agente: { audiencia: 3, cincuenta: 5, setentaYCinco: 20 },
  camara: { audiencia: 11, cincuenta: 11, setentaYCinco: 26 },
};

/** La misma fecha, a mediodía (ver nota de arriba) */
function aMediodia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12);
}

/** "2026-09-24", leyendo el día local */
export function isoLocal(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

export function esDiaHabil(fecha: Date): boolean {
  const dia = fecha.getDay();
  return dia !== 0 && dia !== 6 && !esFestivo(aMediodia(fecha));
}

/** El día hábil número `n` DESPUÉS de `desde` (n = 1 es el siguiente día hábil) */
export function sumarDiasHabiles(desde: Date, n: number): Date {
  const fecha = aMediodia(desde);
  let contados = 0;
  while (contados < n) {
    fecha.setDate(fecha.getDate() + 1);
    if (esDiaHabil(fecha)) contados++;
  }
  return fecha;
}

/** Días hábiles desde `hoy` (incluido, si es hábil) hasta `limite` (incluido) */
export function diasHabilesRestantes(hoy: Date, limite: Date): number {
  const fecha = aMediodia(hoy);
  const fin = isoLocal(limite);
  let cuenta = 0;
  while (isoLocal(fecha) <= fin) {
    if (esDiaHabil(fecha)) cuenta++;
    fecha.setDate(fecha.getDate() + 1);
  }
  return cuenta;
}

export interface PlazosDescuento {
  medio: MedioComparendo;
  /** Fecha del comparendo, o de la notificación si es fotomulta */
  inicio: Date;
  /** Último día para presentarse a pedir audiencia */
  limiteAudiencia: Date;
  /** Último día para pagar el 50 % con curso */
  limite50: Date;
  /** Primer día del 75 % */
  desde75: Date;
  /** Último día para pagar el 75 % con curso */
  limite75: Date;
  /** Festivos que caen entre el inicio y el último plazo (ya descontados) */
  festivos: Array<{ fecha: Date; nombre: string }>;
}

export function calcularPlazos(inicio: Date, medio: MedioComparendo): PlazosDescuento {
  const dias = DIAS_PLAZO[medio];
  const limite75 = sumarDiasHabiles(inicio, dias.setentaYCinco);

  const festivos: PlazosDescuento['festivos'] = [];
  const fecha = aMediodia(inicio);
  while (isoLocal(fecha) < isoLocal(limite75)) {
    fecha.setDate(fecha.getDate() + 1);
    const nombre = nombreFestivo(fecha);
    if (nombre) festivos.push({ fecha: new Date(fecha), nombre });
  }

  return {
    medio,
    inicio: aMediodia(inicio),
    limiteAudiencia: sumarDiasHabiles(inicio, dias.audiencia),
    limite50: sumarDiasHabiles(inicio, dias.cincuenta),
    desde75: sumarDiasHabiles(inicio, dias.cincuenta + 1),
    limite75,
    festivos,
  };
}

export type Ventana = 'cincuenta' | 'setenta_y_cinco' | 'vencido';

/** En qué tramo del descuento está `hoy` */
export function ventanaActual(p: PlazosDescuento, hoy: Date): Ventana {
  const iso = isoLocal(hoy);
  if (iso <= isoLocal(p.limite50)) return 'cincuenta';
  if (iso <= isoLocal(p.limite75)) return 'setenta_y_cinco';
  return 'vencido';
}
