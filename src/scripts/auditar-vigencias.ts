/**
 * Auditoría de vigencias: avisa qué ciudades están a punto de mostrar datos
 * viejos, o ya los están mostrando.
 *
 * Existe porque el 2 de agosto de 2026 había CINCO ciudades con datos vencidos
 * a la vez (Medellín, Cali, Ibagué, Popayán y Buenaventura) y nadie se dio
 * cuenta durante un mes. Una rotación vencida es peor que no tener el dato: el
 * usuario lee "me toca el lunes" con toda confianza y sale derecho a la multa.
 *
 * Se ejecuta con `npm run auditar`. Devuelve código de salida 1 si encuentra
 * algo grave, para poder engancharlo a una tarea programada más adelante.
 *
 * OJO: esto NO consulta las alcaldías. Solo revisa lo que tenemos cargado. Sirve
 * para saber CUÁNDO hay que ir a mirar la fuente oficial, no para reemplazarla.
 */
import { ciudades } from '../lib/ciudades';
import { esPlaceholder, esQuincenalPorFecha, esSemanalPorDia, esParImparPorFecha } from '../lib/tipos';
import type { Ciudad, InfoVehiculo, TipoVehiculo } from '../lib/tipos';
import { ETIQUETAS_VEHICULO } from '../lib/tipos';

/**
 * Cuántos días antes queremos que nos avisen. Se puede cambiar por la línea de
 * comandos: `npm run auditar -- 90` para ver qué se vence en el trimestre.
 */
const DIAS_AVISO = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 30;

type Gravedad = 'grave' | 'aviso' | 'nota';

interface Hallazgo {
  gravedad: Gravedad;
  ciudad: string;
  titulo: string;
  detalle: string;
}

const hoy = new Date();
hoy.setHours(0, 0, 0, 0);
const hoyISO = hoy.toISOString().slice(0, 10);

const limite = new Date(hoy);
limite.setDate(limite.getDate() + DIAS_AVISO);
const limiteISO = limite.toISOString().slice(0, 10);

/** Días entre hoy y una fecha ISO (negativo si ya pasó) */
function diasHasta(iso: string): number {
  const destino = new Date(iso + 'T00:00:00');
  return Math.round((destino.getTime() - hoy.getTime()) / 86_400_000);
}

/** Los tipos de vehículo que tienen restricción declarada */
function vehiculosActivos(ciudad: Ciudad): Array<[TipoVehiculo, InfoVehiculo]> {
  return (Object.entries(ciudad.vehiculos) as Array<[TipoVehiculo, InfoVehiculo]>).filter(
    ([, v]) => v.aplica,
  );
}

/** La última fecha cargada en un calendario explícito, o null si no hay ninguna */
function ultimaFechaDelCalendario(fechas: Record<string, string[]>): string | null {
  const todas = Object.values(fechas).flat().filter(Boolean).sort();
  return todas.length > 0 ? todas[todas.length - 1] : null;
}

const hallazgos: Hallazgo[] = [];
const apuntar = (gravedad: Gravedad, ciudad: string, titulo: string, detalle: string) =>
  hallazgos.push({ gravedad, ciudad, titulo, detalle });

