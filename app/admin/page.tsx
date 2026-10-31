import { LogOut, MapPin, Calendar } from 'lucide-react';
import { requireAdmin } from '@/lib/admin/auth';
import { logout } from './actions';

export const metadata = {
  title: 'Panel administrativo - Venus',
  robots: { index: false, follow: false },
};

// Siempre dinámico: depende de la sesión.
export const dynamic = 'force-dynamic';

type Estado = 'pendiente' | 'validado' | 'rechazado';

interface ReporteRow {
  id: string;
  descripcion: string | null;
  latitud: number | string;
  longitud: number | string;
  imagen_url: string | null;
  archivo_tipo: string | null;
  estado: string | null;
  afectaciones: string[] | null;
  creado_en: string | null;
}

const ESTADOS: { key: Estado | 'todos'; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'validado', label: 'Validados' },
  { key: 'rechazado', label: 'Rechazados' },
];

const BADGE: Record<Estado, string> = {
  pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
  validado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rechazado: 'bg-red-50 text-red-700 border-red-200',
};

function formatDate(iso: string | null) {
  if (!iso) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-PY', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Asuncion',
  }).format(new Date(iso));
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { supabase, user } = await requireAdmin();
  const { estado } = await searchParams;
  const filtro = ESTADOS.find((e) => e.key === estado)?.key ?? 'todos';

  let query = supabase
    .from('reportes')
    .select('id, descripcion, latitud, longitud, imagen_url, archivo_tipo, estado, afectaciones, creado_en')
    .order('creado_en', { ascending: false })
    .limit(200);
  if (filtro !== 'todos') query = query.eq('estado', filtro);

  const { data, error } = await query;
  const reportes = (data ?? []) as ReporteRow[];

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

        <nav className="flex flex-wrap gap-2" aria-label="Filtrar por estado">
          {ESTADOS.map((e) => (
            <a
              key={e.key}
              href={e.key === 'todos' ? '/admin' : `/admin?estado=${e.key}`}
              aria-current={filtro === e.key ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                filtro === e.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
              }`}
            >
              {e.label}
            </a>
          ))}
        </nav>

        {error && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            No se pudieron cargar los reportes.
          </p>
        )}

        {!error && reportes.length === 0 && (
          <p className="text-sm text-slate-500">No hay reportes para este filtro.</p>
        )}

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reportes.map((r) => {
            const est = (r.estado ?? 'pendiente') as Estado;
            return (
              <li key={r.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                <div className="aspect-video bg-slate-100">
                  {r.imagen_url && r.archivo_tipo !== 'video' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imagen_url} alt="Fotografía del reporte" loading="lazy" className="w-full h-full object-cover" />
                  ) : r.imagen_url ? (
                    <video src={r.imagen_url} controls preload="metadata" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">Sin fotografía</div>
                  )}
                </div>
                <div className="p-4 space-y-2 flex-1">
                  <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${BADGE[est] ?? BADGE.pendiente}`}>
                    {est.charAt(0).toUpperCase() + est.slice(1)}
                  </span>
                  <p className="text-sm text-slate-700 break-words">{r.descripcion || 'Sin descripción'}</p>
                  <div className="flex flex-wrap gap-1">
                    {(r.afectaciones ?? []).length > 0 ? (
                      r.afectaciones!.map((a) => (
                        <span key={a} className="text-[11px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{a}</span>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-400">Sin afectaciones</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 space-y-1 pt-1">
                    <p className="flex items-center gap-1.5">
                      <MapPin size={13} />
                      <a
                        className="hover:text-blue-600 underline"
                        target="_blank"
                        rel="noopener noreferrer"
                        href={`https://www.openstreetmap.org/?mlat=${Number(r.latitud)}&mlon=${Number(r.longitud)}#map=17/${Number(r.latitud)}/${Number(r.longitud)}`}
                      >
                        {Number(r.latitud).toFixed(5)}, {Number(r.longitud).toFixed(5)}
                      </a>
                    </p>
                    <p className="flex items-center gap-1.5"><Calendar size={13} /> {formatDate(r.creado_en)}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}

