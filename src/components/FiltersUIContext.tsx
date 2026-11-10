"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface FiltersUIValue {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
  /** Contenedor del botón "Filtros" en el header: el panel se renderiza dentro de él (portal). */
  anchorEl: HTMLElement | null;
  setAnchorEl: (el: HTMLElement | null) => void;
}

const FiltersUIContext = createContext<FiltersUIValue | null>(null);

/**
 * Estado de apertura del panel de filtros, compartido entre el header (botón) y el mapa (panel).
 * El estado de los filtros en sí permanece en MapView.
 */
export function FiltersUIProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const toggle = useCallback(() => setIsOpen(prev => !prev), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Cerrar con clic/toque fuera (el ancla contiene botón y panel) o con Escape.
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (anchorEl && !anchorEl.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    // Captura: Leaflet detiene la propagación de algunos eventos del mapa.
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, anchorEl]);

  const value = useMemo(
    () => ({ isOpen, toggle, close, anchorEl, setAnchorEl }),
    [isOpen, toggle, close, anchorEl]
  );

  return <FiltersUIContext.Provider value={value}>{children}</FiltersUIContext.Provider>;
}

export function useFiltersUI(): FiltersUIValue {
  const ctx = useContext(FiltersUIContext);
  if (!ctx) throw new Error('useFiltersUI debe usarse dentro de FiltersUIProvider');
  return ctx;
}

