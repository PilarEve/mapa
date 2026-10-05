"use client";

import { useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { NoticiaHistorica } from '../types/report';
import { format } from 'date-fns';
import { Calendar, ExternalLink, MapPin, AlertCircle, FileText } from 'lucide-react';

const createNewsIcon = () => {
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#d97706" width="24" height="24" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3" fill="#ffffff"></circle>
    </svg>
  `;

  return L.divIcon({
    className: 'custom-leaflet-icon bg-transparent border-0',
    html: svgIcon,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
};

const NEWS_ICON = createNewsIcon();

interface NewsMarkerProps {
  news: NoticiaHistorica;
}

export default function NewsMarker({ news }: NewsMarkerProps) {
  const icon = useMemo(() => NEWS_ICON, []);
  
  const descripcionMostrar = news.descripcion?.trim() || news.titulo;
  const hasValue = (val: string | undefined | null) => Boolean(val && val.trim() !== "");

  const formattedDate = useMemo(() => {
    if (!news.fecha_publicacion) return null;
    try {
      return format(new Date(news.fecha_publicacion), 'dd/MM/yyyy');
    } catch {
      return news.fecha_publicacion;
    }
  }, [news.fecha_publicacion]);

  return (
    <Marker position={[news.latitud, news.longitud]} icon={icon}>
      <Popup className="report-popup custom-news-popup">
        <div className="w-[280px] sm:w-[320px] max-w-[85vw] p-3 flex flex-col gap-2.5 font-sans">
          
          {/* Header con insignias unificadas */}
          <div className="flex justify-between items-center gap-2 border-b border-slate-100 pb-2">
            <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
              Noticia Histórica
            </span>
            {hasValue(news.gravedad) && (
              <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full capitalize">
                Gravedad: {news.gravedad}
              </span>
            )}
          </div>

          {/* Título de la Noticia */}
          <h3 className="font-bold text-slate-900 text-sm leading-snug">
            {news.titulo}
          </h3>

          {/* Imagen de la noticia */}
          {news.imagen_url && (
            <div className="w-full h-40 sm:h-44 relative rounded-xl overflow-hidden shadow-sm border border-slate-100 bg-slate-900 flex items-center justify-center">
              <img 
                src={news.imagen_url} 
                alt="Imagen asociada a la noticia histórica" 
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                loading="lazy"
              />
            </div>
          )}

          {/* Descripción */}
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal max-h-24 overflow-y-auto">
            {descripcionMostrar}
          </p>

          {/* Pie de datos unificado */}
          <div className="pt-2 border-t border-slate-100 flex flex-col gap-1 text-[11px] text-slate-500 font-medium">
            {formattedDate && (
              <div className="flex items-center gap-1.5 text-slate-600">
                <Calendar size={13} className="text-slate-400 shrink-0" />
                <span>Fecha: {formattedDate}</span>
              </div>
            )}
            
            {hasValue(news.fuente) && (
              <div className="flex items-center gap-1.5 text-slate-600">
                <FileText size={13} className="text-slate-400 shrink-0" />
                <span>Fuente: <span className="italic text-slate-700">{news.fuente}</span></span>
              </div>
            )}

            {hasValue(news.ubicacion_texto) && (
              <div className="flex items-start gap-1.5 text-slate-600 mt-0.5">
                <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                <span className="line-clamp-1">{news.ubicacion_texto}</span>
              </div>
            )}
          </div>

          {/* Botón Acción - Ver noticia completa */}
          {news.url && (
            <div className="pt-1">
              <a 
                href={news.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 hover:border-amber-300 transition-all duration-200 py-2 rounded-xl text-center shadow-2xs"
              >
                <span>Ver Noticia Completa</span>
                <ExternalLink size={13} />
              </a>
            </div>
          )}

        </div>
      </Popup>
    </Marker>
  );
}