for (const ciudad of ciudades) {
  const activos = vehiculosActivos(ciudad);

  // --- Ciudades sin datos ---
  if (ciudad.decreto_actual === 'pendiente_verificar') {
    apuntar('nota', ciudad.nombre, 'Sin decreto cargado', 'Nunca se ha verificado en fuente oficial.');
    continue;
  }

  if (ciudad.decreto_actual === 'No aplica') {
    // Un "No aplica" viejo es sospechoso: puede que la ciudad haya estrenado
    // pico y placa desde entonces. Le pasó a Pasto.
    const dias = -diasHasta(ciudad.fecha_ultima_actualizacion);
    if (dias > 365) {
      apuntar(
        'aviso',
        ciudad.nombre,
        '"No aplica" sin revisar hace más de un año',
        `Última revisión: ${ciudad.fecha_ultima_actualizacion} (hace ${dias} días).`,
      );
    }
    continue;
  }

  // --- Vigencia del decreto ---
  if (activos.length > 0) {
    if (!ciudad.vigencia_hasta) {
      apuntar(
        'aviso',
        ciudad.nombre,
        'Sin fecha de caducidad',
        'No tiene `vigencia_hasta`, así que nunca se marcará sola como desactualizada: ' +
          'seguirá mostrando esta rotación como si fuera de hoy, para siempre.',
      );
    } else if (ciudad.vigencia_hasta < hoyISO) {
      apuntar(
        'grave',
        ciudad.nombre,
        'DECRETO VENCIDO',
        `Venció el ${ciudad.vigencia_hasta} (hace ${-diasHasta(ciudad.vigencia_hasta)} días). ` +
          `Decreto cargado: ${ciudad.decreto_actual}`,
      );
    } else if (ciudad.vigencia_hasta <= limiteISO) {
      apuntar(
        'aviso',
        ciudad.nombre,
        'Vence pronto',
        `Vence el ${ciudad.vigencia_hasta} (en ${diasHasta(ciudad.vigencia_hasta)} días).`,
      );
    }
  }

  // --- Estado de cada tipo de vehículo ---
  for (const [tipo, vehiculo] of activos) {
    const etiqueta = ETIQUETAS_VEHICULO[tipo];

    if (esPlaceholder(vehiculo)) {
      const tieneAlgo = Object.values(vehiculo.restricciones).some((placas) =>
        placas?.some((p) => p !== 'pendiente_verificar'),
      );
      if (!tieneAlgo) {
        apuntar('nota', ciudad.nombre, `${etiqueta}: pendiente`, 'Dice que aplica, pero no hay datos cargados.');
      }
      continue;
    }

    if (esSemanalPorDia(vehiculo)) {
      const vacia = Object.values(vehiculo.rotacion).every((d) => !d || d.length === 0);
      if (vacia) {
        apuntar('grave', ciudad.nombre, `${etiqueta}: rotación vacía`, 'Dice que aplica pero la tabla está vacía: la página no muestra nada.');
      }
      continue;
    }

    if (esParImparPorFecha(vehiculo)) {
      const { fecha_par, fecha_impar } = vehiculo.regla_par_impar;
      if (fecha_par.length === 0 && fecha_impar.length === 0) {
        apuntar('grave', ciudad.nombre, `${etiqueta}: regla par/impar vacía`, 'No hay dígitos en ninguna de las dos listas.');
      }
      continue;
    }

    if (esQuincenalPorFecha(vehiculo)) {
      // Este es el caso silencioso: los calendarios se cargan como fechas
      // explícitas y, cuando se acaban, la ciudad empieza a decir "libre"
      // todos los días sin avisar a nadie.
      const ultima = ultimaFechaDelCalendario(vehiculo.fechas_restriccion);

      if (!ultima) {
        apuntar('grave', ciudad.nombre, `${etiqueta}: calendario vacío`, 'Dice que aplica pero no tiene ni una fecha cargada.');
      } else if (ultima < hoyISO) {
        apuntar(
          'grave',
          ciudad.nombre,
          `${etiqueta}: CALENDARIO AGOTADO`,
          `La última fecha cargada fue el ${ultima}. Desde entonces la página dice "libre" todos los días.`,
        );
      } else if (ultima <= limiteISO) {
        apuntar(
          'aviso',
          ciudad.nombre,
          `${etiqueta}: al calendario le quedan ${diasHasta(ultima)} días`,
          `Se acaba el ${ultima}. Hay que cargar el siguiente periodo antes de esa fecha.`,
        );
      }
    }
  }
}

// ---------- Informe ----------

const ORDEN: Gravedad[] = ['grave', 'aviso', 'nota'];
const TITULOS: Record<Gravedad, string> = {
  grave: '🔴 GRAVE — la página está mostrando algo incorrecto ahora mismo',
  aviso: '🟡 AVISO — hay que revisarlo pronto',
  nota: '⚪ PENDIENTE — falta cargarlo, pero la página lo dice honestamente',
};

console.log(
  `\nAuditoría de vigencias · ${hoyISO} · ${ciudades.length} ciudades · avisando con ${DIAS_AVISO} días\n`,
);

for (const gravedad of ORDEN) {
  const grupo = hallazgos.filter((h) => h.gravedad === gravedad);
  if (grupo.length === 0) continue;

  console.log(`${TITULOS[gravedad]}  (${grupo.length})`);
  console.log('─'.repeat(70));
  for (const h of grupo) {
    console.log(`  ${h.ciudad} — ${h.titulo}`);
    console.log(`      ${h.detalle}`);
  }
  console.log();
}

const graves = hallazgos.filter((h) => h.gravedad === 'grave').length;
const avisos = hallazgos.filter((h) => h.gravedad === 'aviso').length;

if (graves === 0 && avisos === 0) {
  console.log('✅ Ninguna ciudad con datos vencidos ni por vencer.\n');
} else {
  console.log(`Resumen: ${graves} graves, ${avisos} avisos.\n`);
}

console.log('Recordatorio: esto solo revisa lo que tenemos cargado. Para saber si');
console.log('una alcaldía cambió su decreto hay que ir a su portal oficial.\n');

process.exit(graves > 0 ? 1 : 0);
