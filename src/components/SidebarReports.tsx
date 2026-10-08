"use client";

import { Report } from '../types/report';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle2, Clock, ChevronLeft, X } from 'lucide-react';

interface SidebarReportsProps {
  reports: Report[];
  onSelectReport: (report: Report) => void;
  onCollapse: () => void;
}

export default function SidebarReports({ reports, onSelectReport, onCollapse }: SidebarReportsProps) {
  return (
    <div className="w-80 md:w-96 bg-white/95 backdrop-blur-md h-full border-r border-slate-200/50 flex flex-col shadow-[4px_0_24px_-4px_rgba(0,0,0,0.05)] z-[1000] relative">
      <div className="p-6 border-b border-slate-100 bg-white/50 backdrop-blur-sm flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="text-blue-600" size={22} />
            Reportes Recientes
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {reports.length} eventos registrados en Asunción
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
        {reports.map((report) => (
          <div
            key={report.id}
            onClick={() => onSelectReport(report)}
            className="group bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-200 cursor-pointer transition-all duration-300 transform hover:-translate-y-1"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex flex-wrap gap-1 max-w-[70%]">
                {report.impactTags && report.impactTags.length > 0 ? (
                  report.impactTags.slice(0, 2).map(tag => (
                    <span key={tag} className="bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider truncate">
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="bg-slate-50 text-slate-500 border border-slate-200 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Sin etiquetas
                  </span>
                )}
                {report.impactTags && report.impactTags.length > 2 && (
                  <span className="bg-slate-50 text-slate-500 text-[10px] font-bold px-1.5 py-1 rounded-full">
                    +{report.impactTags.length - 2}
                  </span>
                )}
              </div>
              <span className="text-xs flex items-center gap-1.5 text-slate-400 font-medium bg-slate-50 px-2 py-0.5 rounded-full shrink-0">
                {report.status === 'validado' ? <CheckCircle2 size={14} className="text-green-500" /> : <Clock size={14} />}
                <span className="capitalize">{report.status}</span>
              </span>
            </div>

            <p className="text-sm text-slate-700 mb-4 line-clamp-2 leading-relaxed">{report.description}</p>

            <div className="flex justify-end items-center text-xs text-slate-400 border-t border-slate-50 pt-3">
              <span className="font-medium">{format(new Date(report.dateTime), 'dd/MM HH:mm')}</span>
            </div>
          </div>
        ))}
        {reports.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center text-slate-400 mt-16 p-6">
            <AlertTriangle size={32} className="mb-3 opacity-20" />
            <p className="text-sm">No se encontraron reportes con los filtros seleccionados.</p>
          </div>
        )}
      </div>
    </div>
  );
}
