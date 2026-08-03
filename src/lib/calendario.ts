/**
 * Genera archivos .ics (iCalendar) con los días de pico y placa de una placa
 * concreta, para que el usuario los agregue al calendario del celular.
 *
 * Las fechas NO se calculan aquí: se piden al motor (`calcularPicoPlaca`), que es
 * el mismo que pinta la página. Así el calendario y el sitio nunca pueden decir
 * cosas distintas.
 */

import { calcularPicoPlaca, formatearISO } from './calcular';
import { ETIQUETAS_VEHICULO } from './tipos';
import type { Ciudad, TipoVehiculo } from './tipos';

/** Colombia no usa horario de verano: siempre UTC-5 */
const DESFASE_COLOMBIA_HORAS = 5;

/** Tope de días a generar cuando la ciudad no declara fin de vigencia */
const DIAS_MAXIMO_SIN_VIGENCIA = 180;

export interface DiaRestringido {
  fecha: Date;
  horaInicio: string;
  horaFin: string;
}

/** Convierte una hora local de Colombia a la marca UTC que exige el formato .ics */
function aMarcaUTC(fecha: Date, hora: string): string {
  const [h, m] = hora.split(':').map(Number);
  const utc = new Date(
    Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), h + DESFASE_COLOMBIA_HORAS, m),
  );
  return utc.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Escapa los caracteres que el formato .ics trata como separadores */
function escapar(texto: string): string {
  return texto
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Parte las líneas a 75 octetos, como exige el RFC 5545. Sin esto, algunos
 * calendarios (Outlook entre ellos) rechazan el archivo entero.
 */
function plegarLinea(linea: string): string {
  if (linea.length <= 75) return linea;
  const partes: string[] = [linea.slice(0, 75)];
  let resto = linea.slice(75);
  while (resto.length > 74) {
    partes.push(' ' + resto.slice(0, 74));
    resto = resto.slice(74);
  }
  if (resto) partes.push(' ' + resto);
  return partes.join('\r\n');
}

/**
 * Recorre el periodo de vigencia y devuelve los días en que ese dígito
 * tiene restricción.
 */
export function diasRestringidos(
  ciudad: Ciudad,
  tipo: TipoVehiculo,
  digito: number,
  desde: Date,
): DiaRestringido[] {
  const dias: DiaRestringido[] = [];
  const inicio = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate(), 12);

  // Si la ciudad declara hasta cuándo rige el decreto, se usa esa fecha. Si no,
  // se genera un tope prudente: no tiene sentido prometer fechas de un decreto
  // que todavía no existe.
  let fin: Date;
  if (ciudad.vigencia_hasta) {
    const [a, m, d] = ciudad.vigencia_hasta.split('-').map(Number);
    fin = new Date(a, m - 1, d, 12);
  } else {
    fin = new Date(inicio);
    fin.setDate(fin.getDate() + DIAS_MAXIMO_SIN_VIGENCIA);
  }

  const cursor = new Date(inicio);
  while (cursor <= fin) {
    const resultado = calcularPicoPlaca(ciudad, tipo, cursor);
    if (
      resultado.aplica &&
      !resultado.esPendiente &&
      !resultado.datosDesactualizados &&
      resultado.placasRestringidas.includes(digito)
    ) {
      const vehiculo = ciudad.vehiculos[tipo] as { horario_inicio?: string; horario_fin?: string };
      dias.push({
        fecha: new Date(cursor),
        horaInicio: vehiculo.horario_inicio ?? '00:00',
        horaFin: vehiculo.horario_fin ?? '23:59',
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dias;
}

/** Construye el archivo .ics completo. Devuelve null si no hay nada que agendar. */
export function generarICS(
  ciudad: Ciudad,
  tipo: TipoVehiculo,
  digito: number,
  desde: Date,
): string | null {
  const dias = diasRestringidos(ciudad, tipo, digito, desde);
  if (dias.length === 0) return null;

  const vehiculo = ciudad.vehiculos[tipo] as { criterio_placa?: string };
  const criterio = vehiculo.criterio_placa === 'primer_digito' ? 'primer dígito' : 'último dígito';
  const etiqueta = ETIQUETAS_VEHICULO[tipo];
  const nombreCalendario = `Pico y placa ${ciudad.nombre} · ${etiqueta} placa ${digito}`;
  const ahora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const lineas: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//picoyplacahoy.co//Pico y Placa Colombia//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapar(nombreCalendario)}`,
    'X-WR-TIMEZONE:America/Bogota',
  ];

  for (const dia of dias) {
    const iso = formatearISO(dia.fecha);
    const inicio = aMarcaUTC(dia.fecha, dia.horaInicio);

    // Si la restricción termina antes de la hora en que empieza, cruza la
    // medianoche y el fin cae al día siguiente.
    const [hi] = dia.horaInicio.split(':').map(Number);
    const [hf] = dia.horaFin.split(':').map(Number);
    const fechaFin = new Date(dia.fecha);
    if (hf < hi) fechaFin.setDate(fechaFin.getDate() + 1);
    const fin = aMarcaUTC(fechaFin, dia.horaFin);

    const descripcion =
      `No puedes circular en ${ciudad.nombre} con ${criterio} ${digito} ` +
      `entre las ${dia.horaInicio} y las ${dia.horaFin}. ` +
      `Consulta el detalle en https://picoyplacahoy.co/${ciudad.slug}/${tipo}`;

    lineas.push(
      'BEGIN:VEVENT',
      `UID:${ciudad.slug}-${tipo}-${digito}-${iso}@picoyplacahoy.co`,
      `DTSTAMP:${ahora}`,
      `DTSTART:${inicio}`,
      `DTEND:${fin}`,
      plegarLinea(`SUMMARY:${escapar(`Pico y placa · ${etiqueta} placa ${digito}`)}`),
      plegarLinea(`DESCRIPTION:${escapar(descripcion)}`),
      plegarLinea(`LOCATION:${escapar(`${ciudad.nombre}, ${ciudad.departamento}`)}`),
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'TRIGGER:-PT12H',
      'ACTION:DISPLAY',
      plegarLinea(`DESCRIPTION:${escapar(`Mañana tienes pico y placa en ${ciudad.nombre}`)}`),
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lineas.push('END:VCALENDAR');

  // El RFC exige terminaciones de línea CRLF
  return lineas.join('\r\n') + '\r\n';
}

/** Indica si tiene sentido ofrecer calendario para este vehículo */
export function admiteCalendario(ciudad: Ciudad, tipo: TipoVehiculo): boolean {
  const vehiculo = ciudad.vehiculos[tipo];
  if (!vehiculo || vehiculo.aplica !== true) return false;
  if (!('modalidad' in vehiculo)) return false;
  return Boolean(ciudad.vigencia_hasta) || 'rotacion' in vehiculo;
}
