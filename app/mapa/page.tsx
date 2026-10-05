import MapClient from '@/components/MapClient';

export const metadata = {
  title: 'Mapa de Inundaciones - Área Metropolitana de Asunción',
  description: 'Mapa interactivo para monitoreo y visualización de inundaciones urbanas',
};

export default function MapaPage() {
  return (
    <main className="w-full h-[calc(100dvh-3rem)] md:h-[calc(100dvh-4rem)] overflow-hidden bg-slate-100 relative flex flex-col">
      <MapClient />
    </main>
  );
}
