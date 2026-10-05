"use client";

import { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mockReports } from '../data/reports';
import { Report, NoticiaHistorica } from '../types/report';
import ReportMarker from './ReportMarker';
import NewsMarker from './NewsMarker';
import FilterPanel from './FilterPanel';
import SidebarReports from './SidebarReports';
import HeatmapLayer from './HeatmapLayer';
import ReportForm from './ReportForm';
import { Plus, ListFilter, X, Loader2, ChevronRight, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import SearchBar from './SearchBar';
import CustomZoomControl from './CustomZoomControl';


const ASUNCION_CENTER: [number, number] = [-25.2855, -57.6150];

const BASE_MAPS = {
  light: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxNativeZoom: 16
  },
  voyager: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 19
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxNativeZoom: 19
  }
};

export default function MapView() {
  const [reports, setReports] = useState<Report[]>([]);
  const [news, setNews] = useState<NoticiaHistorica[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReports, setShowReports] = useState<boolean>(true);
  const [showNews, setShowNews] = useState<boolean>(true);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['pendiente', 'validado', 'rechazado']);
  const [selectedDateRange, setSelectedDateRange] = useState<string>('todo');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isHeatmapVisible, setIsHeatmapVisible] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [mapRef, setMapRef] = useState<L.Map | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeBaseMap, setActiveBaseMap] = useState<'voyager' | 'light' | 'satellite'>('light');

  // Ajustar visibilidad inicial en celular
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  // Bloquear scroll de la ventana para mantener los controles fijos bajo el header
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const handleScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      if (
        target.closest('.sidebar-scrollable') || 
        target.closest('.filter-scrollable') || 
        target.closest('.form-scrollable') ||
        target.tagName === 'TEXTAREA' || 
        target.tagName === 'INPUT'
      ) {
        return;
      }
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // Invalidar el tamaño del mapa de Leaflet al cambiar el sidebar
  useEffect(() => {
    if (mapRef) {
      const timer = setTimeout(() => {
        mapRef.invalidateSize();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isSidebarOpen, mapRef]);

  // Cargar reportes y noticias desde Supabase
  useEffect(() => {
    let isMounted = true;

    const fetchReports = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('reportes')
          .select('*')
          .order('creado_en', { ascending: false });

        if (!isMounted) return;

        if (error) {
          console.error('Error fetching reports:', error.message);
          setReports(mockReports);
        } else if (data) {
          const mappedReports: Report[] = data.map(dbReport => ({
            id: dbReport.id,
            lat: Number(dbReport.latitud),
            lng: Number(dbReport.longitud),
            description: dbReport.descripcion || 'Sin descripción',
            impactTags: dbReport.afectaciones || [],
            dateTime: dbReport.creado_en || new Date().toISOString(),
            imageUrl: dbReport.imagen_url || undefined,
            status: (dbReport.estado || 'pendiente') as Report['status'],
            archivoTipo: dbReport.archivo_tipo || null
          }));
          setReports(mappedReports);
        }

        const { data: newsData, error: newsError } = await supabase
          .from('noticias_historicas')
          .select('*')
          .order('fecha_publicacion', { ascending: false });

        if (!isMounted) return;

        if (newsError) {
          console.error('Error fetching news:', newsError.message);
        } else if (newsData) {
          const validNews = newsData
            .filter(n => 
              n.latitud != null && 
              n.longitud != null && 
              n.latitud !== '' && 
              n.longitud !== '' && 
              !isNaN(Number(n.latitud)) && 
              !isNaN(Number(n.longitud))
            )
            .map(n => ({
              ...n,
              latitud: Number(n.latitud),
              longitud: Number(n.longitud)
            })) as NoticiaHistorica[];
          setNews(validNews);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Unexpected error:', err);
          setReports(mockReports);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchReports();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredReports = useMemo(() => {
    if (!showReports) return [];
    return reports.filter(report => {
      const matchTags = selectedTags.length === 0 || 
        (report.impactTags && report.impactTags.some(tag => selectedTags.includes(tag)));

      const matchStatus = selectedStatuses.includes(report.status);

      let matchDate = true;
      if (selectedDateRange !== 'todo') {
        const dateVal = report.dateTime ? new Date(report.dateTime) : null;
        if (!dateVal || isNaN(dateVal.getTime())) {
          matchDate = false;
        } else {
          const now = new Date();
          if (selectedDateRange === 'hoy') {
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            matchDate = dateVal >= startOfToday;
          } else if (selectedDateRange === '7dias') {
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            matchDate = dateVal >= sevenDaysAgo;
          } else if (selectedDateRange === '30dias') {
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            matchDate = dateVal >= thirtyDaysAgo;
          }
        }
      }

      return matchTags && matchStatus && matchDate;
    });
  }, [reports, showReports, selectedTags, selectedStatuses, selectedDateRange]);

  const filteredNews = useMemo(() => {
    if (!showNews) return [];
    return news.filter(item => {
      let matchDate = true;
      if (selectedDateRange !== 'todo') {
        const dateVal = item.fecha_publicacion ? new Date(item.fecha_publicacion) : null;
        if (!dateVal || isNaN(dateVal.getTime())) {
          matchDate = false;
        } else {
          const now = new Date();
          if (selectedDateRange === 'hoy') {
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            matchDate = dateVal >= startOfToday;
          } else if (selectedDateRange === '7dias') {
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            matchDate = dateVal >= sevenDaysAgo;
          } else if (selectedDateRange === '30dias') {
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            matchDate = dateVal >= thirtyDaysAgo;
          }
        }
      }
      return matchDate;
    });
  }, [news, showNews, selectedDateRange]);

  const handleAddReport = (newReport: Report) => {
    setReports(prev => [newReport, ...prev]);
    setShowReportForm(false);
    if (mapRef) mapRef.setView([newReport.lat, newReport.lng], 15);
  };

  const handleSelectReportFromSidebar = (report: Report) => {
    if (mapRef) {
      mapRef.setView([report.lat, report.lng], 16);
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    }
  };

  const handleSelectLocation = (lat: number, lon: number) => {
    if (mapRef) {
      mapRef.flyTo([lat, lon], 16, {
        animate: true,
        duration: 1.5
      });
    }
  };

  const handleZoomIn = () => {
    if (mapRef) mapRef.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapRef) mapRef.zoomOut();
  };

  return (
    <div className="flex w-full h-full min-h-0 bg-slate-50 overflow-hidden relative font-sans text-slate-800">
      
      {/* Botones Flotantes Inferiores Derechos */}
      <div className="absolute bottom-5 right-4 md:bottom-8 md:right-8 z-[1000] flex flex-col gap-3 md:gap-4 items-end pointer-events-auto">
        
        {/* Control de Zoom Personalizado */}
        <CustomZoomControl onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />

        {/* Botón Ver Reportes (Solo Móvil) */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`md:hidden bg-white text-slate-700 font-bold py-3 px-4 rounded-full shadow-lg flex items-center gap-2 transition-all transform active:scale-95 border border-slate-200 cursor-pointer ${isSidebarOpen ? 'bg-slate-100' : ''}`}
        >
          {isSidebarOpen ? <X size={18} /> : <ListFilter size={18} />}
          <span className="text-xs font-semibold">{isSidebarOpen ? 'Cerrar Lista' : 'Ver Reportes'}</span>
        </button>

        {/* Botón Flotante para Nuevo Reporte */}
        <button 
          onClick={() => setShowReportForm(true)}
          className="bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white font-bold py-3 px-5 md:py-3.5 md:px-7 rounded-full shadow-xl shadow-blue-600/30 flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95 border border-blue-400/20 cursor-pointer"
        >
          <Plus size={20} className="drop-shadow-xs" />
          <span className="text-xs md:text-sm drop-shadow-xs font-bold">Nuevo Reporte</span>
        </button>

      </div>

      {/* Overlay Oscuro para móvil cuando el sidebar está abierto */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[1500] md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar de Lista de Reportes */}
      <div className={`
        fixed top-16 md:top-0 left-0 h-[calc(100dvh-4rem)] md:h-full z-[2500] md:z-10 md:relative
        transform transition-all duration-300 ease-in-out
        ${isSidebarOpen 
          ? 'translate-x-0 w-[85vw] max-w-[360px] md:w-96 opacity-100' 
          : '-translate-x-full md:translate-x-0 md:w-0 md:opacity-0 md:overflow-hidden pointer-events-none'
        }
      `}>
        <SidebarReports 
          reports={filteredReports} 
          onSelectReport={handleSelectReportFromSidebar} 
          onCollapse={() => setIsSidebarOpen(false)}
        />
      </div>

      {/* Contenedor Principal del Mapa */}
      <div className="flex-1 min-w-0 relative h-full overflow-hidden">
        {/* Botón flotante para abrir el sidebar (Reportes Recientes) */}
        <button
          onClick={() => setIsSidebarOpen(true)}
          className={`fixed top-[52px] md:top-[76px] z-[3000] bg-white/95 backdrop-blur-md text-slate-800 font-bold h-9 px-2.5 md:h-auto md:py-1.5 md:px-2.5 rounded-xl shadow-sm flex items-center justify-center gap-1.5 md:gap-2 border border-slate-200/60 cursor-pointer transition-all duration-300
            ${isSidebarOpen 
              ? 'opacity-0 pointer-events-none -translate-x-4 scale-95' 
              : 'opacity-100 pointer-events-auto translate-x-0 scale-100'
            }
            left-3
          `}
          title="Mostrar reportes recientes"
          aria-label="Mostrar reportes recientes"
        >
          <AlertTriangle className="text-blue-600 shrink-0" size={16} />
          <span className="text-xs font-bold hidden md:inline">Reportes Recientes</span>
          <span className="bg-blue-50 text-blue-700 text-[11px] font-extrabold px-1.5 py-0.5 rounded-full border border-blue-100 shrink-0">
            {filteredReports.length}
          </span>
          <ChevronRight size={14} className="text-slate-400 hidden md:inline" />
        </button>

        {/* Barra de Búsqueda de Ubicación */}
        <SearchBar 
          onSelectLocation={handleSelectLocation}
          className={`fixed top-[52px] md:top-[76px] left-1/2 -translate-x-1/2 z-[3000] transition-all duration-300 
            w-[calc(100vw-110px)] max-w-[200px] sm:max-w-[240px] md:w-64 lg:w-72 md:max-w-none
          `}
        />

        {/* Panel de Filtros */}
        <FilterPanel 
          showReports={showReports}
          onShowReportsChange={setShowReports}
          showNews={showNews}
          onShowNewsChange={setShowNews}
          selectedStatuses={selectedStatuses}
          onStatusesChange={setSelectedStatuses}
          selectedDateRange={selectedDateRange}
          onDateRangeChange={setSelectedDateRange}
          selectedTags={selectedTags}
          onTagsChange={setSelectedTags}
          isHeatmapVisible={isHeatmapVisible}
          onToggleHeatmap={setIsHeatmapVisible}
          activeBaseMap={activeBaseMap}
          onChangeBaseMap={setActiveBaseMap}
          className="fixed top-[52px] md:top-[76px] right-3 z-[3000]"
        />

        <MapContainer 
          center={ASUNCION_CENTER} 
          zoom={13} 
          zoomControl={false}
          className="w-full h-full z-0"
          style={{ height: '100%', width: '100%' }}
          ref={setMapRef}
        >
          {/* Mapa Base Dinámico */}
          <TileLayer
            key={activeBaseMap}
            url={BASE_MAPS[activeBaseMap].url}
            attribution={BASE_MAPS[activeBaseMap].attribution}
            maxNativeZoom={BASE_MAPS[activeBaseMap].maxNativeZoom}
            maxZoom={19}
          />

          {!isHeatmapVisible && filteredReports.map(report => (
            <ReportMarker key={report.id} report={report} />
          ))}

          {!isHeatmapVisible && filteredNews.map(noticia => (
            <NewsMarker key={`news-${noticia.id}`} news={noticia} />
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
      
      {/* Indicador de Carga */}
      {loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[3000] bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-blue-100 flex items-center gap-2">
          <Loader2 size={16} className="text-blue-600 animate-spin" />
          <span className="text-xs font-semibold text-slate-700">Cargando datos del mapa...</span>
        </div>
      )}
    </div>
  );
}


