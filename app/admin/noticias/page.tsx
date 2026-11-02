import { LogOut, MapPin, Calendar, ExternalLink, FileText, Building2 } from 'lucide-react';
import { requireAdmin } from '@/lib/admin/auth';
import { logout } from '../actions';
import AdminNav from '../AdminNav';
import NoticiaActions from './NoticiaActions';

export const metadata = {
  title: 'Noticias históricas - Panel administrativo',
  robots: { index: false, follow: false },
};

// Siempre dinámico: depende de la sesión.
export const dynamic = 'force-dynamic';

// Columnas verificadas de public.dataset_principal.
interface NoticiaRow {
  id: string;
  evento_id: number | null;
  titulo: string | null;
  descripcion: string | null;
  fuente: string | null;
  fecha_publicacion: string | null;
  latitud: number | string | null;
  longitud: number | string | null;
  ubicacion_texto: string | null;
  ciudad: string | null;
  barrio_zona: string | null;
  tipo_evento: string | null;
  gravedad: string | null;
  imagen_url: string | null;
  url: string | null;
  creado_en: string | null;
  rechazada_en: string | null;
}

interface Listado {
  visibles: number;
  rechazadas: number;
  noticias: NoticiaRow[];
}

type Filtro = 'todas' | 'visibles' | 'rechazadas';

const LIMITE = 500;

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'visibles', label: 'Visibles' },
  { key: 'rechazadas', label: 'Rechazadas' },
];

/** fecha_publicacion es solo fecha: en la zona local se mostraría el día anterior. */
function formatFecha(valor: string | null) {
  if (!valor) return 'Sin fecha';
  const fecha = new Date(valor);
  if (isNaN(fecha.getTime())) return valor;
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium', timeZone: 'UTC' }).format(fecha);
}

function formatMomento(valor: string) {
  return new Intl.DateTimeFormat('es-PY', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Asuncion',
  }).format(new Date(valor));
}

/** Los datos vienen de fuentes externas: solo se enlazan URLs http(s). */
const urlSegura = (url: string | null) => (url && /^https?:\/\//i.test(url) ? url : null);

export default async function NoticiasAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { supabase, user } = await requireAdmin();
  const { filtro: f } = await searchParams;
  const filtro: Filtro = FILTROS.find((e) => e.key === f)?.key ?? 'todas';

  const { data, error } = await supabase.rpc('noticias_admin_listado', {
    p_filtro: filtro,
    p_limite: LIMITE,
  });
  if (error) console.error('[admin/noticias] listado falló', { code: error.code, message: error.message });

  // PGRST202: la función aún no existe en Supabase.
  const sinConfigurar = error?.code === 'PGRST202';
  const listado = error ? null : (data as Listado);
  const noticias = listado?.noticias ?? [];
  const conteo: Record<Filtro, number> = {
    todas: (listado?.visibles ?? 0) + (listado?.rechazadas ?? 0),
    visibles: listado?.visibles ?? 0,
    rechazadas: listado?.rechazadas ?? 0,
  };

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto p-3 sm:p-6 space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Panel administrativo</h1>
            <p className="text-xs text-slate-500 break-all">Sesión: {user.email}</p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <LogOut size={16} /> Cerrar sesión
            </button>
          </form>
        </header>

        <AdminNav activa="noticias" />

        {listado && (
          <nav className="flex flex-wrap gap-2" aria-label="Filtrar noticias">
            {FILTROS.map((e) => (
              <a
                key={e.key}
                href={e.key === 'todas' ? '/admin/noticias' : `/admin/noticias?filtro=${e.key}`}
                aria-current={filtro === e.key ? 'page' : undefined}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                  filtro === e.key
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {e.label} ({conteo[e.key]})
              </a>
            ))}
          </nav>
        )}

        {sinConfigurar && (
          <p role="alert" className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Falta configurar la moderación en Supabase: ejecutar supabase/manual/noticias_moderacion.sql.
          </p>
        )}

        {error && !sinConfigurar && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            No se pudieron cargar las noticias. (código: {error.code ?? 'desconocido'})
          </p>
        )}

        {listado && noticias.length === 0 && (
          <p className="text-sm text-slate-500">No hay noticias para este filtro.</p>
        )}

        {noticias.length < conteo[filtro] && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Se muestran las {noticias.length} más recientes de {conteo[filtro]}.
          </p>
        )}

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {noticias.map((n) => {
            const rechazada = n.rechazada_en !== null;
            const imagen = urlSegura(n.imagen_url);
            const enlace = urlSegura(n.url);
            const zona = [n.barrio_zona, n.ciudad].filter(Boolean).join(', ');
            return (
              <li
                key={n.id}
                className={`bg-white border rounded-2xl overflow-hidden shadow-sm flex flex-col ${
                  rechazada ? 'border-red-200' : 'border-slate-200'
                }`}
              >
                <div className="aspect-video bg-slate-100">
                  {imagen ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imagen} alt="Imagen de la noticia" loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">Sin imagen</div>
                  )}
                </div>

                <div className="p-4 space-y-2 flex-1">
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${
                        rechazada
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {rechazada ? 'Rechazada' : 'Visible'}
                    </span>
                    {n.tipo_evento && (
                      <span className="text-[11px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{n.tipo_evento}</span>
                    )}
                    {n.gravedad && (
                      <span className="text-[11px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{n.gravedad}</span>
                    )}
                  </div>

                  <h2 className="text-sm font-semibold text-slate-800 break-words leading-snug">
                    {n.titulo || 'Sin título'}
                  </h2>

                  {n.descripcion && n.descripcion !== n.titulo && (
                    <p className="text-xs text-slate-600 break-words line-clamp-3">{n.descripcion}</p>
                  )}

                  <div className="text-xs text-slate-500 space-y-1 pt-1">
                    {n.fuente && (
                      <p className="flex items-center gap-1.5">
                        <FileText size={13} className="shrink-0" />
                        <span className="italic">{n.fuente}</span>
                      </p>
                    )}
                    <p className="flex items-center gap-1.5">
                      <Calendar size={13} className="shrink-0" /> {formatFecha(n.fecha_publicacion)}
                    </p>
                    {zona && (
                      <p className="flex items-center gap-1.5">
                        <Building2 size={13} className="shrink-0" /> {zona}
                      </p>
                    )}
                    {n.latitud != null && n.longitud != null && (
                      <p className="flex items-center gap-1.5">
                        <MapPin size={13} className="shrink-0" />
                        <a
                          className="hover:text-blue-600 underline break-words min-w-0"
                          target="_blank"
                          rel="noopener noreferrer"
                          href={`https://www.openstreetmap.org/?mlat=${Number(n.latitud)}&mlon=${Number(n.longitud)}#map=17/${Number(n.latitud)}/${Number(n.longitud)}`}
                        >
                          {n.ubicacion_texto || `${Number(n.latitud).toFixed(5)}, ${Number(n.longitud).toFixed(5)}`}
                        </a>
                      </p>
                    )}
                    {enlace && (
                      <a
                        href={enlace}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-medium"
                      >
                        Ver noticia <ExternalLink size={12} />
                      </a>
                    )}
                    {n.rechazada_en && (
                      <p className="text-red-700">Rechazada el {formatMomento(n.rechazada_en)}</p>
                    )}
                    <p className="text-[11px] text-slate-400">
                      {n.evento_id != null && `Evento ${n.evento_id} · `}
                      {n.creado_en && `Cargada el ${formatMomento(n.creado_en)}`}
                    </p>
                  </div>

                  <NoticiaActions id={String(n.id)} rechazada={rechazada} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
