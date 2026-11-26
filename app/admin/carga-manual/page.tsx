import { LogOut } from 'lucide-react';
import { requireAdmin } from '@/lib/admin/auth';
import { logout } from '../actions';
import AdminNav from '../AdminNav';
import ManualForm, { type ManualReportInitialData } from '@/components/ManualForm';
import type { OrigenManual } from './actions';

export const metadata = {
  title: 'Carga manual - Panel administrativo',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CargaManualPage({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>;
}) {
  const { supabase, user } = await requireAdmin();
  const { editar } = await searchParams;

  let initialData: ManualReportInitialData | null = null;

  if (editar && UUID_RE.test(editar)) {
    const { data } = await supabase
      .from('reportes_manual')
      .select('id, latitud, longitud, imagen_url, fecha_evento, origen_manual, afectaciones, descripcion')
      .eq('id', editar)
      .maybeSingle();

    if (data) {
      initialData = {
        id: String(data.id),
        latitud: Number(data.latitud),
        longitud: Number(data.longitud),
        imagen_url: String(data.imagen_url),
        fecha_evento: String(data.fecha_evento),
        origen_manual: (data.origen_manual as OrigenManual) ?? 'whatsapp_manual',
        afectaciones: (data.afectaciones as string[]) ?? [],
        descripcion: (data.descripcion as string | null) ?? null,
      };
    }
  }

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

        <AdminNav activa="carga-manual" />

        <ManualForm key={initialData?.id ?? 'nuevo'} initialData={initialData} />
      </div>
    </main>
  );
}
