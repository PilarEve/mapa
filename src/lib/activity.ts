import type { NoticiaHistorica, Report } from '../types/report';

/** Margen de autopan de los popups: deja libre la parte del mapa cubierta por el buscador flotante. */
export const POPUP_AUTOPAN_PADDING_TOP_LEFT: [number, number] = [5, 84];

interface ActivityBase {
  /** Identificador único entre tipos: un reporte y una noticia podrían compartir id. */
  key: string;
  lat: number;
  lng: number;
  date: Date | null;
}

export type ActivityItem =
  | (ActivityBase & { kind: 'reporte'; report: Report })
  | (ActivityBase & { kind: 'noticia'; news: NoticiaHistorica });

/**
 * Convierte un valor de fecha, o devuelve null si falta o es inválido.
 * Las fechas sin hora se toman en la zona local: new Date('2026-03-10') sería medianoche
 * UTC, que en Paraguay todavía es el día anterior.
 */
export function parseDateValue(value: string | null | undefined): Date | null {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dateOnly) {
    const [year, month, day] = dateOnly.slice(1).map(Number);
    const date = new Date(year, month - 1, day);
    return date.getMonth() === month - 1 ? date : null;
  }
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

/** Las tablas históricas no tienen fecha del acontecimiento: se usa la de publicación, nunca creado_en. */
export const getNewsDate = (news: NoticiaHistorica) => parseDateValue(news.fecha_publicacion);

export const getReportDate = (report: Report) => parseDateValue(report.dateTime);

/** Con un rango activo, un registro sin fecha válida no coincide. */
export function matchesDateRange(date: Date | null, range: string, now: Date = new Date()): boolean {
  if (range === 'todo') return true;
  if (!date) return false;
  if (range === 'hoy') {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    return date >= startOfToday;
  }
  if (range === '7dias') return date.getTime() >= now.getTime() - 7 * 24 * 60 * 60 * 1000;
  if (range === '30dias') return date.getTime() >= now.getTime() - 30 * 24 * 60 * 60 * 1000;
  return true;
}

/** Une reportes y noticias, de más reciente a más antiguo. Los que no tienen fecha van al final. */
export function buildActivityItems(reports: Report[], news: NoticiaHistorica[]): ActivityItem[] {
  const items: ActivityItem[] = [
    ...reports.map((report): ActivityItem => ({
      kind: 'reporte',
      key: `reporte-${report.id}`,
      lat: report.lat,
      lng: report.lng,
      date: getReportDate(report),
      report,
    })),
    ...news.map((noticia): ActivityItem => ({
      kind: 'noticia',
      key: `noticia-${noticia.id}`,
      lat: noticia.latitud,
      lng: noticia.longitud,
      date: getNewsDate(noticia),
      news: noticia,
    })),
  ];

  return items.sort((a, b) => {
    const dateA = a.date?.getTime() ?? -Infinity;
    const dateB = b.date?.getTime() ?? -Infinity;
    if (dateA !== dateB) return dateB > dateA ? 1 : -1;
    return a.key.localeCompare(b.key);
  });
}
