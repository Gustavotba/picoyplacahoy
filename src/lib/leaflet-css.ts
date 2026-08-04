/**
 * Carga bajo demanda la hoja de estilos de Leaflet.
 *
 * Antes iba como `<link rel="stylesheet">` en el marcado de cada mapa, y eso
 * **bloquea el primer pintado**: el navegador no dibuja nada de la página hasta
 * traer un archivo de un servidor ajeno (unpkg). En un sitio cuya promesa es
 * responder en menos de un segundo, eso se paga en cada visita — incluso en las
 * que nunca bajan hasta el mapa.
 *
 * Vive en su propio módulo para que los dos componentes de mapa compartan la
 * misma promesa: al ser un módulo ES, existe una sola instancia por página
 * aunque lo importen varios `<script>`, así que la hoja se pide una sola vez.
 */
const CSS_LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const CSS_INTEGRIDAD = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';

let promesa: Promise<void> | null = null;

export function cargarCssLeaflet(): Promise<void> {
  if (promesa) return promesa;

  promesa = new Promise((resolver, rechazar) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_LEAFLET;
    link.integrity = CSS_INTEGRIDAD;
    link.crossOrigin = 'anonymous';
    link.onload = () => resolver();
    link.onerror = () => rechazar(new Error('No se pudo cargar la hoja de estilos de Leaflet'));
    document.head.appendChild(link);
  });

  return promesa;
}

/** Margen de anticipación: se empieza a cargar 200 px antes de que asome. */
const MARGEN = 200;

/**
 * Ejecuta `alInterceptar` una sola vez, cuando el elemento se acerca a la
 * pantalla.
 *
 * Usa IntersectionObserver, pero **no confía solo en él**: escucha además el
 * desplazamiento y comprueba la posición al arrancar. La redundancia es a
 * propósito — si el observador no dispara (pasa en algunos navegadores
 * embebidos y entornos de prueba), sin la red de seguridad el mapa no cargaría
 * jamás, y un mapa que nunca aparece es peor que uno que carga de más.
 */
export function alAcercarse(elemento: Element, alInterceptar: () => void): void {
  let hecho = false;
  let observador: IntersectionObserver | null = null;

  const estaCerca = (): boolean => {
    const caja = elemento.getBoundingClientRect();
    return caja.top < window.innerHeight + MARGEN && caja.bottom > -MARGEN;
  };

  const limpiar = () => {
    observador?.disconnect();
    window.removeEventListener('scroll', alDesplazar);
    window.removeEventListener('resize', alDesplazar);
  };

  const disparar = () => {
    if (hecho) return;
    hecho = true;
    limpiar();
    alInterceptar();
  };

  const alDesplazar = () => {
    if (estaCerca()) disparar();
  };

  // Si el elemento ya está a la vista al cargar, no hay nada que esperar.
  if (estaCerca()) {
    disparar();
    return;
  }

  if ('IntersectionObserver' in window) {
    observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) disparar();
      },
      { rootMargin: `${MARGEN}px` },
    );
    observador.observe(elemento);
  }

  window.addEventListener('scroll', alDesplazar, { passive: true });
  window.addEventListener('resize', alDesplazar, { passive: true });
}
