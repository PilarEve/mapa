"use client";

import { useState, useEffect } from 'react';
import { Severity } from '../types/report';
import { Layers, Filter, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsExpanded(true);
    }
  }, []);
  
  const handleSeverityToggle = (severity: Severity) => {
    if (selectedSeverities.includes(severity)) {
      onFilterChange(selectedSeverities.filter(s => s !== severity), selectedStatus);
    } else {
      onFilterChange([...selectedSeverities, severity], selectedStatus);
    }
  };

  return (
    <div className={`absolute top-4 right-4 md:top-6 md:right-6 z-[1000] bg-white/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] w-[calc(100vw-2rem)] md:w-72 border border-white/50 transition-all duration-300 overflow-hidden ${isExpanded ? 'rounded-2xl' : 'rounded-full'}`}>
      
      {/* Header / Toggle Button */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 focus:outline-none"
      >
        <div className="flex items-center gap-2.5 text-slate-800 font-bold">
          <div className="bg-blue-100/80 p-1.5 rounded-lg text-blue-600">
            <Layers size={18} />
          </div>
          <span>Capas y Filtros</span>
        </div>
        <div className="text-slate-400 bg-slate-100 p-1 rounded-full">
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Collapsible Content */}
      <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100 px-5 pb-5' : 'max-h-0 opacity-0 px-5 pb-0'}`}>
        <div className="border-t border-slate-200/60 pt-4">
          
          {/* Capas */}
          <div className="mb-5">
            <h3 className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-3">Vistas</h3>
            <label className="flex items-center space-x-3 cursor-pointer group w-fit">
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
                <label key={sev} className="flex items-center space-x-3 cursor-pointer group w-fit">
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
      </div>
    </div>
  );
}
