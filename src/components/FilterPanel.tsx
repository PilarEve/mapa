"use client";

import { Severity } from '../types/report';
import { Layers, Filter } from 'lucide-react';

interface FilterPanelProps {
  onFilterChange: (severities: Severity[], status: string) => void;
  selectedSeverities: Severity[];
  selectedStatus: string;
  onToggleHeatmap: (isVisible: boolean) => void;
  isHeatmapVisible: boolean;
}

export default function FilterPanel({
  onFilterChange,
  selectedSeverities,
  selectedStatus,
  onToggleHeatmap,
  isHeatmapVisible
}: FilterPanelProps) {
  
  const handleSeverityToggle = (severity: Severity) => {
    if (selectedSeverities.includes(severity)) {
      onFilterChange(selectedSeverities.filter(s => s !== severity), selectedStatus);
    } else {
      onFilterChange([...selectedSeverities, severity], selectedStatus);
    }
  };

  return (
    <div className="absolute top-4 right-4 md:top-6 md:right-6 z-[1000] bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-5 w-[calc(100vw-2rem)] md:w-72 border border-white/50 transition-all">
      <div className="flex items-center gap-2.5 mb-5 text-slate-800 font-bold border-b border-slate-200/60 pb-3">
        <div className="bg-blue-100/50 p-1.5 rounded-lg text-blue-600">
          <Layers size={18} />
        </div>
        <span>Capas y Filtros</span>
      </div>

      {/* Capas */}
      <div className="mb-5">
        <h3 className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-3">Vistas</h3>
        <label className="flex items-center space-x-3 cursor-pointer group">
          <div className="relative flex items-center justify-center">
            <input 
              type="checkbox" 
              checked={isHeatmapVisible}
              onChange={(e) => onToggleHeatmap(e.target.checked)}
              className="peer sr-only"
            />
            <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
          </div>
          <span className="text-sm text-slate-700 font-medium group-hover:text-blue-600 transition-colors">Mapa de Calor</span>
        </label>
      </div>

      {/* Filtro por Severidad */}
      <div className="mb-5">
        <h3 className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-3 flex items-center gap-1.5">
          <Filter size={14} /> Severidad
        </h3>
        <div className="space-y-2.5">
          {(['bajo', 'medio', 'alto', 'critico'] as Severity[]).map(sev => (
            <label key={sev} className="flex items-center space-x-3 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={selectedSeverities.includes(sev)}
                onChange={() => handleSeverityToggle(sev)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 transition-shadow cursor-pointer"
              />
              <span className="text-sm capitalize text-slate-600 font-medium flex items-center gap-2 group-hover:text-slate-900 transition-colors">
                <span className={`w-2.5 h-2.5 rounded-full shadow-sm ${
                  sev === 'bajo' ? 'bg-green-500 shadow-green-500/40' :
                  sev === 'medio' ? 'bg-yellow-400 shadow-yellow-400/40' :
                  sev === 'alto' ? 'bg-orange-500 shadow-orange-500/40' : 'bg-red-500 shadow-red-500/40'
                }`}></span>
                {sev}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Filtro por Estado */}
      <div>
        <h3 className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-3">Estado del Reporte</h3>
        <select 
          value={selectedStatus}
          onChange={(e) => onFilterChange(selectedSeverities, e.target.value)}
          className="w-full text-sm text-slate-700 bg-white/50 border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm focus:border-blue-400 focus:ring focus:ring-blue-500/20 outline-none transition-all cursor-pointer font-medium"
        >
          <option value="todos">Todos los reportes</option>
          <option value="validado">Solo validados</option>
          <option value="pendiente">Solo pendientes</option>
        </select>
      </div>
    </div>
  );
}
