"use client";

import { useState, useEffect } from 'react';
import { Layers, Database, Activity, Calendar, Filter, Sliders, ChevronDown, ChevronUp, Map } from 'lucide-react';

const AVAILABLE_TAGS = [
  'Calle inundada',
  'Deslizamiento',
  'Árbol caído',
  'Vivienda afectada',
  'Vehículo afectado',
  'Persona atrapada',
  'Sin daños visibles',
  'Interrupción de tránsito',
  'Servicio público afectado',
  'Fallecimiento reportado'
];

interface FilterPanelProps {
  showReports: boolean;
  onShowReportsChange: (value: boolean) => void;
  showNews: boolean;
  onShowNewsChange: (value: boolean) => void;
  selectedStatuses: string[];
  onStatusesChange: (statuses: string[]) => void;
  selectedDateRange: string;
  onDateRangeChange: (range: string) => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  isHeatmapVisible: boolean;
  onToggleHeatmap: (isVisible: boolean) => void;
  activeBaseMap: 'voyager' | 'light' | 'satellite';
  onChangeBaseMap: (baseMap: 'voyager' | 'light' | 'satellite') => void;
  className?: string;
}

export default function FilterPanel({
  showReports,
  onShowReportsChange,
  showNews,
  onShowNewsChange,
  selectedStatuses,
  onStatusesChange,
  selectedDateRange,
  onDateRangeChange,
  selectedTags,
  onTagsChange,
  isHeatmapVisible,
  onToggleHeatmap,
  activeBaseMap,
  onChangeBaseMap,
  className = ''
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    datos: true,
    mapaBase: true,
    estado: true,
    fecha: false,
    afectaciones: false,
    opciones: false
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      setIsExpanded(true);
    }
  }, []);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleStatusToggle = (status: string) => {
    if (selectedStatuses.includes(status)) {
      onStatusesChange(selectedStatuses.filter(s => s !== status));
    } else {
      onStatusesChange([...selectedStatuses, status]);
    }
  };

  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const dateRanges = [
    { value: 'todo', label: 'Todo' },
    { value: 'hoy', label: 'Hoy' },
    { value: '7dias', label: 'Últimos 7 días' },
    { value: '30dias', label: 'Últimos 30 días' }
  ];

  return (
    <div className={`absolute z-[1000] bg-white/95 backdrop-blur-md shadow-lg border border-slate-200/80 transition-all duration-300 overflow-hidden ${isExpanded ? 'rounded-2xl w-[calc(100vw-1.5rem)] md:w-80' : 'rounded-full w-auto'} ${className}`}>
      
      {/* Header / Toggle Button */}
      <button 
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3.5 py-2 md:p-3.5 focus:outline-none cursor-pointer gap-3"
        aria-label="Alternar panel de visualización"
      >
        <div className="flex items-center gap-2 text-slate-800 font-bold text-xs md:text-sm">
          <div className="bg-blue-100/80 p-1 md:p-1.5 rounded-lg text-blue-600 shrink-0">
            <Layers size={16} />
          </div>
          <span className="whitespace-nowrap">Visualización</span>
        </div>
        <div className="text-slate-400 bg-slate-100 p-1 rounded-full shrink-0">
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Collapsible Content */}
      <div className={`filter-scrollable transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[calc(100vh-140px)] overflow-y-auto opacity-100 px-5 pb-5' : 'max-h-0 opacity-0 px-5 pb-0'}`}>
        <div className="border-t border-slate-200/60 pt-3 flex flex-col gap-1">
          
          {/* A) Datos */}
          <div className="py-1.5">
            <button
              type="button"
              onClick={() => toggleSection('datos')}
              className="w-full flex items-center justify-between py-1 text-slate-700 hover:text-slate-900 transition-colors font-bold text-xs uppercase tracking-wider"
            >
              <div className="flex items-center gap-2">
                <Database size={14} className="text-slate-400" />
                <span>Datos</span>
              </div>
              <ChevronDown 
                size={14} 
                className={`text-slate-400 transition-transform duration-200 ${expandedSections.datos ? 'rotate-180' : ''}`} 
              />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedSections.datos ? 'max-h-24 opacity-100 mt-2.5 pl-6' : 'max-h-0 opacity-0'}`}>
              <div className="flex flex-col gap-2.5 pb-1">
                <label className="flex items-center gap-3 cursor-pointer group w-fit">
                  <input 
                    type="checkbox" 
                    checked={showReports}
                    onChange={(e) => onShowReportsChange(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 transition-shadow cursor-pointer"
                  />
                  <span className="text-sm text-slate-600 font-medium group-hover:text-slate-900 transition-colors">
                    Reportes ciudadanos
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group w-fit">
                  <input 
                    type="checkbox" 
                    checked={showNews}
                    onChange={(e) => onShowNewsChange(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 transition-shadow cursor-pointer"
                  />
                  <span className="text-sm text-slate-600 font-medium group-hover:text-slate-900 transition-colors">
                    Noticias históricas
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-100/80 my-1" />

          {/* B) Mapa base */}
          <div className="py-1.5">
            <button
              type="button"
              onClick={() => toggleSection('mapaBase')}
              className="w-full flex items-center justify-between py-1 text-slate-700 hover:text-slate-900 transition-colors font-bold text-xs uppercase tracking-wider"
            >
              <div className="flex items-center gap-2">
                <Map size={14} className="text-slate-400" />
                <span>Mapa base</span>
              </div>
              <ChevronDown 
                size={14} 
                className={`text-slate-400 transition-transform duration-200 ${expandedSections.mapaBase ? 'rotate-180' : ''}`} 
              />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedSections.mapaBase ? 'max-h-32 opacity-100 mt-2.5 pl-6' : 'max-h-0 opacity-0'}`}>
              <div className="flex flex-col gap-2.5 pb-1">
                {(['light', 'voyager', 'satellite'] as const).map((mode) => {
                  const labels = {
                    light: 'Mapa',
                    voyager: 'Calles',
                    satellite: 'Satélite'
                  };
                  return (
                    <label key={mode} className="flex items-center gap-3 cursor-pointer group w-fit">
                      <input 
                        type="radio" 
                        name="baseMap"
                        value={mode}
                        checked={activeBaseMap === mode}
                        onChange={() => onChangeBaseMap(mode)}
                        className="w-4 h-4 rounded-full border-slate-300 text-blue-600 focus:ring-blue-500/30 transition-shadow cursor-pointer"
                      />
                      <span className="text-sm text-slate-600 font-medium group-hover:text-slate-900 transition-colors">
                        {labels[mode]}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-b border-slate-100/80 my-1" />

          {/* C) Estado */}
          <div className="py-1.5">
            <button
              type="button"
              onClick={() => toggleSection('estado')}
              className="w-full flex items-center justify-between py-1 text-slate-700 hover:text-slate-900 transition-colors font-bold text-xs uppercase tracking-wider"
            >
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-slate-400" />
                <span>Estado</span>
              </div>
              <ChevronDown 
                size={14} 
                className={`text-slate-400 transition-transform duration-200 ${expandedSections.estado ? 'rotate-180' : ''}`} 
              />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedSections.estado ? 'max-h-32 opacity-100 mt-2.5 pl-6' : 'max-h-0 opacity-0'}`}>
              <div className="flex flex-col gap-2.5 pb-1">
                <label className="flex items-center gap-3 cursor-pointer group w-fit">
                  <input 
                    type="checkbox" 
                    checked={selectedStatuses.includes('pendiente')}
                    onChange={() => handleStatusToggle('pendiente')}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 transition-shadow cursor-pointer"
                  />
                  <span className="text-sm text-slate-600 font-medium group-hover:text-slate-900 transition-colors">
                    Pendientes
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group w-fit">
                  <input 
                    type="checkbox" 
                    checked={selectedStatuses.includes('validado')}
                    onChange={() => handleStatusToggle('validado')}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 transition-shadow cursor-pointer"
                  />
                  <span className="text-sm text-slate-600 font-medium group-hover:text-slate-900 transition-colors">
                    Verificados
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group w-fit">
                  <input 
                    type="checkbox" 
                    checked={selectedStatuses.includes('rechazado')}
                    onChange={() => handleStatusToggle('rechazado')}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 transition-shadow cursor-pointer"
                  />
                  <span className="text-sm text-slate-600 font-medium group-hover:text-slate-900 transition-colors">
                    Descartados
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-100/80 my-1" />

          {/* D) Fecha */}
          <div className="py-1.5">
            <button
              type="button"
              onClick={() => toggleSection('fecha')}
              className="w-full flex items-center justify-between py-1 text-slate-700 hover:text-slate-900 transition-colors font-bold text-xs uppercase tracking-wider"
            >
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-slate-400" />
                <span>Fecha</span>
              </div>
              <ChevronDown 
                size={14} 
                className={`text-slate-400 transition-transform duration-200 ${expandedSections.fecha ? 'rotate-180' : ''}`} 
              />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedSections.fecha ? 'max-h-52 opacity-100 mt-2.5 pl-6' : 'max-h-0 opacity-0'}`}>
              <div className="grid grid-cols-2 gap-2 pb-1 pr-1">
                {dateRanges.map((range) => (
                  <button
                    key={range.value}
                    type="button"
                    onClick={() => onDateRangeChange(range.value)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${
                      selectedDateRange === range.value
                        ? 'bg-blue-500 text-white border-blue-600 shadow-sm shadow-blue-500/10'
                        : 'bg-slate-50 text-slate-600 border-slate-200/60 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border-b border-slate-100/80 my-1" />

          {/* E) Afectaciones */}
          <div className="py-1.5">
            <button
              type="button"
              onClick={() => toggleSection('afectaciones')}
              className="w-full flex items-center justify-between py-1 text-slate-700 hover:text-slate-900 transition-colors font-bold text-xs uppercase tracking-wider"
            >
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-slate-400" />
                <span>Afectaciones</span>
              </div>
              <ChevronDown 
                size={14} 
                className={`text-slate-400 transition-transform duration-200 ${expandedSections.afectaciones ? 'rotate-180' : ''}`} 
              />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedSections.afectaciones ? 'max-h-48 opacity-100 mt-2.5 pl-6' : 'max-h-0 opacity-0'}`}>
              <div className="max-h-40 overflow-y-auto pr-1.5 space-y-2.5 pb-1 scrollbar-thin scrollbar-thumb-slate-200">
                {AVAILABLE_TAGS.map(tag => (
                  <label key={tag} className="flex items-center gap-3 cursor-pointer group w-fit">
                    <input 
                      type="checkbox" 
                      checked={selectedTags.includes(tag)}
                      onChange={() => handleTagToggle(tag)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 transition-shadow cursor-pointer"
                    />
                    <span className="text-sm text-slate-600 font-medium group-hover:text-slate-900 transition-colors">
                      {tag}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="border-b border-slate-100/80 my-1" />

          {/* F) Opciones */}
          <div className="py-1.5">
            <button
              type="button"
              onClick={() => toggleSection('opciones')}
              className="w-full flex items-center justify-between py-1 text-slate-700 hover:text-slate-900 transition-colors font-bold text-xs uppercase tracking-wider"
            >
              <div className="flex items-center gap-2">
                <Sliders size={14} className="text-slate-400" />
                <span>Opciones</span>
              </div>
              <ChevronDown 
                size={14} 
                className={`text-slate-400 transition-transform duration-200 ${expandedSections.opciones ? 'rotate-180' : ''}`} 
              />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedSections.opciones ? 'max-h-16 opacity-100 mt-2.5 pl-6' : 'max-h-0 opacity-0'}`}>
              <div className="pb-1 pr-1">
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-sm text-slate-600 font-medium group-hover:text-slate-900 transition-colors">
                    Mapa de Calor
                  </span>
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      checked={isHeatmapVisible}
                      onChange={(e) => onToggleHeatmap(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                  </div>
                </label>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
