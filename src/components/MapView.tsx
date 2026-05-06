"use client";

import { useState, useMemo } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mockReports } from '../data/reports';
import { Report, Severity } from '../types/report';
import ReportMarker from './ReportMarker';
import FilterPanel from './FilterPanel';
import SidebarReports from './SidebarReports';
import HeatmapLayer from './HeatmapLayer';
import ReportForm from './ReportForm';
import { Plus, Menu, X } from 'lucide-react';

const ASUNCION_CENTER: [number, number] = [-25.2855, -57.6150];

export default function MapView() {
  const [reports, setReports] = useState<Report[]>(mockReports);
  const [selectedSeverities, setSelectedSeverities] = useState<Severity[]>(['bajo', 'medio', 'alto', 'critico']);
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [isHeatmapVisible, setIsHeatmapVisible] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [mapRef, setMapRef] = useState<L.Map | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Para móviles

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const matchSeverity = selectedSeverities.includes(report.severity);
      const matchStatus = selectedStatus === 'todos' || report.status === selectedStatus;
      return matchSeverity && matchStatus;
    });
  }, [reports, selectedSeverities, selectedStatus]);

  const handleFilterChange = (severities: Severity[], status: string) => {
    setSelectedSeverities(severities);
    setSelectedStatus(status);
  };

  const handleAddReport = (newReportData: Omit<Report, 'id' | 'status'>) => {
    const newReport: Report = {
      ...newReportData,
      id: `R${Math.floor(Math.random() * 10000)}`,
      status: 'pendiente'
    };
    setReports(prev => [newReport, ...prev]);
    setShowReportForm(false);
    if (mapRef) mapRef.setView([newReport.lat, newReport.lng], 15);
  };

  const handleSelectReportFromSidebar = (report: Report) => {
    if (mapRef) {
      mapRef.setView([report.lat, report.lng], 16);
      if (window.innerWidth < 768) setIsSidebarOpen(false); // Cierra sidebar en móvil
    }
  };

  return (
    <div className="flex w-full h-screen bg-slate-50 overflow-hidden relative font-sans text-slate-800">
      
      {/* Botón Flotante para Menú Móvil */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden absolute top-4 left-4 z-[2000] bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-lg text-slate-700 transition-all hover:bg-white"
      >
        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Botón Flotante para Nuevo Reporte */}
      <button 
        onClick={() => setShowReportForm(true)}
        className="absolute bottom-6 right-6 md:bottom-8 md:right-8 z-[1000] bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white font-bold py-3 md:py-4 px-6 md:px-8 rounded-full shadow-2xl shadow-blue-500/30 flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95 border border-blue-400/20"
      >
        <Plus size={22} className="drop-shadow-md" />
        <span className="text-sm md:text-base drop-shadow-md">Nuevo Reporte</span>
      </button>

      {/* Overlay Oscuro para móvil cuando el sidebar está abierto */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[1500] md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar de Lista de Reportes */}
      <div className={`
        fixed md:relative top-0 left-0 h-full z-[2000] md:z-10
        transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <SidebarReports 
          reports={filteredReports} 
          onSelectReport={handleSelectReportFromSidebar} 
        />
      </div>

      {/* Contenedor Principal del Mapa */}
      <div className="flex-1 relative h-full w-full">
        <FilterPanel 
          selectedSeverities={selectedSeverities}
          selectedStatus={selectedStatus}
          onFilterChange={handleFilterChange}
          isHeatmapVisible={isHeatmapVisible}
          onToggleHeatmap={setIsHeatmapVisible}
        />

        <MapContainer 
          center={ASUNCION_CENTER} 
          zoom={13} 
          zoomControl={false}
          className="w-full h-full z-0"
          ref={setMapRef}
        >
          {/* Mapa Base: CartoDB Positron */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          />

          {!isHeatmapVisible && filteredReports.map(report => (
            <ReportMarker key={report.id} report={report} />
          ))}

          <HeatmapLayer 
            reports={filteredReports} 
            isVisible={isHeatmapVisible} 
          />
        </MapContainer>
      </div>

      {/* Modal de Nuevo Reporte */}
      {showReportForm && (
        <ReportForm 
          onClose={() => setShowReportForm(false)} 
          onSubmit={handleAddReport} 
        />
      )}
    </div>
  );
}
