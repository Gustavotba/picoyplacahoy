/** Días de la semana usados como claves en rotaciones */
export type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';

/** Tipos de vehículo soportados en el MVP */
export type TipoVehiculo = 'particulares' | 'motos' | 'taxis' | 'transporte_carga';

/** Modalidad de restricción */
export type Modalidad = 'semanal_por_dia' | 'quincenal_por_fecha' | 'par_impar_por_fecha';

/** Criterio para determinar qué dígito de la placa aplica */
export type CriterioPlaca = 'ultimo_digito' | 'primer_digito';

/** Etiquetas legibles para cada tipo de vehículo */
export const ETIQUETAS_VEHICULO: Record<TipoVehiculo, string> = {
  particulares: 'Particulares',
  motos: 'Motos',
  taxis: 'Taxis',
  transporte_carga: 'Transporte de Carga',
};

/** Íconos SVG disponibles para cada tipo de vehículo */
export const ICONOS_VEHICULO: Record<TipoVehiculo, string> = {
  particulares: '/iconos/carro.svg',
  motos: '/iconos/moto.svg',
  taxis: '/iconos/taxi.svg',
  transporte_carga: '/iconos/camion.svg',
};

/** Vehículo con restricción semanal por día de la semana (particulares, motos) */
export interface VehiculoSemanalPorDia {
  aplica: true;
  descripcion: string;
  criterio_placa: CriterioPlaca;
  modalidad: 'semanal_por_dia';
  horario_inicio: string;
  horario_fin: string;
  horario_texto: string;
  dias_aplicables: DiaSemana[];
  aplica_festivos: boolean;
  aplica_fines_de_semana: boolean;
  rotacion: Partial<Record<DiaSemana, number[]>>;
  aplican_vias_exentas?: boolean;
}

/** Vehículo con restricción quincenal por fechas específicas (taxis) */
export interface VehiculoQuincenalPorFecha {
  aplica: true;
  descripcion: string;
  criterio_placa: CriterioPlaca;
  modalidad: 'quincenal_por_fecha';
  horario_inicio: string;
  horario_fin: string;
  horario_texto: string;
  dias_aplicables: DiaSemana[];
  aplica_festivos: boolean;
  aplica_fines_de_semana: boolean;
  aplican_vias_exentas?: boolean;
  nota_especial?: string;
  fechas_restriccion: Record<string, string[]>;
  fechas_pendientes_confirmar?: string[];
}

/** Vehículo con restricción según la paridad del día del mes (Bogotá, Turbaco) */
export interface VehiculoParImparPorFecha {
  aplica: true;
  descripcion: string;
  criterio_placa: CriterioPlaca;
  modalidad: 'par_impar_por_fecha';
  horario_inicio: string;
  horario_fin: string;
  horario_texto: string;
  dias_aplicables: DiaSemana[];
  aplica_festivos: boolean;
  aplica_fines_de_semana: boolean;
  aplican_vias_exentas?: boolean;
  nota_especial?: string;
  /** Dígitos RESTRINGIDOS (los que no pueden circular) según la paridad de la fecha */
  regla_par_impar: {
    fecha_impar: number[];
    fecha_par: number[];
  };
}

/** Vehículo sin restricción vigente (ej: transporte de carga en Medellín) */
export interface VehiculoSinRestriccion {
  aplica: false;
  descripcion: string;
  nota?: string;
}

/** Formato placeholder para ciudades sin datos verificados */
export interface VehiculoPlaceholder {
  aplica: boolean;
  horario: string;
  dias_habiles: string[];
  aplica_festivos: boolean;
  restricciones: Partial<Record<DiaSemana, string[]>>;
  notas: string;
}

/** Unión de todos los formatos posibles de vehículo */
export type InfoVehiculo =
  | VehiculoSemanalPorDia
  | VehiculoQuincenalPorFecha
  | VehiculoParImparPorFecha
  | VehiculoSinRestriccion
  | VehiculoPlaceholder;

/** Type guard: vehículo en formato placeholder (ciudades sin datos reales) */
export function esPlaceholder(v: InfoVehiculo): v is VehiculoPlaceholder {
  return 'restricciones' in v;
}

/** Type guard: vehículo con modalidad semanal por día */
export function esSemanalPorDia(v: InfoVehiculo): v is VehiculoSemanalPorDia {
  return 'modalidad' in v && (v as VehiculoSemanalPorDia).modalidad === 'semanal_por_dia';
}

/** Type guard: vehículo con modalidad quincenal por fecha */
export function esQuincenalPorFecha(v: InfoVehiculo): v is VehiculoQuincenalPorFecha {
  return 'modalidad' in v && (v as VehiculoQuincenalPorFecha).modalidad === 'quincenal_por_fecha';
}

/** Type guard: vehículo con modalidad par/impar por fecha */
export function esParImparPorFecha(v: InfoVehiculo): v is VehiculoParImparPorFecha {
  return 'modalidad' in v && (v as VehiculoParImparPorFecha).modalidad === 'par_impar_por_fecha';
}

