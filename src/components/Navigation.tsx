"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Menu, X, Home, Map, Activity, ChevronDown, Check, SlidersHorizontal } from 'lucide-react';
import { useFiltersUI } from './FiltersUIContext';
import { MAP_VISTAS, parseVista } from '@/lib/mapVista';

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMapMenuOpen, setIsMapMenuOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const mapMenuRef = useRef<HTMLDivElement>(null);
  const { isOpen: filtersOpen, toggle: toggleFilters, setAnchorEl: setFiltersAnchor } = useFiltersUI();

  const onMapPage = pathname.startsWith('/mapa');
  const activeVista = onMapPage ? parseVista(searchParams.get('vista')) : null;

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Handle click outside menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Submenú de Mapa (escritorio): cerrar con clic fuera o Escape
  useEffect(() => {
    if (!isMapMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (mapMenuRef.current && !mapMenuRef.current.contains(event.target as Node)) {
        setIsMapMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMapMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMapMenuOpen]);

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  const inicioActive = isActive('/');
  const mapaActive = isActive('/mapa');
  const estacionesActive = isActive('/estaciones');

  const desktopLinkClass = (active: boolean) =>
    `relative px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2 outline-none focus:ring-2 focus:ring-blue-500 ${
      active
        ? 'text-blue-600 bg-blue-50'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
    }`;

  const activeUnderline = (
    <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-blue-600 rounded-full" />
  );

  const mobileLinkClass = (active: boolean) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 outline-none focus:ring-2 focus:ring-blue-500 ${
      active
        ? 'text-blue-600 bg-blue-50 font-semibold'
        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/70'
    }`;

  return (
    <header className="h-12 md:h-16 border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-[4000] w-full font-sans transition-all duration-200">
      <div className="max-w-7xl mx-auto h-full px-3 sm:px-6 lg:px-8 flex items-center justify-between">
        
        {/* Brand / Logo */}
        <Link 
          href="/" 
          onClick={() => setIsOpen(false)}
          className="flex items-center gap-2 md:gap-2.5 group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg p-0.5"
          aria-label="Monitoreo Inundaciones - Ir a la página de inicio"
        >
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-base md:text-lg shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
            M
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        {/* Grupo derecho: navegación + Filtros */}
        <div className="flex items-center gap-1">
        <nav className="hidden md:flex items-center gap-1" aria-label="Navegación principal">
          <Link
            href="/"
            className={desktopLinkClass(inicioActive)}
            aria-current={inicioActive ? 'page' : undefined}
          >
            <Home size={16} />
            Inicio
            {inicioActive && activeUnderline}
          </Link>

          {/* Mapa con submenú de categorías */}
          <div ref={mapMenuRef} className="relative">
            <div
              className={`relative flex items-center rounded-xl transition-all duration-200 ${
                mapaActive ? 'bg-blue-50' : 'hover:bg-slate-100/60'
              }`}
            >
              <Link
                href="/mapa"
                onClick={() => setIsMapMenuOpen(false)}
                className={`pl-4 pr-2 py-2 rounded-l-xl text-sm font-semibold flex items-center gap-2 outline-none focus:ring-2 focus:ring-blue-500 ${
                  mapaActive ? 'text-blue-600' : 'text-slate-600 hover:text-slate-900'
                }`}
                aria-current={mapaActive ? 'page' : undefined}
              >
                <Map size={16} />
                Mapa
                {activeVista && activeVista !== 'todos' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-white text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded-full">
                    {activeVista === 'reportes' ? 'Reportes' : 'Noticias'}
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={() => setIsMapMenuOpen(prev => !prev)}
                className={`pl-1 pr-2.5 py-2 rounded-r-xl outline-none focus:ring-2 focus:ring-blue-500 ${
                  mapaActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
                }`}
                aria-haspopup="menu"
                aria-expanded={isMapMenuOpen}
                aria-label="Elegir categoría del mapa"
              >
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${isMapMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {mapaActive && activeUnderline}
            </div>

            {isMapMenuOpen && (
              <div
                role="menu"
                aria-label="Categorías del mapa"
                className="absolute left-0 top-full mt-2 w-56 bg-white/95 backdrop-blur-md border border-slate-200/70 rounded-xl shadow-lg p-1.5 z-[4001]"
              >
                {MAP_VISTAS.map(vista => {
                  const selected = activeVista === vista.value;
                  return (
                    <Link
                      key={vista.value}
                      href={vista.href}
                      scroll={false}
                      role="menuitem"
                      onClick={() => setIsMapMenuOpen(false)}
                      aria-current={selected ? 'true' : undefined}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors outline-none focus:ring-2 focus:ring-blue-500 ${
                        selected
                          ? 'text-blue-600 bg-blue-50 font-semibold'
                          : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
                      }`}
                    >
                      {vista.label}
                      {selected && <Check size={14} />}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <Link
            href="/estaciones"
            className={desktopLinkClass(estacionesActive)}
            aria-current={estacionesActive ? 'page' : undefined}
          >
            <Activity size={16} />
            Estaciones
            {estacionesActive && activeUnderline}
          </Link>
        </nav>

        <div className="flex items-center gap-1">
          {/* Filtros (solo en el mapa). Este contenedor es el ancla del panel (portal desde MapView). */}
          {onMapPage && (
            <div ref={setFiltersAnchor} className="md:relative">
              <button
                type="button"
                onClick={toggleFilters}
                className={`inline-flex items-center gap-2 p-1.5 md:px-4 md:py-2 rounded-xl text-sm font-semibold transition-all duration-200 outline-none focus:ring-2 focus:ring-blue-500 ${
                  filtersOpen
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                }`}
                aria-expanded={filtersOpen}
                aria-controls="panel-filtros"
                aria-label="Filtros"
              >
                <SlidersHorizontal size={18} className="md:w-4 md:h-4" />
                <span className="hidden md:inline">Filtros</span>
              </button>
            </div>
          )}

          {/* Mobile Hamburger Button */}
          <button
            ref={buttonRef}
            onClick={() => setIsOpen(!isOpen)}
            type="button"
            className="md:hidden inline-flex items-center justify-center p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            aria-controls="mobile-menu"
            aria-expanded={isOpen}
            aria-label={isOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[4005] md:hidden transition-opacity" 
          aria-hidden="true" 
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Navigation Drawer */}
      <div
        id="mobile-menu"
        ref={menuRef}
        className={`fixed inset-0 w-full h-[100dvh] bg-white z-[4010] md:hidden transform transition-transform duration-300 ease-out flex flex-col justify-between ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Menú móvil"
      >
        {/* Mobile Drawer Header */}
        <div className="h-9 px-3 border-b border-slate-100 flex items-center justify-end">
          <button
            onClick={() => setIsOpen(false)}
            type="button"
            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mobile Nav Options */}
        <nav className="p-2.5 pt-2 flex flex-col gap-1.5 flex-1 overflow-y-auto" aria-label="Navegación móvil">
          <Link
            href="/"
            onClick={() => setIsOpen(false)}
            className={mobileLinkClass(inicioActive)}
            aria-current={inicioActive ? 'page' : undefined}
          >
            <Home size={18} className={inicioActive ? 'text-blue-600' : 'text-slate-400'} />
            Inicio
          </Link>

          <Link
            href="/mapa"
            onClick={() => setIsOpen(false)}
            className={mobileLinkClass(mapaActive && activeVista === 'todos')}
            aria-current={mapaActive && activeVista === 'todos' ? 'page' : undefined}
          >
            <Map size={18} className={mapaActive ? 'text-blue-600' : 'text-slate-400'} />
            Mapa
          </Link>
          <div className="ml-6 pl-3 border-l border-slate-100 flex flex-col gap-1" role="group" aria-label="Categorías del mapa">
            {MAP_VISTAS.map(vista => {
              const selected = activeVista === vista.value;
              return (
                <Link
                  key={vista.value}
                  href={vista.href}
                  scroll={false}
                  onClick={() => setIsOpen(false)}
                  aria-current={selected ? 'true' : undefined}
                  className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-[13px] transition-all duration-150 outline-none focus:ring-2 focus:ring-blue-500 ${
                    selected
                      ? 'text-blue-600 bg-blue-50 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
                  }`}
                >
                  {vista.label}
                  {selected && <Check size={14} />}
                </Link>
              );
            })}
          </div>

          <Link
            href="/estaciones"
            onClick={() => setIsOpen(false)}
            className={mobileLinkClass(estacionesActive)}
            aria-current={estacionesActive ? 'page' : undefined}
          >
            <Activity size={18} className={estacionesActive ? 'text-blue-600' : 'text-slate-400'} />
            Estaciones
          </Link>
        </nav>

        {/* Mobile Drawer Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <p className="text-[11px] text-slate-400 text-center font-normal">
            Monitoreo Asunción © 2026
          </p>
        </div>
      </div>
    </header>
  );
}
