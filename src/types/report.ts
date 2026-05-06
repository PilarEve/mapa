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
