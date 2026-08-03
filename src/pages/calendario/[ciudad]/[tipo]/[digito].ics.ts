import type { APIRoute } from 'astro';
import { obtenerCiudad, tiposVehiculo } from '../../../../lib/ciudades';
import { generarICS } from '../../../../lib/calendario';
import { fechaColombia } from '../../../../lib/calcular';
import type { TipoVehiculo } from '../../../../lib/tipos';

// Se genera bajo demanda porque el calendario arranca en el día de hoy.
export const prerender = false;

export const GET: APIRoute = ({ params }) => {
  const { ciudad: slug, tipo, digito } = params;

  const ciudad = slug ? obtenerCiudad(slug) : undefined;
  if (!ciudad) {
    return new Response('Ciudad no encontrada', { status: 404 });
  }

  if (!tipo || !tiposVehiculo.includes(tipo as TipoVehiculo)) {
    return new Response('Tipo de vehículo no válido', { status: 404 });
  }

  const numero = Number(digito);
  if (!Number.isInteger(numero) || numero < 0 || numero > 9) {
    return new Response('El dígito de la placa debe ser un número del 0 al 9', { status: 400 });
  }

  const ics = generarICS(ciudad, tipo as TipoVehiculo, numero, fechaColombia());
  if (!ics) {
    return new Response(
      `No hay días de pico y placa para la placa ${numero} en ${ciudad.nombre} dentro del periodo vigente.`,
      {
        status: 404,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          // Sin caché: si mañana la ciudad gana datos, el borde no debe seguir
          // sirviendo este 404 viejo (ya nos pasó al cargar Pasto).
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="picoyplaca-${ciudad.slug}-${tipo}-${numero}.ics"`,
      // El calendario depende del día en que se descarga: media hora de caché
      // basta para aguantar un pico de visitas sin quedar desactualizado.
      'Cache-Control': 'public, max-age=1800',
    },
  });
};
