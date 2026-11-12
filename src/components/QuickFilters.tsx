"use client";

import { X } from 'lucide-react';
import { AVAILABLE_TAGS } from './FilterPanel';

/** Afectaciones de acceso rápido: subconjunto de AVAILABLE_TAGS (mismos textos que guardan los reportes). */
const QUICK_TAGS = ['Calle inundada', 'Interrupción de tránsito', 'Servicio público afectado'].filter(tag =>
  AVAILABLE_TAGS.includes(tag)
);

interface QuickFiltersProps {
  /** Mismo estado que la sección Afectaciones del panel Filtros. */
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  className?: string;
}

export default function QuickFilters({ selectedTags, onTagsChange, className = '' }: QuickFiltersProps) {
  const toggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  // Etiquetas activas desde el panel que no tienen chip: se avisa para que no haya filtros ocultos sin señal.
  const hiddenActive = selectedTags.filter(tag => !QUICK_TAGS.includes(tag)).length;

  return (
    <div
      role="group"
      aria-label="Filtros rápidos de afectaciones"
      className={`items-center gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {QUICK_TAGS.map(tag => {
        const active = selectedTags.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            aria-pressed={active}
            className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold border shadow-sm transition-colors cursor-pointer ${
              active
                ? 'bg-blue-600 text-white border-blue-700'
                : 'bg-white/95 backdrop-blur-md text-slate-600 border-slate-200/70 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            {tag}
          </button>
        );
      })}
      {hiddenActive > 0 && (
        <span
          className="shrink-0 px-2 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100"
          title="Otras afectaciones activas desde el panel Filtros"
        >
          +{hiddenActive}
        </span>
      )}
      {selectedTags.length > 0 && (
        <button
          type="button"
          onClick={() => onTagsChange([])}
          className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-white/95 backdrop-blur-md text-slate-500 border border-slate-200/70 shadow-sm hover:text-slate-800 transition-colors cursor-pointer"
          aria-label="Limpiar afectaciones seleccionadas"
        >
          <X size={11} />
          Limpiar
        </button>
      )}
    </div>
  );
}
