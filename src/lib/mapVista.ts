/** Categoría visible en el mapa. Única fuente de verdad: el parámetro `vista` de la URL. */
export type MapVista = 'todos' | 'reportes' | 'noticias';

export const MAP_VISTAS: { value: MapVista; label: string; href: string }[] = [
  { value: 'todos', label: 'Todos los registros', href: '/mapa' },
  { value: 'reportes', label: 'Reportes ciudadanos', href: '/mapa?vista=reportes' },
  { value: 'noticias', label: 'Noticias históricas', href: '/mapa?vista=noticias' },
];

/** Cualquier valor ausente o desconocido equivale a la vista general. */
export function parseVista(value: string | null | undefined): MapVista {
  return value === 'reportes' || value === 'noticias' ? value : 'todos';
}

