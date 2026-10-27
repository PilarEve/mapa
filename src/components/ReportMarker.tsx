"use client";

import { useState, useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Report } from '../types/report';
import { format } from 'date-fns';
import { Calendar, AlertCircle, CheckCircle2, Clock, XCircle, Image as ImageIcon } from 'lucide-react';

const createReportIcon = () => {
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#2563eb" width="24" height="24" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

// Instancia estática de icono para evitar recrearlo en cada renderizado
const REPORT_ICON = createReportIcon();

interface ReportMarkerProps {
  report: Report;
}

export default function ReportMarker({ report }: ReportMarkerProps) {
  const icon = useMemo(() => REPORT_ICON, []);
  const [imageError, setImageError] = useState(false);

  const isHeic = useMemo(() => {
    return report.imageUrl ? /\.(heic|heif)(\?.*)?$/i.test(report.imageUrl) : false;
  }, [report.imageUrl]);
  
  const hasDescription = useMemo(() => {
    return Boolean(report.description && report.description.trim() !== '' && report.description.trim().toLowerCase() !== 'sin descripción');
  }, [report.description]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'validado':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full capitalize">
            <CheckCircle2 size={12} className="shrink-0" />
            Verificado
          </span>
        );
      case 'rechazado':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full capitalize">
            <XCircle size={12} className="shrink-0" />
            Descartado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full capitalize" title="Información ciudadana pendiente de validación">
            <Clock size={12} className="shrink-0" />
            Pendiente de validación
          </span>
        );
    }
  };

  const formattedDate = useMemo(() => {
    try {
      return format(new Date(report.dateTime), 'dd/MM/yyyy HH:mm');
    } catch {
      return report.dateTime;
    }
  }, [report.dateTime]);

  return (
    <Marker position={[report.lat, report.lng]} icon={icon}>
      <Popup className="report-popup custom-report-popup">
        <div className="w-[260px] sm:w-[300px] max-w-[80vw] p-2.5 flex flex-col gap-2 font-sans">
          
          {/* Header con insignias unificadas */}
          <div className="flex justify-between items-center gap-2 border-b border-slate-100 pb-2">
            <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
              Reporte Ciudadano
            </span>
            {getStatusBadge(report.status)}
          </div>

          {/* Aviso informativo de reporte ciudadano no verificado */}
          {report.status === 'pendiente' && (
            <div className="bg-amber-50 border border-amber-200/90 rounded-lg p-2 text-[10.5px] text-amber-800 leading-snug flex items-start gap-1.5">
              <AlertCircle size={13} className="text-amber-600 shrink-0 mt-0.5" />
              <span>Información ciudadana en proceso de verificación por el equipo de monitoreo.</span>
            </div>
          )}

          {/* Imagen o Multimedia con soporte de fallback HEIC/HEIF sin alterar el original */}
          {report.imageUrl && (
            <div className="w-full h-40 sm:h-44 relative rounded-xl overflow-hidden shadow-sm border border-slate-100 bg-slate-900 flex items-center justify-center">
              {report.archivoTipo === 'video' ? (
                <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-400 text-xs font-medium px-4 text-center">
                  Evidencia en formato no soportado.
                </div>
              ) : isHeic || imageError ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-200 p-3 text-center">
                  <ImageIcon size={26} className="text-blue-400 mb-1.5" />
                  <span className="text-xs font-semibold text-white">Fotografía original {isHeic ? 'HEIC/HEIF' : ''}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 mb-2">Preservada sin compresión ni alteraciones</span>
                  <a 
                    href={report.imageUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-300 hover:text-white underline font-semibold"
                  >
                    Abrir archivo original
                  </a>
                </div>
              ) : (
                <img 
                  src={report.imageUrl} 
                  alt="Evidencia del reporte ciudadano" 
                  className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                  loading="lazy"
                  onError={() => setImageError(true)}
                />
              )}
            </div>
          )}

          {/* Tags de afectación */}
          {report.impactTags && report.impactTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {report.impactTags.map(tag => (
                <span key={tag} className="bg-slate-100 text-slate-700 border border-slate-200/80 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Descripción (Sólo si no está vacía) */}
          {hasDescription && (
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal max-h-24 overflow-y-auto">
              {report.description}
            </p>
          )}

          {/* Pie de datos unificado */}
          <div className="pt-2 border-t border-slate-100 flex flex-col gap-1 text-[11px] text-slate-500 font-medium">
            <div className="flex items-center gap-1.5 text-slate-600">
              <Calendar size={13} className="text-slate-400 shrink-0" />
              <span>Fecha: {formattedDate}</span>
            </div>
          </div>

        </div>
      </Popup>
    </Marker>
  );
}

