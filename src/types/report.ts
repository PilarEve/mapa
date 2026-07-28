export interface Report {
  id: string;
  lat: number;
  lng: number;
  description: string;
  impactTags?: string[];
  dateTime: string;
  imageUrl?: string;
  status: 'pendiente' | 'validado' | 'rechazado';
  /** 'imagen' para reportes nuevos. 'video' se mantiene solo por retrocompatibilidad con registros existentes. */
  archivoTipo?: 'imagen' | 'video' | null;
}

export interface NoticiaHistorica {
  id: string | number;
  latitud: number;
  longitud: number;
  titulo: string;
  descripcion?: string;
  fuente: string;
  fecha_publicacion: string;
  ubicacion_texto: string;
  tipo_evento: string;
  gravedad: string;
  imagen_url?: string;
  url?: string;
  creado_en?: string;
}
