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
import { Plus, ListFilter, X, Loader2, ChevronRight, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import SearchBar from './SearchBar';
import CustomZoomControl from './CustomZoomControl';


const ASUNCION_CENTER: [number, number] = [-25.2855, -57.6150];

const BASE_MAPS = {
  voyager: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  light: {
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by Humanitarian OpenStreetMap Team'
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

  const [isMobileReportsOpen, setIsMobileReportsOpen] = useState(false);

  const handleAddReport = (newReport: Report) => {
    setReports(prev => [newReport, ...prev]);
    setShowReportForm(false);
    if (mapRef) mapRef.setView([newReport.lat, newReport.lng], 15);
  };

  const handleSelectReportFromSidebar = (report: Report) => {
    if (mapRef) {
      mapRef.setView([report.lat, report.lng], 16);
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
        setIsMobileReportsOpen(false);
      }
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
      <div className="absolute bottom-6 right-3 md:bottom-8 md:right-8 z-[1000] flex flex-col gap-3 md:gap-4 items-end pointer-events-none">
        <div className="pointer-events-auto flex flex-col gap-3 items-end">
          {/* Control de Zoom Personalizado */}
          <CustomZoomControl onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />

          {/* Botón Flotante para Nuevo Reporte */}
          <button 
            type="button"
            onClick={() => setShowReportForm(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white font-bold py-3 px-5 md:py-4 md:px-8 rounded-full shadow-2xl shadow-blue-500/30 flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95 border border-blue-400/20 cursor-pointer"
          >
            <Plus size={20} className="drop-shadow-md" />
            <span className="text-xs md:text-base drop-shadow-md">Nuevo Reporte</span>
          </button>
        </div>
      </div>

      {/* Sidebar de Lista de Reportes (Solo Escritorio / Pantallas Medias) */}
      <div className={`
        hidden md:block relative top-0 left-0 h-full z-[2000] md:z-10
        transform transition-all duration-300 ease-in-out
        ${isSidebarOpen 
          ? 'w-80 md:w-96 opacity-100' 
          : 'w-0 opacity-0 overflow-hidden pointer-events-none'
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

        {/* ---------------- BARRA SUPERIOR PARA MÓVIL (Acordeones 1-línea) ---------------- */}
        <div className="md:hidden absolute top-3 left-3 right-3 z-[1000] flex flex-col gap-2 pointer-events-none">
          
          <div className="flex items-center justify-between gap-2 w-full">
            
            {/* Acordeón 1: Reportes Recientes (1 línea cerrado) */}
            <div className="pointer-events-auto relative">
              <button 
                type="button"
                onClick={() => {
                  setIsMobileReportsOpen(!isMobileReportsOpen);
                }}
                className={`bg-white/95 backdrop-blur-md text-slate-800 font-bold py-2 px-3 rounded-full shadow-lg border border-slate-200/80 flex items-center gap-1.5 text-xs transition-all active:scale-95 cursor-pointer ${
                  isMobileReportsOpen ? 'ring-2 ring-blue-500/30 bg-blue-50' : ''
                }`}
              >
                <AlertTriangle className="text-blue-600 shrink-0" size={15} />
                <span>Reportes ({filteredReports.length})</span>
                {isMobileReportsOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-400" />}
              </button>
            </div>

            {/* Acordeón 2: Visualización (FilterPanel compacto) */}
            <div className="pointer-events-auto relative">
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
                className="relative top-0 right-0"
              />
            </div>
          </div>

          {/* Desplegable Acordeón de Reportes Recientes en Móvil */}
          {isMobileReportsOpen && (
            <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 p-3 max-h-[50vh] overflow-y-auto w-full space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800">Reportes Recientes ({filteredReports.length})</span>
                <button 
                  type="button" 
                  onClick={() => setIsMobileReportsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X size={16} />
                </button>
              </div>

              {filteredReports.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No hay reportes con los filtros seleccionados.</p>
              ) : (
                filteredReports.map((report) => (
                  <div 
                    key={report.id}
                    onClick={() => handleSelectReportFromSidebar(report)}
                    className="p-3 bg-white hover:bg-blue-50/50 rounded-xl border border-slate-100 shadow-sm cursor-pointer transition-colors space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex flex-wrap gap-1">
                        {report.impactTags?.slice(0, 2).map(tag => (
                          <span key={tag} className="bg-blue-50 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <span className="text-slate-400 capitalize">{report.status}</span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium line-clamp-2">{report.description}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* SearchBar en Móvil justo debajo de los acordeones */}
          <div className="pointer-events-auto w-full">
            <SearchBar 
              onSelectLocation={handleSelectLocation}
              className="w-full relative top-0 left-0 right-0"
            />
          </div>

        </div>

        {/* ---------------- BARRA Y CONTROLES PARA ESCRITORIO (md:) ---------------- */}
        
        {/* Botón para reabrir Sidebar en Escritorio */}
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className={`hidden md:flex absolute z-[1000] bg-white/95 backdrop-blur-md text-slate-800 font-bold py-3 px-4 rounded-2xl shadow-lg flex-items-center gap-2 border border-slate-200/50 cursor-pointer transition-all duration-300 top-4 left-4 ${
            isSidebarOpen 
              ? 'opacity-0 pointer-events-none -translate-x-4 scale-95' 
              : 'opacity-100 pointer-events-auto translate-x-0 scale-100'
          }`}
          title="Mostrar reportes recientes"
        >
          <AlertTriangle className="text-blue-600 animate-pulse shrink-0" size={18} />
          <span className="text-sm font-semibold">Reportes Recientes ({filteredReports.length})</span>
          <ChevronRight size={18} className="text-slate-400" />
        </button>

        {/* SearchBar en Escritorio */}
        <div className="hidden md:block">
          <SearchBar 
            onSelectLocation={handleSelectLocation}
            className={`absolute md:w-80 lg:w-96 z-[1000] transition-all duration-300 top-4 ${
              isSidebarOpen ? 'md:left-4' : 'md:left-[290px]'
            }`}
          />
        </div>

        {/* FilterPanel en Escritorio */}
        <div className="hidden md:block">
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
            className="top-4 right-4"
          />
        </div>

        {/* Contenedor del Mapa Leaflet */}
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

