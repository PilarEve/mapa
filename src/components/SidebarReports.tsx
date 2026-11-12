"use client";

import { format } from 'date-fns';
import { AlertTriangle, AlertCircle, CheckCircle2, Clock, ChevronLeft, X } from 'lucide-react';
import type { ActivityItem } from '@/lib/activity';

interface SidebarReportsProps {
  items: ActivityItem[];
  onSelectItem: (item: ActivityItem) => void;
  onCollapse: () => void;
}

const formatItemDate = (item: ActivityItem) => {
  if (!item.date) return 'Sin fecha';
  return format(item.date, item.kind === 'reporte' ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy');
};

export default function SidebarReports({ items, onSelectItem, onCollapse }: SidebarReportsProps) {
  return (
    <div className="w-80 md:w-96 bg-white/95 backdrop-blur-md h-full border-r border-slate-200/50 flex flex-col shadow-[4px_0_24px_-4px_rgba(0,0,0,0.05)] z-[1000] relative">
      <div className="p-6 border-b border-slate-100 bg-white/50 backdrop-blur-sm flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="text-blue-600" size={22} />
            Actividad reciente
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {items.length} {items.length === 1 ? 'registro visible' : 'registros visibles'}
          </p>
        </div>
        <button
          onClick={onCollapse}
          className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-xl transition-colors cursor-pointer shrink-0"
          title="Contraer panel"
          aria-label="Contraer panel"
        >
          <ChevronLeft size={20} className="hidden md:block" />
          <X size={20} className="md:hidden" />
        </button>
      </div>

      <div className="sidebar-scrollable flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        {items.map((item) => {
          const isPending = item.kind === 'reporte' && item.report.status === 'pendiente';
          return (
            <div
              key={item.key}
              onClick={() => onSelectItem(item)}
              className={`group bg-white p-4 rounded-xl border shadow-sm hover:shadow-xl cursor-pointer transition-all duration-300 transform hover:-translate-y-1 ${
                isPending
                  ? 'border-amber-200/80 hover:border-amber-300 bg-gradient-to-b from-amber-50/20 to-white'
                  : 'border-slate-100 hover:border-blue-200'
              }`}
            >
              {item.kind === 'reporte' ? (
                <>
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <span className="bg-slate-100 text-slate-600 border border-slate-200/80 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">
                      Reporte ciudadano
                    </span>
                    <span className="text-xs shrink-0">
                      {item.report.status === 'validado' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full text-[11px]">
                          <CheckCircle2 size={12} className="text-emerald-600" />
                          Verificado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[10.5px]" title="Reporte pendiente de validación">
                          <Clock size={12} className="text-amber-600" />
                          Pendiente
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {item.report.impactTags && item.report.impactTags.length > 0 ? (
                      item.report.impactTags.slice(0, 2).map(tag => (
                        <span key={tag} className="bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider truncate">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="bg-slate-50 text-slate-500 border border-slate-200 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Sin etiquetas
                      </span>
                    )}
                    {item.report.impactTags && item.report.impactTags.length > 2 && (
                      <span className="bg-slate-50 text-slate-500 text-[10px] font-bold px-1.5 py-1 rounded-full">
                        +{item.report.impactTags.length - 2}
                      </span>
                    )}
                  </div>

                  {isPending && (
                    <div className="mb-2.5 bg-amber-50 border border-amber-200/70 rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-[10.5px] text-amber-800 font-medium">
                      <AlertCircle size={12} className="text-amber-600 shrink-0" />
                      <span>Pendiente de validación</span>
                    </div>
                  )}

                  <p className="text-sm text-slate-700 mb-4 line-clamp-2 leading-relaxed">{item.report.description}</p>

                  <div className="flex justify-end items-center text-xs text-slate-400 border-t border-slate-50 pt-3">
                    <span className="font-medium">{formatItemDate(item)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-3">
                    <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                      Noticia histórica
                    </span>
                  </div>

                  <p className="text-sm text-slate-700 mb-4 line-clamp-2 leading-relaxed">
                    {item.news.titulo?.trim() || item.news.descripcion?.trim() || 'Sin descripción'}
                  </p>

                  <div className="flex justify-between items-center gap-3 text-xs text-slate-400 border-t border-slate-50 pt-3">
                    <span className="italic truncate">{item.news.fuente}</span>
                    <span className="font-medium shrink-0">{formatItemDate(item)}</span>
                  </div>
                </>
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center text-slate-400 mt-16 p-6">
            <AlertTriangle size={32} className="mb-3 opacity-20" />
            <p className="text-sm">No se encontraron registros con los filtros seleccionados.</p>
          </div>
        )}
      </div>
    </div>
  );
}
