export type Severity = 'bajo' | 'medio' | 'alto' | 'critico';

export interface Report {
  id: string;
  lat: number;
  lng: number;
  description: string;
  severity: Severity;
  dateTime: string;
  imageUrl?: string;
  status: 'pendiente' | 'validado' | 'rechazado';
}

export interface NoticiaHistorica {
  id: string | number;
  latitud: number;
  longitud: number;
  titulo: string;
  fuente: string;
  fecha_publicacion: string;
  ubicacion_texto: string;
  tipo_evento: string;
  gravedad: string;
  url?: string;
  creado_en?: string;
}
