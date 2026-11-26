'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, X, Pencil, Trash2, RotateCcw } from 'lucide-react';
import {
  cambiarEstadoReporteManual,
  eliminarReporteManual,
  type ManualActionResult,
} from './actions';

interface Props {
  id: string;
  estado: 'pendiente' | 'validado' | 'rechazado';
}

type ConfirmAction = 'aprobar' | 'rechazar' | 'pendiente' | 'eliminar' | null;

export default function ManualReportActions({ id, estado }: Props) {
  const [confirming, setConfirming] = useState<ConfirmAction>(null);
  const [result, setResult] = useState<ManualActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const runAction = (action: () => Promise<ManualActionResult>) => {
    setConfirming(null);
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await action());
      } catch {
        setResult({ ok: false, message: 'Error inesperado al ejecutar la acción.' });
      }
    });
  };

  return (
    <div className="space-y-2 pt-2 border-t border-slate-100 mt-auto">
      {confirming ? (
        <div className="space-y-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <p className="text-xs font-medium text-slate-700">
            {confirming === 'aprobar' && '¿Confirmás marcar este reporte como validado?'}
            {confirming === 'rechazar' && '¿Confirmás rechazar este reporte?'}
            {confirming === 'pendiente' && '¿Confirmás pasar este reporte a pendiente?'}
            {confirming === 'eliminar' && '¿Confirmás eliminar definitivamente este reporte y su fotografía?'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                if (confirming === 'aprobar') runAction(() => cambiarEstadoReporteManual(id, 'validado'));
                else if (confirming === 'rechazar') runAction(() => cambiarEstadoReporteManual(id, 'rechazado'));
                else if (confirming === 'pendiente') runAction(() => cambiarEstadoReporteManual(id, 'pendiente'));
                else if (confirming === 'eliminar') runAction(() => eliminarReporteManual(id));
              }}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors ${
                confirming === 'rechazar' || confirming === 'eliminar'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              Confirmar
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirming(null)}
              className="flex-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {estado !== 'validado' ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirming('aprobar')}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50 transition-colors"
            >
              <Check size={14} /> Aprobar
            </button>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirming('pendiente')}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-50 transition-colors"
            >
              <RotateCcw size={13} /> A pendiente
            </button>
          )}

          {estado !== 'rechazado' ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirming('rechazar')}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-red-600 hover:bg-red-700 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50 transition-colors"
            >
              <X size={14} /> Rechazar
            </button>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirming('pendiente')}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 disabled:opacity-50 transition-colors"
            >
              <RotateCcw size={13} /> Restaurar
            </button>
          )}

          <Link
            href={`/admin/carga-manual?editar=${encodeURIComponent(id)}`}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors"
          >
            <Pencil size={13} /> Editar
          </Link>

          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirming('eliminar')}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50 transition-colors"
          >
            <Trash2 size={13} /> Eliminar
          </button>
        </div>
      )}

      {isPending && <p className="text-xs text-slate-500">Procesando…</p>}

      {result && (
        <p
          role="status"
          className={`text-xs rounded-lg px-2.5 py-1.5 border ${
            result.ok
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
