"use client";

import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { NoticiaHistorica } from '../types/report';
import { format } from 'date-fns';

const ORANGE_COLOR = '#f97316'; // orange-500

const createCustomIcon = () => {
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${ORANGE_COLOR}" width="32" height="32" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3" fill="white"></circle>
    </svg>
  `;

  return L.divIcon({
    className: 'custom-leaflet-icon bg-transparent border-0',
    html: svgIcon,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

interface NewsMarkerProps {
  news: NoticiaHistorica;
}

export default function NewsMarker({ news }: NewsMarkerProps) {
  const icon = createCustomIcon();
  
  return (
    <Marker position={[news.latitud, news.longitud]} icon={icon}>
      <Popup className="report-popup min-w-[250px]">
        <div className="w-64 p-0">
          <div>
            <div className="flex justify-between items-start mb-2">
              <span className="font-bold text-gray-800 text-sm">
                {news.titulo}
              </span>
            </div>
            
            <div className="text-xs text-gray-600 mb-2 font-semibold">
              <p>Fuente: {news.fuente}</p>
            </div>
            
            <p className="text-sm text-gray-700 mb-2">
              Ubicación: {news.ubicacion_texto}
            </p>
            
            <div className="text-xs text-gray-500 flex flex-col gap-1 mb-2">
              {news.fecha_publicacion && (
                <p>Fecha: {format(new Date(news.fecha_publicacion), 'dd/MM/yyyy')}</p>
              )}
              <p>Tipo: <span className="capitalize">{news.tipo_evento}</span></p>
              <p>Gravedad: <span className="capitalize text-orange-600">{news.gravedad}</span></p>
            </div>

            {news.url && (
              <a 
                href={news.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 underline mt-1 inline-block"
              >
                Ver noticia original
              </a>
            )}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}
