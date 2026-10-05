"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

interface GeocodeResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface SearchBarProps {
  onSelectLocation: (lat: number, lon: number, displayName: string) => void;
  className?: string;
}

export default function SearchBar({ onSelectLocation, className = '' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastSelectedName = useRef('');

  // Evitar propagación de eventos para que el mapa no interactúe con clics/scroll
  const handleInteraction = (e: React.MouseEvent | React.TouchEvent | React.WheelEvent) => {
    e.stopPropagation();
  };

  // Buscar ubicaciones con Nominatim
  const searchLocation = async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.trim().length <= 2) {
      setResults([]);
      setNoResults(false);
      return;
    }

    setLoading(true);
    setNoResults(false);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&countrycodes=py&viewbox=-57.75,-25.15,-57.45,-25.40&limit=6&addressdetails=1&accept-language=es`
      );

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = (await response.json()) as GeocodeResult[];
      setResults(data);
      setNoResults(data.length === 0);
      setIsOpen(true);
    } catch (error) {
      console.error('Error fetching geocoding data:', error);
      setResults([]);
      setNoResults(true);
      setIsOpen(true);
    } finally {
      setLoading(false);
    }
  };

  // Debounce para búsqueda automática al escribir
  useEffect(() => {
    if (query === lastSelectedName.current) {
      return;
    }

    if (!query.trim() || query.trim().length <= 2) {
      setResults([]);
      setNoResults(false);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(() => {
      searchLocation(query);
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  // Manejo de clicks fuera de la barra de búsqueda para cerrar sugerencias
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (item: GeocodeResult) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    
    // Evitar disparar otra búsqueda automática al actualizar el input
    lastSelectedName.current = item.display_name;
    setQuery(item.display_name);
    setIsOpen(false);
    setResults([]);
    
    onSelectLocation(lat, lon, item.display_name);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setNoResults(false);
    setIsOpen(false);
    lastSelectedName.current = '';
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchLocation(query);
  };

  return (
    <div 
      ref={dropdownRef}
      className={`w-full bg-white rounded-xl shadow-md border border-slate-200/60 z-[1000] relative select-none ${className}`}
      onClick={handleInteraction}
      onMouseDown={handleInteraction}
      onDoubleClick={handleInteraction}
      onTouchStart={handleInteraction}
      onWheel={handleInteraction}
    >
      <form onSubmit={handleSubmit} className="flex items-center h-9 md:h-9.5 px-3 gap-1.5">
        <button type="submit" className="text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center cursor-pointer">
          <Search size={16} className="stroke-[2.2]" />
        </button>
        
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0 || noResults) {
              setIsOpen(true);
            }
          }}
          placeholder="Buscar una ubicación"
          className="flex-1 bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 font-medium text-xs md:text-sm w-full h-full"
        />

        {loading && (
          <Loader2 size={15} className="text-blue-600 animate-spin mr-0.5" />
        )}

        {query && !loading && (
          <button 
            type="button" 
            onClick={handleClear}
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-all flex items-center justify-center cursor-pointer"
          >
            <X size={15} className="stroke-[2.2]" />
          </button>
        )}
      </form>

      {/* Resultados desplegables */}
      {isOpen && (results.length > 0 || noResults) && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-white rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.15)] border border-slate-200/50 overflow-hidden py-2 max-h-72 overflow-y-auto scrollbar-thin">
          {noResults ? (
            <div className="px-4 py-4 text-slate-500 font-medium text-sm text-center flex flex-col items-center gap-1.5">
              <span className="text-lg">🔍</span>
              <span>No se encontró la ubicación</span>
            </div>
          ) : (
            results.map((item) => (
              <button
                key={item.place_id}
                type="button"
                onClick={() => handleSelect(item)}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors text-slate-700 text-sm font-semibold flex flex-col gap-0.5 border-b border-slate-50 last:border-b-0 cursor-pointer"
              >
                <span className="text-slate-800 line-clamp-1">
                  {item.display_name.split(',')[0]}
                </span>
                <span className="text-slate-400 text-xs font-normal line-clamp-1">
                  {item.display_name.split(',').slice(1).join(',').trim()}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
