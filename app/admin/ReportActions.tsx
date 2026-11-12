'use client';

import { useState, useTransition } from 'react';
import { Check, X, RefreshCw, RotateCcw } from 'lucide-react';
import { aprobarReporte, rechazarReporte, reintentarRetiroPublico, restaurarReporte, type ActionResult } from './review-actions';

interface Props {
  id: string;
  estado: 'pendiente' | 'validado' | 'rechazado';
  needsPublicRetire: boolean;
  approveEnabled: boolean;
  rejectEnabled: boolean;
}

type Pending = 'aprobar' | 'rechazar' | 'restaurar' | null;

export default function ReportActions({ id, estado, needsPublicRetire, approveEnabled, rejectEnabled }: Props) {
  const [confirming, setConfirming] = useState<Pending>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (fn: (id: string) => Promise<ActionResult>) => {
    setConfirming(null);
    startTransition(async () => {
      try {
        setResult(await fn(id));
      } catch {
        setResult({ ok: false, message: 'Error inesperado. No se confirmaron cambios.' });
      }
    });
  };

  const msg = result && (
    <p
      role="status"
      className={`text-xs rounded-lg px-2.5 py-1.5 border ${
        result.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
      }`}
    >
      {result.message}
    </p>
  );

  if (estado === 'rechazado') {
    return (
      <div className="space-y-2 pt-2">
        {needsPublicRetire && (
          <>
            <p className="text-xs text-amber-700">La copia pública de la foto aún no fue retirada.</p>
            <button
              type="button"
              disabled={isPending || !rejectEnabled}
              onClick={() => run(reintentarRetiroPublico)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50"
            >
              <RefreshCw size={14} /> {isPending ? 'Procesando…' : 'Reintentar retiro de copia pública'}
            </button>
          </>
        )}
        {confirming === 'restaurar' ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-700">
              ¿Confirmás restaurar este reporte? Volverá a Pendientes y su foto será pública otra vez.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => run(restaurarReporte)}
                className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={isPending || !rejectEnabled}
            onClick={() => setConfirming('restaurar')}
            title={rejectEnabled ? undefined : 'Pendiente de configuración en Supabase'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw size={14} /> {isPending ? 'Procesando…' : 'Restaurar'}
          </button>
        )}
        {msg}
      </div>
    );
  }

  if (estado !== 'pendiente') return result ? <div className="pt-2">{msg}</div> : null;

  return (
    <div className="space-y-2 pt-2">
      {confirming ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-700">
            {confirming === 'aprobar'
              ? '¿Confirmás aprobar este reporte? Será público como verificado.'
              : '¿Confirmás rechazar este reporte? Se ocultará y su foto pasará a un bucket privado.'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => run(confirming === 'aprobar' ? aprobarReporte : rechazarReporte)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-white ${
                confirming === 'aprobar' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending || !approveEnabled}
            onClick={() => setConfirming('aprobar')}
            title={approveEnabled ? undefined : 'Pendiente de configuración en Supabase'}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check size={16} /> Aprobar
          </button>
          <button
            type="button"
            disabled={isPending || !rejectEnabled}
            onClick={() => setConfirming('rechazar')}
            title={rejectEnabled ? undefined : 'Pendiente de configuración en Supabase'}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={16} /> Rechazar
          </button>
        </div>
      )}
      {isPending && <p className="text-xs text-slate-500">Procesando…</p>}
      {(!approveEnabled || !rejectEnabled) && (
        <p className="text-[11px] text-slate-400">
          {!approveEnabled && !rejectEnabled
            ? 'Aprobar y Rechazar están deshabilitados hasta completar la configuración.'
            : !approveEnabled
              ? 'Aprobar está deshabilitado hasta completar la configuración.'
              : 'Rechazar está deshabilitado hasta completar la configuración.'}
        </p>
      )}
      {msg}
    </div>
  );
}

