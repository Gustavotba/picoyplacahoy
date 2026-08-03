/**
 * Script ONE-TIME para generar los JSONs de todas las ciudades.
 * Usa datos investigados donde los hay, placeholders donde no.
 * Ejecutar: npx tsx src/scripts/generar-ciudades.ts
 */
import { writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

interface CiudadData {
  slug: string;
  nombre: string;
  departamento: string;
  coordenadas: [number, number];
  autoridad: string;
  autoridad_web: string;
  autoridad_twitter?: string;
  autoridad_facebook?: string;
  decreto_actual: string;
  fecha_ultima_actualizacion: string;
  vigencia_desde?: string;
  vigencia_hasta?: string;
  notas_generales?: string[];
  exenciones_generales?: string[];
  vias_exentas?: string[];
  sanciones: Record<string, unknown>;
  vehiculos: Record<string, unknown>;
  contacto_ciudadano?: Record<string, unknown>;
}

const HOY = '2026-04-12';

// ====== DATOS DE CIUDADES ======

const ciudades: CiudadData[] = [
  // === BOGOTÁ ===
  {
    slug: 'bogota',
    nombre: 'Bogotá',
    departamento: 'Cundinamarca',
    coordenadas: [4.6097, -74.0817],
    autoridad: 'Secretaría Distrital de Movilidad',
    autoridad_web: 'https://www.movilidadbogota.gov.co',
    autoridad_twitter: 'MovilidadBogota',
    decreto_actual: 'Decreto Distrital 003 de 2023',
    fecha_ultima_actualizacion: HOY,
    vigencia_desde: '2023-01-17',
    vigencia_hasta: '2026-12-31',
    notas_generales: [
      'La restricción opera por FECHA par/impar del calendario, no por día de la semana.',
      'Fechas impares (1, 3, 5...): no circulan placas terminadas en 1, 2, 3, 4 y 5.',
      'Fechas pares (2, 4, 6...): no circulan placas terminadas en 6, 7, 8, 9 y 0.',
      'No aplica en días festivos oficiales.',
      'Vehículos matriculados fuera de Bogotá también tienen restricción los sábados.',
      'Programa Pico y Placa Solidario: pago diario para circular en día restringido.',
    ],
    exenciones_generales: [
      'Vehículos eléctricos y cero emisiones',
      'Vehículos híbridos (combustión + eléctrico)',
      'Motocicletas (totalmente exentas)',
      'Vehículos diplomáticos y consulares',
      'Vehículos de emergencia (ambulancias, bomberos)',
      'Vehículos de personas con discapacidad registrados en RLCPD',
      'Transporte escolar',
      'Vehículos de instrucción de conducción',
      'Vehículos inscritos en Pico y Placa Solidario',
    ],
    vias_exentas: [
      'Autopista Norte (Peaje Andes a Portal Norte TransMilenio) — solo para pico y placa regional',
      'Autopista Sur (límite Soacha a Av. Boyacá) — solo para pico y placa regional',
      'Avenida Centenario (Río Bogotá a Av. Ciudad de Cali) — solo para pico y placa regional',
      'Calle 80 (Puente de Guadua a Portal 80 TransMilenio) — solo para pico y placa regional',
      'Carrera 7 (Calle 245 a Calle 183) — solo para pico y placa regional',
    ],
    sanciones: {
      tipo_multa: 'Tipo C',
      base_legal: 'Artículo 131, literal C, numeral 14 de la Ley 769 de 2002',
      valor_smldv: '15 SMLDV',
      valor_aproximado_pesos: 522900,
      incluye_inmovilizacion: true,
      descripcion: 'Multa equivalente a 15 salarios mínimos diarios legales vigentes más inmovilización del vehículo.',
    },
    vehiculos: {
      particulares: {
        aplica: true,
        descripcion: 'Vehículos particulares — restricción por fecha par/impar del calendario',
        criterio_placa: 'ultimo_digito',
        modalidad: 'par_impar_por_fecha',
        horario_inicio: '06:00',
        horario_fin: '21:00',
        horario_texto: '6:00 a.m. a 9:00 p.m.',
        dias_aplicables: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
        aplica_festivos: false,
        aplica_fines_de_semana: false,
        // Dígitos RESTRINGIDOS (no los que circulan). En fecha impar no circulan
        // 6-7-8-9-0; en fecha par no circulan 1-2-3-4-5 (Decreto Distrital 003 de 2023).
        regla_par_impar: {
          fecha_impar: [6, 7, 8, 9, 0],
          fecha_par: [1, 2, 3, 4, 5],
        },
        aplican_vias_exentas: true,
      },
      motos: {
        aplica: false,
        descripcion: 'Las motocicletas están totalmente exentas de pico y placa en Bogotá.',
        nota: 'Exención establecida en el Artículo 2 del Decreto 208 de 2020.',
      },
      taxis: {
        aplica: true,
        descripcion: 'Taxis — restricción rotatoria de 2 dígitos por día, calendario mensual publicado por la SDM',
        criterio_placa: 'ultimo_digito',
        modalidad: 'quincenal_por_fecha',
        horario_inicio: '05:30',
        horario_fin: '21:00',
        horario_texto: '5:30 a.m. a 9:00 p.m. (lunes a sábado)',
        dias_aplicables: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
        aplica_festivos: false,
        aplica_fines_de_semana: false,
        aplican_vias_exentas: false,
        nota_especial: 'La rotación de taxis es publicada mensualmente por la Secretaría de Movilidad. Consultar el calendario oficial.',
        fechas_restriccion: {},
      },
      transporte_carga: {
        aplica: true,
        descripcion: 'Vehículos de carga con más de 20 años de antigüedad — restricción en horas pico',
        criterio_placa: 'ultimo_digito',
        modalidad: 'semanal_por_dia',
        horario_inicio: '06:00',
        horario_fin: '08:00',
        horario_texto: '6:00-8:00 a.m. y 5:00-8:00 p.m. (dos franjas)',
        dias_aplicables: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
        aplica_festivos: false,
        aplica_fines_de_semana: false,
        aplican_vias_exentas: false,
        rotacion: {
          lunes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
          martes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
          miercoles: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
          jueves: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
          viernes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        },
        nota_especial: 'Restricción por franjas horarias para TODOS los dígitos (vehículos >20 años). Vehículos más nuevos no aplican.',
      },
    },
    contacto_ciudadano: {
      sitio_web_general: 'https://bogota.gov.co',
      secretaria_movilidad: 'https://www.movilidadbogota.gov.co',
      twitter: 'https://x.com/MovilidadBogota',
      facebook: 'https://www.facebook.com/MovilidadBogota',
      linea_atencion: '195',
      linea_movilidad: '195',
    },
  },

  // === CALI ===
  {
    slug: 'cali',
    nombre: 'Cali',
    departamento: 'Valle del Cauca',
    coordenadas: [3.4516, -76.5320],
    autoridad: 'Secretaría de Movilidad de Cali',
    autoridad_web: 'https://www.cali.gov.co/movilidad/',
    autoridad_twitter: 'MovilidadCali',
    decreto_actual: 'Decreto 4112.010.20.497 de 2021 (rotación 1er semestre 2026)',
    fecha_ultima_actualizacion: HOY,
    vigencia_desde: '2026-01-13',
    vigencia_hasta: '2026-06-30',
    notas_generales: [
      'Restricción aplica en todo el perímetro urbano de Cali.',
      'No aplica en días festivos oficiales ni fines de semana.',
      'Semana pedagógica (sin sanciones): 5 al 9 de enero de 2026.',
    ],
    exenciones_generales: [
      'Motocicletas (totalmente exentas)',
      'Vehículos eléctricos e híbridos',
      'Vehículos de carga con capacidad ≥ 5 toneladas',
      'Ambulancias registradas',
      'Vehículos de Defensa Civil, Bomberos, Cruz Roja',
      'Vehículos de servicio oficial, diplomático y consular',
      'Vehículos de personas con discapacidad (acreditados)',
      'Vehículos con tasa por congestión pagada (Acuerdo 0563 de 2023)',
    ],
    vias_exentas: [],
    sanciones: {
      tipo_multa: 'Tipo C',
      base_legal: 'Artículo 131, literal C, numeral 14 de la Ley 769 de 2002',
      valor_smldv: '15 SMLDV',
      valor_aproximado_pesos: 633200,
      incluye_inmovilizacion: true,
      descripcion: 'Multa equivalente a 15 SMLDV (~$633.200 COP en 2026) más inmovilización del vehículo.',
    },
    vehiculos: {
      particulares: {
        aplica: true,
        descripcion: 'Vehículos de servicio particular',
        criterio_placa: 'ultimo_digito',
        modalidad: 'semanal_por_dia',
        horario_inicio: '06:00',
        horario_fin: '19:00',
        horario_texto: '6:00 a.m. a 7:00 p.m.',
        dias_aplicables: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
        aplica_festivos: false,
        aplica_fines_de_semana: false,
        rotacion: {
          lunes: [1, 2],
          martes: [3, 4],
          miercoles: [5, 6],
          jueves: [7, 8],
          viernes: [9, 0],
        },
        aplican_vias_exentas: false,
      },
      motos: {
        aplica: false,
        descripcion: 'Las motocicletas están exentas de pico y placa en Cali.',
      },
      taxis: {
        aplica: false,
        descripcion: 'Los taxis no tienen pico y placa en Cali. La restricción aplica solo a servicio particular.',
      },
      transporte_carga: {
        aplica: false,
        descripcion: 'Vehículos de carga con capacidad ≥ 5 toneladas están exentos. Menores capacidades siguen regla de particulares.',
      },
    },
    contacto_ciudadano: {
      sitio_web_general: 'https://www.cali.gov.co',
      secretaria_movilidad: 'https://www.cali.gov.co/movilidad/',
      twitter: 'https://x.com/MovilidadCali',
      facebook: 'https://www.facebook.com/SecMovilidadCali',
      linea_atencion: '(602) 887 9020',
      linea_movilidad: '(602) 369 0767',
    },
  },

  // === BARRANQUILLA ===
  {
    slug: 'barranquilla',
    nombre: 'Barranquilla',
    departamento: 'Atlántico',
    coordenadas: [10.9639, -74.7964],
    autoridad: 'Secretaría Distrital de Tránsito y Seguridad Vial',
    autoridad_web: 'https://www.barranquilla.gov.co/transito',
    autoridad_twitter: 'TransitoBaq',
    decreto_actual: 'Sin pico y placa permanente para particulares (solo taxis)',
    fecha_ultima_actualizacion: HOY,
    notas_generales: [
      'Barranquilla NO tiene pico y placa permanente para vehículos particulares.',
      'Solo se aplica de forma temporal durante eventos especiales (ej: Carnaval).',
      'Los taxis SÍ tienen pico y placa permanente todo el año.',
    ],
    exenciones_generales: [],
    vias_exentas: [],
    sanciones: {
      tipo_multa: 'Tipo C',
      base_legal: 'Artículo 131, literal C, numeral 14 de la Ley 769 de 2002',
      valor_smldv: '15 SMLDV',
      valor_aproximado_pesos: 633200,
      incluye_inmovilizacion: true,
      descripcion: 'Multa equivalente a 15 SMLDV más inmovilización del vehículo.',
    },
    vehiculos: {
      particulares: {
        aplica: false,
        descripcion: 'Barranquilla no tiene pico y placa permanente para vehículos particulares. Solo se aplica durante eventos especiales como el Carnaval.',
        nota: 'Verificar con la Secretaría de Tránsito si hay restricciones temporales vigentes.',
      },
      motos: {
        aplica: false,
        descripcion: 'No hay pico y placa para motocicletas en Barranquilla.',
      },
      taxis: {
        aplica: true,
        descripcion: 'Los taxis tienen pico y placa permanente todo el año (lunes a viernes, 6:00 a.m. a 9:00 p.m.)',
        criterio_placa: 'ultimo_digito',
        modalidad: 'semanal_por_dia',
        horario_inicio: '06:00',
        horario_fin: '21:00',
        horario_texto: '6:00 a.m. a 9:00 p.m.',
        dias_aplicables: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
        aplica_festivos: false,
        aplica_fines_de_semana: false,
        rotacion: {
          lunes: [],
          martes: [],
          miercoles: [],
          jueves: [],
          viernes: [],
        },
        nota_especial: 'Rotación de taxis publicada semestralmente por la Secretaría de Tránsito. Pendiente de verificar rotación exacta.',
        aplican_vias_exentas: false,
      },
      transporte_carga: {
        aplica: false,
        descripcion: 'No hay pico y placa para transporte de carga en Barranquilla.',
      },
    },
    contacto_ciudadano: {
      sitio_web_general: 'https://www.barranquilla.gov.co',
      secretaria_movilidad: 'https://www.barranquilla.gov.co/transito',
      twitter: 'https://x.com/TransitoBaq',
      facebook: 'https://www.facebook.com/TransitoBaq',
      linea_atencion: '195',
      linea_movilidad: '195',
    },
  },

  // === BUCARAMANGA ===
  {
    slug: 'bucaramanga',
    nombre: 'Bucaramanga',
    departamento: 'Santander',
    coordenadas: [7.1193, -73.1227],
    autoridad: 'Dirección de Tránsito de Bucaramanga',
    autoridad_web: 'https://transitobucaramanga.gov.co',
    autoridad_twitter: 'TransitoBGA',
    decreto_actual: 'Resolución 854 de 2025',
    fecha_ultima_actualizacion: HOY,
    vigencia_desde: '2026-01-13',
    vigencia_hasta: '2026-12-31',
    notas_generales: [
      'Aplica también en Floridablanca, Girón y Piedecuesta (Área Metropolitana).',
      'Los dígitos rotan cada trimestre.',
      'También hay restricción los sábados de 9:00 a.m. a 1:00 p.m.',
      'No aplica domingos ni festivos.',
    ],
    exenciones_generales: [
      'Taxis y transporte público colectivo',
      'Vehículos eléctricos e híbridos',
      'Vehículos oficiales del Estado',
      'Diplomáticos y consulares',
      'Vehículos de emergencia',
      'Transporte escolar',
      'Vehículos particulares nuevos matriculados en Bucaramanga (excluye motos)',
    ],
    vias_exentas: [
      'Anillo Vial entre intercambiadores de El Palenque y Café Madrid',
      'Vía Guatiguará en Piedecuesta (glorieta hasta límite con Girón)',
      'Vía Los Curos en Piedecuesta',
      'Todas las vías rurales de Piedecuesta y Floridablanca',
    ],
    sanciones: {
      tipo_multa: 'Tipo C',
      base_legal: 'Artículo 131, literal C, numeral 14 de la Ley 769 de 2002',
      valor_smldv: '15 SMLDV',
      valor_aproximado_pesos: 650000,
      incluye_inmovilizacion: true,
      descripcion: 'Multa equivalente a 15 SMLDV (~$650.000 COP) más inmovilización del vehículo.',
    },
    vehiculos: {
      particulares: {
        aplica: true,
        descripcion: 'Vehículos particulares y motocicletas',
        criterio_placa: 'ultimo_digito',
        modalidad: 'semanal_por_dia',
        horario_inicio: '06:00',
        horario_fin: '20:00',
        horario_texto: '6:00 a.m. a 8:00 p.m. (lun-vie) / 9:00 a.m. a 1:00 p.m. (sáb)',
        dias_aplicables: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
        aplica_festivos: false,
        aplica_fines_de_semana: false,
        rotacion: {
          lunes: [9, 0],
          martes: [1, 2],
          miercoles: [3, 4],
          jueves: [5, 6],
          viernes: [7, 8],
        },
        aplican_vias_exentas: true,
        nota_especial: 'Rotación Q2 (6 abr - 27 jun 2026). Los dígitos rotan cada trimestre.',
      },
      motos: {
        aplica: true,
        descripcion: 'Motocicletas — misma rotación que particulares',
        criterio_placa: 'ultimo_digito',
        modalidad: 'semanal_por_dia',
        horario_inicio: '06:00',
        horario_fin: '20:00',
        horario_texto: '6:00 a.m. a 8:00 p.m. (lun-vie) / 9:00 a.m. a 1:00 p.m. (sáb)',
        dias_aplicables: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
        aplica_festivos: false,
        aplica_fines_de_semana: false,
        rotacion: {
          lunes: [9, 0],
          martes: [1, 2],
          miercoles: [3, 4],
          jueves: [5, 6],
          viernes: [7, 8],
        },
        aplican_vias_exentas: true,
      },
      taxis: {
        aplica: false,
        descripcion: 'Los taxis están exentos de pico y placa en Bucaramanga.',
      },
      transporte_carga: {
        aplica: false,
        descripcion: 'No hay pico y placa específico para transporte de carga en Bucaramanga.',
        nota: 'Verificar restricciones de horario para vehículos pesados en zonas específicas.',
      },
    },
    contacto_ciudadano: {
      sitio_web_general: 'https://www.bucaramanga.gov.co',
      secretaria_movilidad: 'https://transitobucaramanga.gov.co',
      twitter: 'https://x.com/TransitoBGA',
      facebook: 'https://www.facebook.com/TransitoBucaramanga',
      linea_atencion: '317 434 7156',
      linea_movilidad: '317 434 7156',
    },
  },

  // === CARTAGENA ===
  {
    slug: 'cartagena',
    nombre: 'Cartagena',
    departamento: 'Bolívar',
    coordenadas: [10.3910, -75.4794],
    autoridad: 'DATT — Departamento Administrativo de Tránsito y Transporte',
    autoridad_web: 'https://www.transitocartagena.gov.co',
    autoridad_twitter: 'DattCartagena',
    decreto_actual: 'Decreto 0015 del 14 de enero de 2026',
    fecha_ultima_actualizacion: HOY,
    vigencia_desde: '2026-01-16',
    vigencia_hasta: '2027-01-04',
    notas_generales: [
      'Cartagena tiene pico y placa para particulares, motos y taxis.',
      'Los dígitos rotan cada trimestre aproximadamente.',
      'Las motos tienen restricción extendida de 5:00 a.m. a 11:00 p.m.',
      'En temporada alta (dic-ene) se aplica pico y placa de 24 horas.',
    ],
    exenciones_generales: [
      'Vehículos de emergencia',
      'Vehículos oficiales',
      'Conductores de motos con permiso nocturno del DATT',
    ],
    vias_exentas: [],
    sanciones: {
      tipo_multa: 'Tipo C',
      base_legal: 'Artículo 131, literal C, numeral 14 de la Ley 769 de 2002',
      valor_smldv: '15 SMLDV',
      valor_aproximado_pesos: 633111,
      incluye_inmovilizacion: true,
      descripcion: 'Multa de $633.111 COP más inmovilización del vehículo y costos de grúa.',
    },
    vehiculos: {
      particulares: {
        aplica: true,
        descripcion: 'Vehículos particulares',
        criterio_placa: 'ultimo_digito',
        modalidad: 'semanal_por_dia',
        horario_inicio: '07:00',
        horario_fin: '09:00',
        horario_texto: '7:00-9:00 a.m. y 6:00-8:00 p.m. (dos franjas)',
        dias_aplicables: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
        aplica_festivos: false,
        aplica_fines_de_semana: false,
        rotacion: {
          lunes: [7, 8],
          martes: [9, 0],
          miercoles: [1, 2],
          jueves: [3, 4],
          viernes: [5, 6],
        },
        aplican_vias_exentas: false,
        nota_especial: 'Periodo 2 (30 mar - 27 jun 2026). Los dígitos rotan cada trimestre.',
      },
      motos: {
        aplica: true,
        descripcion: 'Motocicletas — horario extendido, mismo esquema de dígitos',
        criterio_placa: 'ultimo_digito',
        modalidad: 'semanal_por_dia',
        horario_inicio: '05:00',
        horario_fin: '23:00',
        horario_texto: '5:00 a.m. a 11:00 p.m. (horario extendido)',
        dias_aplicables: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
        aplica_festivos: false,
        aplica_fines_de_semana: false,
        rotacion: {
          lunes: [7, 8],
          martes: [9, 0],
          miercoles: [1, 2],
          jueves: [3, 4],
          viernes: [5, 6],
        },
        aplican_vias_exentas: false,
        nota_especial: 'Motos prohibidas en Centro, San Diego, La Matuna y Getsemaní. Restricción nocturna 11pm-5am en toda la ciudad.',
      },
      taxis: {
        aplica: true,
        descripcion: 'Taxis — restricción de 24 horas por dígito, lunes a viernes',
        criterio_placa: 'ultimo_digito',
        modalidad: 'semanal_por_dia',
        horario_inicio: '06:00',
        horario_fin: '06:00',
        horario_texto: '24 horas (6:00 a.m. a 6:00 a.m. del siguiente día)',
        dias_aplicables: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
        aplica_festivos: false,
        aplica_fines_de_semana: false,
        rotacion: {
          lunes: [1, 2],
          martes: [3, 4],
          miercoles: [5, 6],
          jueves: [7, 8],
          viernes: [9, 0],
        },
        aplican_vias_exentas: false,
        nota_especial: 'Rotación 30 mar - 24 abr 2026. Los taxis tienen restricción de 24 horas.',
      },
      transporte_carga: {
        aplica: false,
        descripcion: 'No hay pico y placa específico para transporte de carga en Cartagena.',
      },
    },
    contacto_ciudadano: {
      sitio_web_general: 'https://www.cartagena.gov.co',
      secretaria_movilidad: 'https://www.transitocartagena.gov.co',
      twitter: 'https://x.com/DattCartagena',
      facebook: 'https://www.facebook.com/DattCartagena',
      linea_atencion: '(605) 660 0977',
      linea_movilidad: '(605) 660 0977',
    },
  },
];

// === VALLE DE ABURRÁ (comparten decreto de Medellín) ===
const valleDeAburra = [
  { slug: 'bello', nombre: 'Bello', coords: [6.3373, -75.5582] as [number, number] },
  { slug: 'envigado', nombre: 'Envigado', coords: [6.1659, -75.5840] as [number, number] },
  { slug: 'itagui', nombre: 'Itagüí', coords: [6.1744, -75.6119] as [number, number] },
  { slug: 'sabaneta', nombre: 'Sabaneta', coords: [6.1515, -75.6160] as [number, number] },
  { slug: 'la-estrella', nombre: 'La Estrella', coords: [6.1583, -75.6444] as [number, number] },
  { slug: 'caldas', nombre: 'Caldas', coords: [6.0915, -75.6361] as [number, number] },
  { slug: 'copacabana', nombre: 'Copacabana', coords: [6.3460, -75.5080] as [number, number] },
  { slug: 'girardota', nombre: 'Girardota', coords: [6.3790, -75.4440] as [number, number] },
  { slug: 'barbosa', nombre: 'Barbosa', coords: [6.4389, -75.3319] as [number, number] },
];

for (const va of valleDeAburra) {
  ciudades.push({
    slug: va.slug,
    nombre: va.nombre,
    departamento: 'Antioquia',
    coordenadas: va.coords,
    autoridad: 'Secretaría de Movilidad de Medellín (Decreto metropolitano)',
    autoridad_web: 'https://www.medellin.gov.co/es/secretaria-de-movilidad/',
    autoridad_twitter: 'sttmed',
    decreto_actual: 'Decreto 0184 de 2026 (metropolitano)',
    fecha_ultima_actualizacion: HOY,
    vigencia_desde: '2026-02-02',
    vigencia_hasta: '2026-07-31',
    notas_generales: [
      `${va.nombre} comparte el decreto de pico y placa con Medellín y los 10 municipios del Valle de Aburrá.`,
      'Aplica la misma rotación, horarios y exenciones que Medellín.',
      'No aplica en días festivos oficiales ni en corregimientos.',
    ],
    exenciones_generales: [
      'Vehículos eléctricos (cero emisiones) registrados en RUNT',
      'Vehículos híbridos registrados en RUNT',
      'Vehículos a gas natural vehicular registrados en RUNT',
      'Motos dedicadas a domicilios o mensajería',
    ],
    vias_exentas: [
      'Sistema Vial del Río: Autopista Sur, Avenida Regional y Avenida Paralela',
      'Avenida Las Palmas',
      'Avenida 33',
      'Calle 10',
      'Laterales de la quebrada La Iguaná',
    ],
    sanciones: {
      tipo_multa: 'Tipo C',
      base_legal: 'Artículo 131, literal C, numeral 14 de la Ley 769 de 2002',
      valor_smldv: '15 SMLDV',
      valor_aproximado_pesos: 711750,
      incluye_inmovilizacion: true,
      descripcion: 'Multa equivalente a 15 SMLDV más inmovilización del vehículo.',
    },
    vehiculos: {
      particulares: {
        aplica: true,
        descripcion: 'Automóviles, camionetas, camperos de servicio particular y oficial',
        criterio_placa: 'ultimo_digito',
        modalidad: 'semanal_por_dia',
        horario_inicio: '05:00',
        horario_fin: '20:00',
        horario_texto: '5:00 a.m. a 8:00 p.m. (continuo)',
        dias_aplicables: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
        aplica_festivos: false,
        aplica_fines_de_semana: false,
        rotacion: { lunes: [1, 7], martes: [0, 3], miercoles: [4, 6], jueves: [5, 9], viernes: [2, 8] },
        aplican_vias_exentas: true,
      },
      motos: {
        aplica: true,
        descripcion: 'Motocicletas (excepto las dedicadas a domicilios o mensajería)',
        criterio_placa: 'primer_digito',
        modalidad: 'semanal_por_dia',
        horario_inicio: '05:00',
        horario_fin: '20:00',
        horario_texto: '5:00 a.m. a 8:00 p.m. (continuo)',
        dias_aplicables: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
        aplica_festivos: false,
        aplica_fines_de_semana: false,
        rotacion: { lunes: [1, 7], martes: [0, 3], miercoles: [4, 6], jueves: [5, 9], viernes: [2, 8] },
        aplican_vias_exentas: true,
      },
      taxis: {
        aplica: false,
        descripcion: 'Los taxis en el Valle de Aburrá tienen restricción quincenal — consultar en /medellin/taxis para calendario detallado.',
      },
      transporte_carga: {
        aplica: false,
        descripcion: 'No aplica pico y placa para transporte de carga.',
      },
    },
    contacto_ciudadano: {
      sitio_web_general: 'https://www.medellin.gov.co',
      secretaria_movilidad: 'https://www.medellin.gov.co/es/secretaria-de-movilidad/',
      twitter: 'https://x.com/sttmed',
      facebook: 'https://www.facebook.com/sttmed',
      linea_atencion: '(604) 385 55 55',
      linea_movilidad: '123',
    },
  });
}

// === OTRAS CIUDADES (con datos mínimos o pendiente_verificar) ===
interface CiudadMinima {
  slug: string;
  nombre: string;
  departamento: string;
  coords: [number, number];
  autoridad: string;
  web: string;
  tienePyp: boolean;
  notas?: string[];
}

const otrasCiudades: CiudadMinima[] = [
  { slug: 'cucuta', nombre: 'Cúcuta', departamento: 'Norte de Santander', coords: [7.8939, -72.5078], autoridad: 'Secretaría de Tránsito de Cúcuta', web: 'https://www.cucuta.gov.co', tienePyp: true, notas: ['Pico y placa para particulares y motos. Pendiente verificar rotación 2026.'] },
  { slug: 'ibague', nombre: 'Ibagué', departamento: 'Tolima', coords: [4.4389, -75.2322], autoridad: 'Secretaría de Movilidad de Ibagué', web: 'https://www.ibague.gov.co', tienePyp: true, notas: ['Pico y placa para particulares. Pendiente verificar rotación 2026.'] },
  { slug: 'villavicencio', nombre: 'Villavicencio', departamento: 'Meta', coords: [4.1420, -73.6266], autoridad: 'Secretaría de Movilidad de Villavicencio', web: 'https://www.villavicencio.gov.co', tienePyp: true, notas: ['Pico y placa para particulares. Pendiente verificar rotación 2026.'] },
  { slug: 'pasto', nombre: 'Pasto', departamento: 'Nariño', coords: [1.2136, -77.2811], autoridad: 'Secretaría de Tránsito de Pasto', web: 'https://www.pasto.gov.co', tienePyp: true, notas: ['Pico y placa para particulares. Pendiente verificar rotación 2026.'] },
  { slug: 'manizales', nombre: 'Manizales', departamento: 'Caldas', coords: [5.0689, -75.5174], autoridad: 'Secretaría de Tránsito de Manizales', web: 'https://www.manizales.gov.co', tienePyp: true, notas: ['Pico y placa para particulares. Pendiente verificar rotación 2026.'] },
  { slug: 'pereira', nombre: 'Pereira', departamento: 'Risaralda', coords: [4.8143, -75.6946], autoridad: 'Instituto de Movilidad de Pereira', web: 'https://www.pereira.gov.co', tienePyp: true, notas: ['Pico y placa para particulares. Pendiente verificar rotación 2026.'] },
  { slug: 'armenia', nombre: 'Armenia', departamento: 'Quindío', coords: [4.5339, -75.6811], autoridad: 'Secretaría de Tránsito de Armenia', web: 'https://www.armenia.gov.co', tienePyp: true, notas: ['Pico y placa para particulares. Pendiente verificar rotación 2026.'] },
  { slug: 'santa-marta', nombre: 'Santa Marta', departamento: 'Magdalena', coords: [11.2408, -74.1990], autoridad: 'Secretaría Distrital de Movilidad', web: 'https://www.santamarta.gov.co', tienePyp: true, notas: ['Pico y placa para particulares. Pendiente verificar rotación 2026.'] },
  { slug: 'popayan', nombre: 'Popayán', departamento: 'Cauca', coords: [2.4448, -76.6147], autoridad: 'Secretaría de Tránsito de Popayán', web: 'https://www.popayan.gov.co', tienePyp: true, notas: ['Pico y placa para particulares. Pendiente verificar rotación 2026.'] },
  { slug: 'tunja', nombre: 'Tunja', departamento: 'Boyacá', coords: [5.5353, -73.3678], autoridad: 'Secretaría de Tránsito de Tunja', web: 'https://www.tunja.gov.co', tienePyp: false, notas: ['Tunja no tiene pico y placa vigente para 2026.'] },
  { slug: 'soacha', nombre: 'Soacha', departamento: 'Cundinamarca', coords: [4.5875, -74.2142], autoridad: 'Secretaría de Movilidad de Soacha', web: 'https://www.soacha-cundinamarca.gov.co', tienePyp: true, notas: ['Aplica pico y placa regional de Bogotá para vehículos que entran a la capital.'] },
  { slug: 'palmira', nombre: 'Palmira', departamento: 'Valle del Cauca', coords: [3.5394, -76.3036], autoridad: 'Secretaría de Movilidad de Palmira', web: 'https://www.palmira.gov.co', tienePyp: true, notas: ['Pico y placa para particulares. Pendiente verificar rotación 2026.'] },
  { slug: 'dosquebradas', nombre: 'Dosquebradas', departamento: 'Risaralda', coords: [4.8333, -75.6667], autoridad: 'Secretaría de Tránsito de Dosquebradas', web: 'https://www.dosquebradas.gov.co', tienePyp: false, notas: ['Dosquebradas no tiene pico y placa propio. Puede aplicar restricciones de Pereira.'] },
  { slug: 'rionegro', nombre: 'Rionegro', departamento: 'Antioquia', coords: [6.1551, -75.3742], autoridad: 'Secretaría de Movilidad de Rionegro', web: 'https://www.rionegro.gov.co', tienePyp: false, notas: ['Rionegro no tiene pico y placa para 2026.'] },
  { slug: 'fusagasuga', nombre: 'Fusagasugá', departamento: 'Cundinamarca', coords: [4.3437, -74.3652], autoridad: 'Secretaría de Movilidad de Fusagasugá', web: 'https://www.fusagasuga-cundinamarca.gov.co', tienePyp: false, notas: ['Fusagasugá no tiene pico y placa vigente.'] },
  { slug: 'buenaventura', nombre: 'Buenaventura', departamento: 'Valle del Cauca', coords: [3.8801, -77.0312], autoridad: 'Secretaría de Tránsito de Buenaventura', web: 'https://www.buenaventura.gov.co', tienePyp: false, notas: ['Buenaventura no tiene pico y placa vigente.'] },
  { slug: 'ipiales', nombre: 'Ipiales', departamento: 'Nariño', coords: [0.8278, -77.6386], autoridad: 'Secretaría de Tránsito de Ipiales', web: 'https://www.ipiales-narino.gov.co', tienePyp: false, notas: ['Ipiales no tiene pico y placa vigente.'] },
  { slug: 'ocana', nombre: 'Ocaña', departamento: 'Norte de Santander', coords: [8.2369, -73.3581], autoridad: 'Secretaría de Tránsito de Ocaña', web: 'https://www.ocana-nortedesantander.gov.co', tienePyp: false, notas: ['Ocaña no tiene pico y placa vigente.'] },
  { slug: 'pamplona', nombre: 'Pamplona', departamento: 'Norte de Santander', coords: [7.3753, -72.6477], autoridad: 'Secretaría de Tránsito de Pamplona', web: 'https://www.pamplona-nortedesantander.gov.co', tienePyp: false, notas: ['Pamplona no tiene pico y placa vigente.'] },
  { slug: 'quibdo', nombre: 'Quibdó', departamento: 'Chocó', coords: [5.6947, -76.6583], autoridad: 'Secretaría de Tránsito de Quibdó', web: 'https://www.quibdo-choco.gov.co', tienePyp: false, notas: ['Quibdó no tiene pico y placa vigente.'] },
  { slug: 'santa-cruz-de-lorica', nombre: 'Santa Cruz de Lorica', departamento: 'Córdoba', coords: [9.2389, -75.8144], autoridad: 'Alcaldía de Lorica', web: 'https://www.santacruzdelorica-cordoba.gov.co', tienePyp: false, notas: ['Lorica no tiene pico y placa vigente.'] },
  { slug: 'malambo', nombre: 'Malambo', departamento: 'Atlántico', coords: [10.8689, -74.7733], autoridad: 'Alcaldía de Malambo', web: 'https://www.malambo-atlantico.gov.co', tienePyp: false, notas: ['Malambo no tiene pico y placa vigente.'] },
  { slug: 'soledad', nombre: 'Soledad', departamento: 'Atlántico', coords: [10.9172, -74.7664], autoridad: 'Secretaría de Tránsito de Soledad', web: 'https://www.soledad-atlantico.gov.co', tienePyp: false, notas: ['Soledad no tiene pico y placa vigente.'] },
  { slug: 'turbaco', nombre: 'Turbaco', departamento: 'Bolívar', coords: [10.3311, -75.4122], autoridad: 'Alcaldía de Turbaco', web: 'https://www.turbaco-bolivar.gov.co', tienePyp: false, notas: ['Turbaco no tiene pico y placa vigente.'] },
];

// Generar JSONs para ciudades menores
for (const c of otrasCiudades) {
  const sinPyp = !c.tienePyp;
  ciudades.push({
    slug: c.slug,
    nombre: c.nombre,
    departamento: c.departamento,
    coordenadas: c.coords,
    autoridad: c.autoridad,
    autoridad_web: c.web,
    decreto_actual: sinPyp ? 'No aplica' : 'pendiente_verificar',
    fecha_ultima_actualizacion: HOY,
    notas_generales: c.notas ?? [],
    exenciones_generales: [],
    vias_exentas: [],
    sanciones: {
      descripcion: sinPyp
        ? `${c.nombre} no tiene pico y placa vigente.`
        : 'Multa equivalente a 15 SMLDV más inmovilización del vehículo.',
      base_legal: 'Artículo 131, literal C, numeral 14 de la Ley 769 de 2002',
    },
    vehiculos: {
      particulares: sinPyp
        ? { aplica: false, descripcion: `${c.nombre} no tiene pico y placa para vehículos particulares.` }
        : { aplica: true, horario: 'pendiente_verificar', dias_habiles: ['lun','mar','mie','jue','vie'], aplica_festivos: false, restricciones: { lunes: ['pendiente_verificar'], martes: ['pendiente_verificar'], miercoles: ['pendiente_verificar'], jueves: ['pendiente_verificar'], viernes: ['pendiente_verificar'] }, notas: 'pendiente_verificar' },
      motos: sinPyp
        ? { aplica: false, descripcion: `No hay pico y placa para motos en ${c.nombre}.` }
        : { aplica: true, horario: 'pendiente_verificar', dias_habiles: ['lun','mar','mie','jue','vie'], aplica_festivos: false, restricciones: { lunes: ['pendiente_verificar'], martes: ['pendiente_verificar'], miercoles: ['pendiente_verificar'], jueves: ['pendiente_verificar'], viernes: ['pendiente_verificar'] }, notas: 'pendiente_verificar' },
      taxis: { aplica: false, descripcion: `Pendiente verificar restricciones de taxis en ${c.nombre}.` },
      transporte_carga: { aplica: false, descripcion: `Pendiente verificar restricciones de carga en ${c.nombre}.` },
    },
    contacto_ciudadano: {
      sitio_web_general: c.web,
      secretaria_movilidad: c.web,
      twitter: '',
      facebook: '',
      linea_atencion: 'pendiente_verificar',
      linea_movilidad: 'pendiente_verificar',
    },
  });
}

// === ESCRIBIR ARCHIVOS ===
const dir = resolve('src/data/ciudades');
let creados = 0;
let actualizados = 0;

for (const c of ciudades) {
  const ruta = resolve(dir, `${c.slug}.json`);
  const existe = existsSync(ruta);
  writeFileSync(ruta, JSON.stringify(c, null, 2) + '\n', 'utf-8');
  if (existe) { actualizados++; } else { creados++; }
  console.log(`${existe ? '🔄' : '✅'} ${c.slug}.json — ${c.nombre}`);
}

console.log(`\n📊 Resumen: ${creados} nuevos, ${actualizados} actualizados, ${ciudades.length} total`);
