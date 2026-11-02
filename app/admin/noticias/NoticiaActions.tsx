'use client';

import { useState, useTransition } from 'react';
import { X, RotateCcw } from 'lucide-react';
import {
  rechazarNoticia,
  restaurarNoticia,
  type NoticiaActionResult,
} from './actions';

interface Props {
  id: string;
  rechazada: boolean;
}

export default function NoticiaActions({ id, rechazada }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<NoticiaActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const confirmar = () => {
    setConfirming(false);
    startTransition(async () => {
      try {
        setResult(await (rechazada ? restaurarNoticia : rechazarNoticia)(id));
      } catch {
        setResult({ ok: false, message: 'Error inesperado. No se confirmaron cambios.' });
      }
    });
  };

  return (
    <div className="space-y-2 pt-2">
      {confirming ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-700">
            {rechazada
              ? '¿Confirmás restaurar esta noticia? Volverá a aparecer en el mapa público.'
              : '¿Confirmás rechazar esta noticia? Dejará de aparecer en el mapa público, pero se conservará aquí.'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmar}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors ${
                rechazada ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : rechazada ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
        >
          <RotateCcw size={14} /> {isPending ? 'Procesando…' : 'Restaurar'}
        </button>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 transition-colors"
        >
          <X size={14} /> {isPending ? 'Procesando…' : 'Rechazar'}
        </button>
      )}
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
