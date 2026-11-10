"use client";

import { useState } from 'react';
import { Activity, Calendar, Filter, Sliders, ChevronDown, Map, RotateCcw } from 'lucide-react';
import type { MapVista } from '@/lib/mapVista';

export const AVAILABLE_TAGS = [
  'Calle inundada',
  'Deslizamiento',
  'Árbol caído',
  'Vivienda afectada',
  'Vehículo afectado',
  'Persona atrapada',
  'Sin daños visibles',
  'Interrupción de tránsito',
  'Servicio público afectado',
  'Acumulación de basura',
  'Fallecimiento reportado'
];

/** Valores por defecto de los filtros: lo que restablece "Restablecer filtros". */
export const DEFAULT_STATUSES = ['validado'];
export const DEFAULT_DATE_RANGE = 'todo';

interface FilterPanelProps {
  /** Categoría activa (viene de la URL). Determina qué secciones aplican. */
  vista: MapVista;
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
  /** Restablece estado, fecha y afectaciones. No toca categoría, mapa base ni mapa de calor. */
  onReset: () => void;
}

type SectionKey = 'mapaBase' | 'estado' | 'fecha' | 'afectaciones' | 'opciones';

export default function FilterPanel({
  vista,
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
  onReset
}: FilterPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
    mapaBase: false,
    estado: false,
    fecha: false,
    afectaciones: false,
    opciones: false
  });

  const toggleSection = (section: SectionKey) => {
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

  // Estado, afectaciones y mapa de calor solo aplican a reportes ciudadanos.
  const showReportFilters = vista !== 'noticias';
  const reportsOnlyNote = vista === 'todos' ? (
    <p className="text-[11px] text-slate-400 mb-1.5">Solo aplica a reportes ciudadanos</p>
  ) : null;

  const isDefault =
    selectedDateRange === DEFAULT_DATE_RANGE &&
    selectedTags.length === 0 &&
    selectedStatuses.length === DEFAULT_STATUSES.length &&
    DEFAULT_STATUSES.every(s => selectedStatuses.includes(s));

  const sectionButtonClass =
    'w-full flex items-center justify-between py-1 text-slate-700 hover:text-slate-900 transition-colors font-bold text-xs uppercase tracking-wider';
  const chevron = (section: SectionKey) => (
    <ChevronDown
      size={13}
      className={`text-slate-400 transition-transform duration-200 ${expandedSections[section] ? 'rotate-180' : ''}`}
    />
  );
  const divider = <div className="border-b border-slate-100 my-0.5" />;

  return (
    <div
      id="panel-filtros"
      role="region"
      aria-label="Filtros y visualización"
      className="absolute left-3 right-3 md:left-auto md:right-0 top-full mt-2 md:w-72 z-[4001] bg-white/95 backdrop-blur-md shadow-lg border border-slate-200/60 rounded-xl flex flex-col max-h-[calc(100dvh-4.5rem)] md:max-h-[calc(100dvh-5.5rem)]"
    >
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-slate-200/60 shrink-0">
        <span className="text-slate-800 font-bold text-xs">Filtros y visualización</span>
        <button
          type="button"
          onClick={onReset}
          disabled={isDefault}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw size={12} />
          Restablecer filtros
        </button>
      </div>

      {/* Contenido desplazable */}
      <div className="filter-scrollable flex-1 min-h-0 overflow-y-auto px-3.5 pb-3.5">
        <div className="pt-2 flex flex-col gap-0.5">

          {/* A) Mapa base (común) */}
          <div className="py-1">
            <button type="button" onClick={() => toggleSection('mapaBase')} className={sectionButtonClass}>
              <div className="flex items-center gap-2">
                <Map size={13} className="text-slate-400" />
                <span>Mapa base</span>
              </div>
              {chevron('mapaBase')}
            </button>
            <div className={`overflow-hidden transition-all duration-250 ease-in-out ${expandedSections.mapaBase ? 'max-h-28 opacity-100 mt-1.5 pl-5' : 'max-h-0 opacity-0'}`}>
              <div className="flex flex-col gap-2 pb-0.5">
                {(['light', 'voyager', 'satellite'] as const).map((mode) => {
                  const labels = {
                    light: 'Mapa Claro',
                    voyager: 'Calles',
                    satellite: 'Satélite'
                  };
                  return (
                    <label key={mode} className="flex items-center gap-2.5 cursor-pointer group w-fit">
                      <input
                        type="radio"
                        name="baseMap"
                        value={mode}
                        checked={activeBaseMap === mode}
                        onChange={() => onChangeBaseMap(mode)}
                        className="w-3.5 h-3.5 rounded-full border-slate-300 text-blue-600 focus:ring-blue-500/30 transition-shadow cursor-pointer"
                      />
                      <span className="text-xs text-slate-600 font-medium group-hover:text-slate-900 transition-colors">
                        {labels[mode]}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {showReportFilters && (
            <>
              {divider}

              {/* B) Estado (solo reportes) */}
              <div className="py-1">
                <button type="button" onClick={() => toggleSection('estado')} className={sectionButtonClass}>
                  <div className="flex items-center gap-2">
                    <Activity size={13} className="text-slate-400" />
                    <span>Estado</span>
                  </div>
                  {chevron('estado')}
                </button>
                <div className={`overflow-hidden transition-all duration-250 ease-in-out ${expandedSections.estado ? 'max-h-28 opacity-100 mt-1.5 pl-5' : 'max-h-0 opacity-0'}`}>
                  {reportsOnlyNote}
                  <div className="flex flex-col gap-2 pb-0.5">
                    <label className="flex items-center gap-2.5 cursor-pointer group w-fit">
                      <input
                        type="checkbox"
                        checked={selectedStatuses.includes('validado')}
                        onChange={() => handleStatusToggle('validado')}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 transition-shadow cursor-pointer"
                      />
                      <span className="text-xs text-slate-600 font-medium group-hover:text-slate-900 transition-colors">
                        Verificados
                      </span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer group w-fit">
                      <input
                        type="checkbox"
                        checked={selectedStatuses.includes('pendiente')}
                        onChange={() => handleStatusToggle('pendiente')}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 transition-shadow cursor-pointer"
                      />
                      <span className="text-xs text-slate-600 font-medium group-hover:text-slate-900 transition-colors">
                        Pendientes
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}

          {divider}

          {/* C) Fecha (común) */}
          <div className="py-1">
            <button type="button" onClick={() => toggleSection('fecha')} className={sectionButtonClass}>
              <div className="flex items-center gap-2">
                <Calendar size={13} className="text-slate-400" />
                <span>Fecha</span>
              </div>
              {chevron('fecha')}
            </button>
            <div className={`overflow-hidden transition-all duration-250 ease-in-out ${expandedSections.fecha ? 'max-h-48 opacity-100 mt-1.5 pl-5' : 'max-h-0 opacity-0'}`}>
              <div className="grid grid-cols-2 gap-1.5 pb-0.5 pr-0.5">
                {dateRanges.map((range) => (
                  <button
                    key={range.value}
                    type="button"
                    onClick={() => onDateRangeChange(range.value)}
                    className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-all duration-200 ${
                      selectedDateRange === range.value
                        ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {showReportFilters && (
            <>
              {divider}

              {/* D) Afectaciones (solo reportes) */}
              <div className="py-1">
                <button type="button" onClick={() => toggleSection('afectaciones')} className={sectionButtonClass}>
                  <div className="flex items-center gap-2">
                    <Filter size={13} className="text-slate-400" />
                    <span>Afectaciones</span>
                  </div>
                  {chevron('afectaciones')}
                </button>
                <div className={`overflow-hidden transition-all duration-250 ease-in-out ${expandedSections.afectaciones ? 'max-h-52 opacity-100 mt-1.5 pl-5' : 'max-h-0 opacity-0'}`}>
                  {reportsOnlyNote}
                  <div className="max-h-36 overflow-y-auto pr-1 space-y-2 pb-0.5 scrollbar-thin scrollbar-thumb-slate-200">
                    {AVAILABLE_TAGS.map(tag => (
                      <label key={tag} className="flex items-center gap-2.5 cursor-pointer group w-fit">
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(tag)}
                          onChange={() => handleTagToggle(tag)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 transition-shadow cursor-pointer"
                        />
                        <span className="text-xs text-slate-600 font-medium group-hover:text-slate-900 transition-colors">
                          {tag}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {divider}

              {/* E) Opciones (mapa de calor: solo reportes) */}
              <div className="py-1">
                <button type="button" onClick={() => toggleSection('opciones')} className={sectionButtonClass}>
                  <div className="flex items-center gap-2">
                    <Sliders size={13} className="text-slate-400" />
                    <span>Opciones</span>
                  </div>
                  {chevron('opciones')}
                </button>
                <div className={`overflow-hidden transition-all duration-250 ease-in-out ${expandedSections.opciones ? 'max-h-20 opacity-100 mt-1.5 pl-5' : 'max-h-0 opacity-0'}`}>
                  {reportsOnlyNote}
                  <div className="pb-0.5 pr-0.5">
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="text-xs text-slate-600 font-medium group-hover:text-slate-900 transition-colors">
                        Mapa de Calor
                      </span>
                      <div className="relative flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={isHeatmapVisible}
                          onChange={(e) => onToggleHeatmap(e.target.checked)}
                          className="peer sr-only"
                        />
                        <div className="w-9 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-600"></div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