/** Type guard: vehículo sin restricción */
export function esSinRestriccion(v: InfoVehiculo): v is VehiculoSinRestriccion {
  return !v.aplica && !('restricciones' in v) && !('modalidad' in v);
}

/** Sanciones detalladas */
export interface Sanciones {
  descripcion: string;
  base_legal: string;
  tipo_multa?: string;
  valor_smldv?: string;
  valor_uvb?: string;
  valor_aproximado_pesos?: number;
  incluye_inmovilizacion?: boolean;
}

/** Contacto ciudadano */
export interface ContactoCiudadano {
  sitio_web_general: string;
  secretaria_movilidad: string;
  twitter: string;
  facebook: string;
  linea_atencion: string;
  linea_movilidad: string;
}

/** Tarifas base del Pico y Placa Solidario */
export interface TarifasSolidario {
  diario: number;
  mensual: number;
  semestral: number;
  moneda: 'COP';
  fecha_actualizacion: string;
  nota: string;
}

/** Factores multiplicadores del Pico y Placa Solidario */
export interface FactoresMultiplicadores {
  descripcion: string;
  detalles: string[];
}

/** Pico y Placa Solidario (permiso pagado) */
export interface PicoYPlacaSolidario {
  existe: true;
  nombre_oficial: string;
  descripcion: string;
  autoridad: string;
  resolucion: string;
  sitio_oficial: string;
  tarifas_base: TarifasSolidario;
  factores_multiplicadores: FactoresMultiplicadores;
  requisitos: string[];
  excepciones_gratis: string[];
  destino_recaudo: string;
  notas_adicionales?: string[];
}

/** Ciudad sin Pico y Placa Solidario */
export interface SinPicoYPlacaSolidario {
  existe: false;
}

/** Afectación regional (Soacha, Fusagasugá — sin PyP propio pero afectados por Bogotá) */
export interface AfectacionRegional {
  titulo: string;
  autoridad: string;
  descripcion: string;
  aplicacion: string;
  enlace_ciudad?: string;
}

/** Novedad destacada para el año vigente */
export interface NovedadAnual {
  titulo: string;
  descripcion: string;
  pronunciamiento?: string;
}

/** Pico y Color (Soledad — motocarros por color) */
export interface PicoYColor {
  aplica_a: string[];
  descripcion: string;
  norma: string;
  colores: Array<{ color: string; placas: string }>;
}

/** Restricción diferenciada por origen de matrícula (Ocaña) */
export interface RestriccionPorMatricula {
  local: {
    franjas_horarias: string[];
    nota?: string;
  };
  foranea: {
    franjas_horarias: string[];
    nota?: string;
  };
}

/** Jornada especial (Villavicencio y otras) */
export interface JornadaEspecial {
  fecha: string;
  nombre: string;
  descripcion?: string;
}

/** Infográfico oficial de la autoridad, que el usuario puede usar para verificar el dato */
export interface ImagenOficial {
  /** Ruta dentro de /public */
  archivo: string;
  titulo: string;
  /** Tipos de vehículo a los que corresponde. Si se omite, aplica a todos. */
  tipos?: TipoVehiculo[];
  /** Página oficial de donde se descargó */
  fuente_url: string;
  fuente_nombre: string;
  ancho: number;
  alto: number;
}

/** Estructura completa de una ciudad */
export interface Ciudad {
  slug: string;
  nombre: string;
  departamento: string;
  autoridad: string;
  autoridad_web: string;
  autoridad_twitter: string;
  autoridad_facebook?: string;
  coordenadas?: [number, number];
  decreto_actual: string;
  fecha_ultima_actualizacion: string;
  vigencia_desde?: string;
  vigencia_hasta?: string;
  notas_generales?: string[];
  exenciones_generales?: string[];
  vias_exentas?: string[];
  imagenes_oficiales?: ImagenOficial[];
  sanciones: Sanciones;
  vehiculos: Record<TipoVehiculo, InfoVehiculo>;
  contacto_ciudadano?: ContactoCiudadano;
  pico_y_placa_solidario?: PicoYPlacaSolidario | SinPicoYPlacaSolidario;
  afectacion_regional?: AfectacionRegional;
  novedad_2026?: NovedadAnual;
  pico_y_color?: PicoYColor;
  restriccion_por_matricula?: RestriccionPorMatricula;
  jornadas_especiales?: JornadaEspecial[];
  dias_sin_moto?: string[];
  suspensiones_anuales?: string[];
  rotacion_variable?: boolean;
  pyp_ambiental_relacionado?: {
    nombre: string;
    autoridad: string;
    descripcion: string;
    norma?: string;
    url_mas_info?: string;
  };
}

/** Resultado del motor de cálculo para un vehículo en una fecha */
export interface ResultadoPicoPlaca {
  aplica: boolean;
  esFestivo: boolean;
  esDiaHabil: boolean;
  esPendiente: boolean;
  datosDesactualizados: boolean;
  placasRestringidas: number[];
  horarioTexto: string;
  criterioPlaca?: CriterioPlaca;
  descripcionVehiculo?: string;
  mensaje: string;
}
