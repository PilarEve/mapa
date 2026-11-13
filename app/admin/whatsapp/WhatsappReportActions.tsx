'use client';

import { useState, useTransition } from 'react';
import { Check, X, RotateCcw } from 'lucide-react';
import {
  aprobarReporteWhatsapp,
  rechazarReporteWhatsapp,
  restaurarReporteWhatsapp,
  type WhatsappActionResult,
} from './actions';

interface Props {
  id: string;
  estado: 'pendiente' | 'validado' | 'rechazado';
}

type Pending = 'aprobar' | 'rechazar' | 'restaurar' | null;

export default function WhatsappReportActions({ id, estado }: Props) {
  const [confirming, setConfirming] = useState<Pending>(null);
  const [result, setResult] = useState<WhatsappActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (fn: (id: string) => Promise<WhatsappActionResult>) => {
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

  if (estado === 'rechazado' || estado === 'validado') {
    return (
      <div className="space-y-2 pt-2">
        {confirming === 'restaurar' ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-700">
              {estado === 'rechazado'
                ? '¿Confirmás restaurar este reporte? Volverá a Pendientes y será visible en el mapa público.'
                : '¿Confirmás restaurar este reporte a estado Pendiente?'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => run(restaurarReporteWhatsapp)}
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
            disabled={isPending}
            onClick={() => setConfirming('restaurar')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw size={14} /> {isPending ? 'Procesando…' : 'Restaurar'}
          </button>
        )}
        {msg}
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-2">
      {confirming ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-700">
            {confirming === 'aprobar'
              ? '¿Confirmás aprobar este reporte? Será público como verificado.'
              : '¿Confirmás rechazar este reporte? Se ocultará del mapa público.'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => run(confirming === 'aprobar' ? aprobarReporteWhatsapp : rechazarReporteWhatsapp)}
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
            disabled={isPending}
            onClick={() => setConfirming('aprobar')}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check size={16} /> Aprobar
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirming('rechazar')}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={16} /> Rechazar
          </button>
        </div>
      )}
      {isPending && <p className="text-xs text-slate-500">Procesando…</p>}
      {msg}
    </div>
  );
}
