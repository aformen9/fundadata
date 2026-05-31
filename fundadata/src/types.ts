export interface Persona {
  dni: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  sexo: string;
  barrio: string;
}

export interface Dispositivo {
  id: number;
  nombre: string;
  tipo: 'ninez' | 'dia';
}

export type EstadoVinculo = 'activo' | 'egresado' | 'inasistencia_prolongada';

export interface Vinculo {
  id: number;
  dni: string;
  dispositivo_id: number;
  fecha_alta: string;
  fecha_baja: string | null;
  estado: EstadoVinculo;
  motivo_egreso: string | null;
}

export interface FichaNinez {
  vinculo_id: number;
  escolarizado: boolean;
  discapacidad: boolean;
  referenciado_salud: boolean;
  consumo_activo: boolean;
  violencia_familiar: boolean;
  observaciones: string; // Will store JSON of FichaNinezObservaciones
}

export interface FichaNinezObservaciones {
  ano_escolar?: string;
  // Conditional Consumption Fields
  consumo_sustancias?: string;
  consumo_contexto?: string;
  consumo_familiar?: string;
  // Conditional Violence Fields
  violencia_detalle?: string;
  // Custom free text observations
  texto_libre?: string;
}

export interface FichaDia {
  vinculo_id: number;
  tiene_cud: boolean;
  limitacion_permanente: string;
  nivel_educativo: string;
  situacion_habitacional: string;
  consumo_activo: boolean;
  violencia_familiar: boolean;
  observaciones: string; // Will store JSON of FichaDiaObservaciones
}

export interface FichaDiaObservaciones {
  condicion_actual?: string;
  // Conditional Consumption Fields
  consumo_sustancias?: string;
  consumo_contexto?: string;
  consumo_familiar?: string;
  // Conditional Violence Fields
  violencia_detalle?: string;
  // Custom free text observations
  texto_libre?: string;
}

export interface UserRole {
  id: number;
  user_id: string;
  role: 'operador' | 'fundacion';
  dispositivo_id: number | null;
}

export interface HistorialSeguimiento {
  id: number;
  vinculo_id: number;
  timestamp: string;
  campo_modificado: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  user_id: string | null;
  // Joined fields for display
  operador_email?: string;
}

export interface Tutor {
  id: number;
  nombre: string;
  telefono: string;
  dni_nino: string;
}

export interface RegistroAsistencia {
  id: number;
  dni: string;
  dispositivo_id: number;
  fecha: string;
  presente: boolean;
  registrado_por: string | null;
}

// Complete profile object for easy handling in the app
export interface PersonaCompleta {
  persona: Persona;
  vinculo: Vinculo;
  dispositivo: Dispositivo;
  fichaNinez?: FichaNinez;
  fichaDia?: FichaDia;
}
