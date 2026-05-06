"use client";

import dynamic from 'next/dynamic';

// Importamos el mapa dinámicamente asegurando que no se ejecute en el servidor (ssr: false)
// Esto es requerido para componentes de Leaflet que dependen del objeto window.
const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-100 text-blue-700 min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-semibold text-lg animate-pulse">Cargando mapa interactivo...</p>
      </div>
    </div>
  )
});

export default function MapClient() {
  return <MapView />;
}
