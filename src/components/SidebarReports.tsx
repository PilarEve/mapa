"use client";

import { Report } from '../types/report';
import { format } from 'date-fns';
import { MapPin, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

interface SidebarReportsProps {
  reports: Report[];
  onSelectReport: (report: Report) => void;
}

export default function SidebarReports({ reports, onSelectReport }: SidebarReportsProps) {
  return (
    <div className="w-80 md:w-96 bg-white/95 backdrop-blur-md h-full border-r border-slate-200/50 flex flex-col shadow-[4px_0_24px_-4px_rgba(0,0,0,0.05)] z-[1000] relative">
      <div className="p-6 border-b border-slate-100 bg-white/50 backdrop-blur-sm">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <AlertTriangle className="text-blue-600" size={22} />
          Reportes Recientes
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {reports.length} eventos registrados en Asunción
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        {reports.map((report) => (
          <div 
            key={report.id} 
            onClick={() => onSelectReport(report)}
            className="group bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-200 cursor-pointer transition-all duration-300 transform hover:-translate-y-1"
          >
            <div className="flex justify-between items-start mb-3">
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest ${
                report.severity === 'bajo' ? 'bg-green-100/80 text-green-700' :
                report.severity === 'medio' ? 'bg-yellow-100/80 text-yellow-700' :
                report.severity === 'alto' ? 'bg-orange-100/80 text-orange-700' : 
                'bg-red-100/80 text-red-700'
              }`}>
                {report.severity}
              </span>
              <span className="text-xs flex items-center gap-1.5 text-slate-400 font-medium bg-slate-50 px-2 py-0.5 rounded-full">
                {report.status === 'validado' ? <CheckCircle2 size={14} className="text-green-500"/> : <Clock size={14}/>}
                <span className="capitalize">{report.status}</span>
              </span>
            </div>
            
            <p className="text-sm text-slate-700 mb-4 line-clamp-2 leading-relaxed">{report.description}</p>
            
            <div className="flex justify-between items-center text-xs text-slate-400 border-t border-slate-50 pt-3">
              <span className="flex items-center gap-1 font-medium group-hover:text-blue-600 transition-colors">
                <MapPin size={14} /> Mburicaó
              </span>
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
