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
  voyager: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  }
};

export default function MapView() {
  const [reports, setReports] = useState<Report[]>([]); // Inicializamos vacío
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

  // Ajustar la visibilidad inicial según el ancho de la pantalla
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  // Evitar scroll en el body y html de la página
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyHeight = document.body.style.height;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalHtmlHeight = document.documentElement.style.height;

    document.body.style.overflow = 'hidden';
    document.body.style.height = '100%';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100%';

    const handleScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };

    const preventContainerScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target || !target.tagName) return;

      // Permitir scroll en áreas correspondientes (sidebar, filtros, formularios, etc.)
      if (
        target.closest('.sidebar-scrollable') || 
        target.closest('.filter-scrollable') || 
        target.closest('.form-scrollable') ||
        target.tagName === 'TEXTAREA' || 
        target.tagName === 'INPUT'
      ) {
        return;
      }

      if (target.scrollTop !== 0) {
        target.scrollTop = 0;
      }
      if (target.scrollLeft !== 0) {
        target.scrollLeft = 0;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: false });
    window.addEventListener('scroll', preventContainerScroll, { capture: true, passive: true });

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.height = originalBodyHeight;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.documentElement.style.height = originalHtmlHeight;
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', preventContainerScroll, { capture: true });
    };
  }, []);

  // Invalidar el tamaño del mapa de Leaflet cuando el sidebar se colapsa/despliega
  useEffect(() => {
    if (mapRef) {
      const timer = setTimeout(() => {
        mapRef.invalidateSize();
      }, 350); // Ligeramente mayor que la transición del sidebar (300ms)
      return () => clearTimeout(timer);
    }
  }, [isSidebarOpen, mapRef]);

  // Cargar reportes desde Supabase al montar el componente
  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('reportes')
          .select('*')
          .order('creado_en', { ascending: false });

        if (error) {
          console.error('Error fetching reports:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
          });
          setReports(mockReports);
        } else if (data) {
          // Mapeamos los datos de la DB a nuestro formato de Report
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

        if (newsError) {
          console.error('Error fetching news:', {
            message: newsError.message,
            code: newsError.code,
            details: newsError.details,
            hint: newsError.hint
          });
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
            .map(n => {
              const parsedLat = Number(n.latitud);
              const parsedLng = Number(n.longitud);
              console.log('Noticia Histórica:', n.titulo, '| Lat:', parsedLat, '| Lng:', parsedLng);
              return {
                ...n,
                latitud: parsedLat,
                longitud: parsedLng
              };
            }) as NoticiaHistorica[];
          setNews(validNews);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setReports(mockReports);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  const filteredReports = useMemo(() => {
    if (!showReports) return [];
    return reports.filter(report => {
      // 1. Filtro por afectaciones (Tags)
      const matchTags = selectedTags.length === 0 || 
        (report.impactTags && report.impactTags.some(tag => selectedTags.includes(tag)));

      // 2. Filtro por estado del reporte
      const matchStatus = selectedStatuses.includes(report.status);

      // 3. Filtro por fecha
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
    if (mapRef) {
      mapRef.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapRef) {
      mapRef.zoomOut();
    }
  };

  return (
    <div className="flex w-full h-full min-h-0 bg-slate-50 overflow-hidden relative font-sans text-slate-800">
      
      {/* Botones Flotantes Inferiores Derechos */}
      <div className="absolute bottom-24 right-4 md:bottom-8 md:right-8 z-[1000] flex flex-col gap-3 md:gap-4 items-end">
        
        {/* Control de Zoom Personalizado */}
        <CustomZoomControl onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />

        {/* Botón Ver Reportes (Solo Móvil) */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`md:hidden bg-white text-slate-700 font-bold py-3.5 px-5 rounded-full shadow-[0_8px_20px_rgb(0,0,0,0.15)] flex items-center gap-2 transition-all transform active:scale-95 border border-slate-200 ${isSidebarOpen ? 'bg-slate-100' : ''}`}
        >
          {isSidebarOpen ? <X size={20} /> : <ListFilter size={20} />}
          <span className="text-sm">{isSidebarOpen ? 'Cerrar Lista' : 'Ver Reportes'}</span>
        </button>

        {/* Botón Flotante para Nuevo Reporte */}
        <button 
          onClick={() => setShowReportForm(true)}
          className="bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white font-bold py-3.5 px-6 md:py-4 md:px-8 rounded-full shadow-2xl shadow-blue-500/30 flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95 border border-blue-400/20"
        >
          <Plus size={22} className="drop-shadow-md" />
          <span className="text-sm md:text-base drop-shadow-md">Nuevo Reporte</span>
        </button>

      </div>

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
        transform transition-all duration-300 ease-in-out
        ${isSidebarOpen 
          ? 'translate-x-0 w-80 md:w-96 opacity-100' 
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
        {/* Botón flotante para abrir el sidebar */}
        <button
          onClick={() => setIsSidebarOpen(true)}
          className={`absolute z-[1000] bg-white/95 backdrop-blur-md text-slate-800 font-bold py-3 px-4 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-between md:justify-start gap-2 border border-slate-200/50 cursor-pointer transition-all duration-300
            ${isSidebarOpen 
              ? 'opacity-0 pointer-events-none -translate-y-4 md:-translate-x-4 md:translate-y-0 scale-95' 
              : 'opacity-100 pointer-events-auto translate-y-0 translate-x-0 scale-100'
            }
            top-4 left-4 right-4 md:right-auto md:w-auto
          `}
          title="Mostrar reportes recientes"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-blue-600 animate-pulse shrink-0" size={18} />
            <span className="text-sm font-semibold truncate">Reportes Recientes</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full border border-blue-100 shrink-0">
              {filteredReports.length}
            </span>
            <ChevronRight size={18} className="text-slate-400 hidden md:inline" />
          </div>
        </button>

        {/* Barra de Búsqueda de Ubicación */}
        <SearchBar 
          onSelectLocation={handleSelectLocation}
          className={`absolute left-4 right-4 md:right-auto md:w-80 lg:w-96 z-[1000] transition-all duration-300
            ${isSidebarOpen 
              ? 'top-4 md:left-4' 
              : 'top-[68px] md:top-4 md:left-[290px]'
            }
          `}
        />

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
          className={`transition-all duration-300 right-4 md:right-4 md:top-4
            ${isSidebarOpen 
              ? 'top-[68px]' 
              : 'top-[132px]'
            }
          `}
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
            url={BASE_MAPS[activeBaseMap].url}
            attribution={BASE_MAPS[activeBaseMap].attribution}
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
          <Loader2 size={18} className="text-blue-600 animate-spin" />
          <span className="text-sm font-medium text-slate-600">Actualizando datos...</span>
        </div>
      )}
    </div>
  );
}
