"use client";

import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Report } from '../types/report';
import { format } from 'date-fns';

const getSeverityColor = (severity: Report['severity']) => {
  switch (severity) {
    case 'bajo': return '#22c55e'; // green-500
    case 'medio': return '#eab308'; // yellow-500
    case 'alto': return '#f97316'; // orange-500
    case 'critico': return '#ef4444'; // red-500
    default: return '#3b82f6'; // blue-500
  }
};

const createCustomIcon = (severity: Report['severity']) => {
  const color = getSeverityColor(severity);
  
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32" height="32" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

interface ReportMarkerProps {
  report: Report;
}

export default function ReportMarker({ report }: ReportMarkerProps) {
  const icon = createCustomIcon(report.severity);
  
  return (
    <Marker position={[report.lat, report.lng]} icon={icon}>
      <Popup className="report-popup min-w-[250px]">
        <div className="w-64 p-0">
          {report.imageUrl && (
            <div className="-mx-5 -mt-4 mb-3">
              <img 
                src={report.imageUrl} 
                alt="Imagen del reporte" 
                className="w-full h-32 object-cover rounded-t-lg"
              />
            </div>
          )}
          <div>
            <div className="flex justify-between items-start mb-2">
              <span className="font-bold text-gray-800 text-sm">
                Severidad: <span style={{ color: getSeverityColor(report.severity) }} className="uppercase">{report.severity}</span>
              </span>
            </div>
            <p className="text-sm text-gray-700 mb-2">{report.description}</p>
            <div className="text-xs text-gray-500 flex flex-col gap-1">
              <p>Fecha: {format(new Date(report.dateTime), 'dd/MM/yyyy HH:mm')}</p>
              <p>Estado: <span className="capitalize">{report.status}</span></p>
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}
