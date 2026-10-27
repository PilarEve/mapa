import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Database, CheckCircle2, XCircle, Clock, ShieldAlert, ArrowLeft, Layers } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function checkSupabaseHealth() {
  const startTime = Date.now();
  let queryError: { type: 'permission' | 'connection'; message: string } | null = null;
  let reportCount: number | null = null;

  try {
    // Consulta ligera: no trae coordenadas, imágenes, descripciones ni filas de datos
    const { count, error } = await supabase
      .from('reportes')
      .select('id', { count: 'exact', head: true });

    if (error) {
      const isPermission =
        error.code === '42501' ||
        error.message?.toLowerCase().includes('permission') ||
        error.message?.toLowerCase().includes('policy') ||
        error.message?.toLowerCase().includes('row-level security') ||
        (error as { status?: number }).status === 401 ||
        (error as { status?: number }).status === 403;

      queryError = {
        type: isPermission ? 'permission' : 'connection',
        message: isPermission
          ? 'Error de permisos: la consulta fue rechazada por políticas RLS o falta de autorización en Supabase.'
          : 'Error de conexión: no se pudo establecer comunicación con la base de datos.',
      };
    } else {
      reportCount = count ?? 0;
    }
  } catch {
    queryError = {
      type: 'connection',
      message: 'Fallo de red o error de configuración al contactar con el endpoint de Supabase.',
    };
  }

  const responseTimeMs = Date.now() - startTime;
  const isHealthy = queryError === null;

  return { isHealthy, queryError, reportCount, responseTimeMs };
}

export default async function TestDBPage() {
  // 1. Bloqueo estricto en producción: no ejecuta ninguna consulta a la base de datos
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  // 2. Consulta y diagnóstico ligero
  const { isHealthy, queryError, reportCount, responseTimeMs } = await checkSupabaseHealth();

  return (
    <div className="flex-1 w-full bg-slate-50 font-sans text-slate-800 py-10 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
      <div className="max-w-xl w-full space-y-6">
        
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Database size={20} />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                Verificador de Conectividad Supabase
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Herramienta de diagnóstico de desarrollo
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
            Solo Local
          </span>
        </div>

        {/* Tarjeta de Estado Principal */}
        <div className={`p-6 rounded-2xl border shadow-sm transition-all ${
          isHealthy 
            ? 'bg-white border-emerald-200/80 shadow-emerald-500/5' 
            : 'bg-white border-rose-200/80 shadow-rose-500/5'
        }`}>
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl shrink-0 ${
              isHealthy ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}>
              {isHealthy ? <CheckCircle2 size={28} /> : <XCircle size={28} />}
            </div>

            <div className="space-y-1 flex-1">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${
                isHealthy ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {isHealthy ? 'Conexión Exitosa' : 'Fallo en la Verificación'}
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                {isHealthy 
                  ? 'Base de datos accesible y autorizada' 
                  : queryError?.message}
              </h2>
              {isHealthy && (
                <p className="text-xs text-slate-500 font-medium pt-0.5">
                  La clave de acceso anónimo autentica correctamente y dispone de permisos de lectura.
                </p>
              )}
            </div>
          </div>

          {/* Métricas limpias (sin volcado de datos sensibles) */}
          <div className="grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-slate-100">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-0.5">
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wide">
                <Layers size={13} />
                <span>Reportes Registrados</span>
              </div>
              <p className="text-lg font-black text-slate-800">
                {reportCount !== null ? reportCount : '—'}
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-0.5">
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wide">
                <Clock size={13} />
                <span>Tiempo de Respuesta</span>
              </div>
              <p className="text-lg font-black text-slate-800">
                {responseTimeMs} ms
              </p>
            </div>
          </div>
        </div>

        {/* Nota de Seguridad */}
        <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 flex items-start gap-3 text-xs text-blue-900">
          <ShieldAlert size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Protección en producción activa</p>
            <p className="text-blue-700 leading-relaxed font-normal">
              Esta ruta utiliza <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">notFound()</code> cuando <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">NODE_ENV === &apos;production&apos;</code>. En Vercel o en cualquier despliegue productivo, el servidor responderá con HTTP 404 sin ejecutar ninguna consulta.
            </p>
          </div>
        </div>

        {/* Botón de Retorno */}
        <div className="flex justify-end pt-2">
          <Link
            href="/mapa"
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs border border-slate-200 transition-colors shadow-2xs"
          >
            <ArrowLeft size={14} />
            <span>Volver al Mapa</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
