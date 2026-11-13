"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mockReports } from '../data/reports';
import { Report, NoticiaHistorica } from '../types/report';
import ReportMarker from './ReportMarker';
import NewsMarker from './NewsMarker';
import QuickFilters from './QuickFilters';
import FilterPanel, { DEFAULT_DATE_RANGE, DEFAULT_STATUSES } from './FilterPanel';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { useFiltersUI } from './FiltersUIContext';
import { parseVista } from '@/lib/mapVista';
import SidebarReports from './SidebarReports';
import HeatmapLayer from './HeatmapLayer';
import ReportForm from './ReportForm';
import { Plus, ListFilter, X, Loader2, ChevronRight, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { buildActivityItems, getNewsDate, getReportDate, matchesDateRange, type ActivityItem } from '@/lib/activity';
import SearchBar from './SearchBar';
import CustomZoomControl from './CustomZoomControl';


const ASUNCION_CENTER: [number, number] = [-25.2855, -57.6150];
const SELECTED_ITEM_ZOOM = 16;

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
  // La categoría visible se deriva de la URL (?vista=reportes|noticias); sin parámetro, se muestra todo.
  const vista = parseVista(useSearchParams().get('vista'));
  const showReports = vista !== 'noticias';
  const showNews = vista !== 'reportes';
  const { isOpen: isFiltersOpen, close: closeFilters, anchorEl: filtersAnchor } = useFiltersUI();
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(DEFAULT_STATUSES);
  const [selectedDateRange, setSelectedDateRange] = useState<string>(DEFAULT_DATE_RANGE);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isHeatmapVisible, setIsHeatmapVisible] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [mapRef, setMapRef] = useState<L.Map | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeBaseMap, setActiveBaseMap] = useState<'voyager' | 'light' | 'satellite'>('light');
  const itemMarkers = useRef(new Map<string, L.Marker>());
  const cancelPendingSelection = useRef<(() => void) | null>(null);

  const handleMarkerChange = useCallback((key: string, marker: L.Marker | null) => {
    if (marker) {
      itemMarkers.current.set(key, marker);
    } else {
      itemMarkers.current.delete(key);
    }
  }, []);

  useEffect(() => () => cancelPendingSelection.current?.(), []);

  // Al salir del mapa, el panel de filtros no debe quedar marcado como abierto.
  useEffect(() => closeFilters, [closeFilters]);

  // El mapa de calor solo representa reportes: en la vista de noticias no se aplica (el valor guardado se conserva).
  const isHeatmapActive = isHeatmapVisible && vista !== 'noticias';

  // Ajustar visibilidad inicial según tamaño de pantalla
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
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
        const [webRes, whatsappRes] = await Promise.all([
          supabase
            .from('reportes')
            .select('*')
            .neq('estado', 'rechazado')
            .order('creado_en', { ascending: false }),
          supabase
            .from('reportes_whatsapp')
            .select('*')
            .neq('estado', 'rechazado')
            .order('creado_en', { ascending: false }),
        ]);

        if (!isMounted) return;

        if (webRes.error) {
          console.error('Error fetching reports:', webRes.error.message);
        }
        if (whatsappRes.error) {
          console.error('Error fetching reportes_whatsapp:', whatsappRes.error.message);
        }

        if (webRes.error && whatsappRes.error) {
          setReports(mockReports);
        } else {
          const mapDbRow = (dbReport: Record<string, unknown>, origen: 'web' | 'whatsapp'): Report | null => {
            const lat = Number(dbReport.latitud);
            const lng = Number(dbReport.longitud);
            if (dbReport.latitud == null || dbReport.longitud == null || isNaN(lat) || isNaN(lng)) {
              return null;
            }
            const rawEstado = (dbReport.estado as string) || 'pendiente';
            const normalizedStatus = (rawEstado === 'aprobado' ? 'validado' : rawEstado) as Report['status'];
            return {
              id: String(dbReport.id),
              lat,
              lng,
              description: (dbReport.descripcion as string) || 'Sin descripción',
              impactTags: (dbReport.afectaciones as string[]) || [],
              dateTime: (dbReport.creado_en as string) || '',
              imageUrl: (dbReport.imagen_url as string) || undefined,
              status: normalizedStatus,
              archivoTipo: (dbReport.archivo_tipo as string) || null,
              origen,
            };
          };

          const mappedWeb = (webRes.data || [])
            .map((r) => mapDbRow(r, 'web'))
            .filter((r): r is Report => r !== null);

          const mappedWhatsapp = (whatsappRes.data || [])
            .map((r) => mapDbRow(r, 'whatsapp'))
            .filter((r): r is Report => r !== null);

          const combinedReports = [...mappedWeb, ...mappedWhatsapp].sort((a, b) => {
            const dateA = a.dateTime ? new Date(a.dateTime).getTime() : 0;
            const dateB = b.dateTime ? new Date(b.dateTime).getTime() : 0;
            return dateB - dateA;
          });

          setReports(combinedReports);
        }

        const [datasetRes, manualRes] = await Promise.all([
          supabase
            .from('dataset_principal')
            .select('*')
            .order('fecha_publicacion', { ascending: false }),
          supabase
            .from('noticias_historicas')
            .select('*')
            .order('fecha_publicacion', { ascending: false })
        ]);

        if (!isMounted) return;

        if (datasetRes.error) {
          console.error('Error fetching dataset_principal:', datasetRes.error.message);
        }
        if (manualRes.error) {
          console.error('Error fetching noticias_historicas:', manualRes.error.message);
        }

        const rawNews = [
          ...(datasetRes.data || []),
          ...(manualRes.data || [])
        ];

        if (rawNews.length > 0) {
          const seenIds = new Set();
          const uniqueNews = rawNews.filter(n => {
            if (!n.id || seenIds.has(n.id)) return false;
            seenIds.add(n.id);
            return true;
          });

          const validNews = uniqueNews
            .filter(n => 
              n.latitud != null && 
              n.longitud != null && 
              n.latitud !== '' && 
              n.longitud !== '' && 
              !isNaN(Number(n.latitud)) && 
              !isNaN(Number(n.longitud))
            )
            .map(n => {
              let lat = Number(n.latitud);
              const lng = Number(n.longitud);
              // Si la latitud en el área de Asunción/Paraguay se cargó positiva por error (+25 en vez de -25), normalizarla
              if (lat > 18 && lat < 30) {
                lat = -lat;
              }
              return {
                ...n,
                latitud: lat,
                longitud: lng
              };
            }) as NoticiaHistorica[];

          validNews.sort((a, b) => {
            const dateA = a.fecha_publicacion ? new Date(a.fecha_publicacion).getTime() : 0;
            const dateB = b.fecha_publicacion ? new Date(b.fecha_publicacion).getTime() : 0;
            return dateB - dateA;
          });

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
      // Excluir reportes rechazados del mapa público, la lista lateral y el mapa de calor
      if (report.status === 'rechazado') return false;

      const matchTags = selectedTags.length === 0 || 
        (report.impactTags && report.impactTags.some(tag => selectedTags.includes(tag)));

      const matchStatus = selectedStatuses.includes(report.status);

      return matchTags && matchStatus && matchesDateRange(getReportDate(report), selectedDateRange);
    });
  }, [reports, showReports, selectedTags, selectedStatuses, selectedDateRange]);

  const filteredNews = useMemo(() => {
    if (!showNews) return [];
    return news.filter(item => matchesDateRange(getNewsDate(item), selectedDateRange));
  }, [news, showNews, selectedDateRange]);

  // Única fuente de los elementos visibles: de aquí salen tanto los marcadores como la lista lateral.
  const activityItems = useMemo(
    () => buildActivityItems(filteredReports, filteredNews),
    [filteredReports, filteredNews]
  );

  // Restablece solo filtros de estado, fecha y afectaciones: no cambia la categoría, el mapa base ni el mapa de calor.
  const handleResetFilters = () => {
    setSelectedStatuses(DEFAULT_STATUSES);
    setSelectedDateRange(DEFAULT_DATE_RANGE);
    setSelectedTags([]);
  };

  const handleAddReport = (newReport: Report) => {
    setReports(prev => [newReport, ...prev]);
    // Asegurar que el reporte recién enviado sea visible para el usuario activando la vista de pendientes
    setSelectedStatuses(prev => prev.includes('pendiente') ? prev : [...prev, 'pendiente']);
    setShowReportForm(false);
    if (mapRef) mapRef.setView([newReport.lat, newReport.lng], 15);
  };

  const handleSelectItemFromSidebar = (item: ActivityItem) => {
    if (!mapRef) return;
    const map = mapRef;
    const target = L.latLng(item.lat, item.lng);
    let retried = false;

    const onMoveEnd = () => {
      const centered =
        map.getZoom() === SELECTED_ITEM_ZOOM &&
        map.latLngToContainerPoint(target).distanceTo(map.getSize().divideBy(2)) <= 2;

      // Leaflet ignora setView durante una animación de zoom: se reintenta al terminar.
      if (!centered && !retried) {
        retried = true;
        map.once('moveend', onMoveEnd);
        map.setView(target, SELECTED_ITEM_ZOOM);
        return;
      }

      cancelPendingSelection.current = null;
      // El marcador se busca al llegar: un filtro o el mapa de calor pudieron quitarlo durante el movimiento.
      const marker = itemMarkers.current.get(item.key);
      if (marker?.getPopup() && map.hasLayer(marker)) marker.openPopup();
    };

    cancelPendingSelection.current?.();
    map.closePopup();
    // Detener un paneo en curso antes de escuchar: al cortarse dispara un moveend que no es de esta selección.
    map.stop();
    cancelPendingSelection.current = () => map.off('moveend', onMoveEnd);
    // Registrar antes de setView: si no hay movimiento, moveend se dispara de forma síncrona.
    map.once('moveend', onMoveEnd);
    map.setView(target, SELECTED_ITEM_ZOOM);

    if (window.innerWidth < 768) setIsSidebarOpen(false);
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
          <span className="text-xs font-semibold">{isSidebarOpen ? 'Cerrar Lista' : 'Ver Actividad'}</span>
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

      {/* Sidebar de Actividad Reciente */}
      <div className={`
        fixed top-16 md:top-0 left-0 h-[calc(100dvh-4rem)] md:h-full z-[2500] md:z-10 md:relative
        transform transition-all duration-300 ease-in-out
        ${isSidebarOpen 
          ? 'translate-x-0 w-[85vw] max-w-[360px] md:w-96 opacity-100' 
          : '-translate-x-full md:translate-x-0 md:w-0 md:opacity-0 md:overflow-hidden pointer-events-none'
        }
      `}>
        <SidebarReports 
          items={activityItems}
          onSelectItem={handleSelectItemFromSidebar}
          onCollapse={() => setIsSidebarOpen(false)}
        />
      </div>

      {/* Contenedor Principal del Mapa */}
      <div className="flex-1 min-w-0 relative h-full overflow-hidden">
        {/* Botón flotante para abrir el sidebar (Actividad reciente) */}
        <button
          onClick={() => setIsSidebarOpen(true)}
          className={`fixed top-[52px] md:top-[76px] z-[3000] bg-white/95 backdrop-blur-md text-slate-800 font-bold h-9 px-2.5 md:h-auto md:py-1.5 md:px-2.5 rounded-xl shadow-sm flex items-center justify-center gap-1.5 md:gap-2 border border-slate-200/60 cursor-pointer transition-all duration-300
            ${isSidebarOpen 
              ? 'opacity-0 pointer-events-none -translate-x-4 scale-95' 
              : 'opacity-100 pointer-events-auto translate-x-0 scale-100'
            }
            left-3
          `}
          title="Mostrar actividad reciente"
          aria-label="Mostrar actividad reciente"
        >
          <AlertTriangle className="text-blue-600 shrink-0" size={16} />
          <span className="text-xs font-bold hidden md:inline">Actividad reciente</span>
          <span className="bg-blue-50 text-blue-700 text-[11px] font-extrabold px-1.5 py-0.5 rounded-full border border-blue-100 shrink-0">
            {activityItems.length}
          </span>
          <ChevronRight size={14} className="text-slate-400 hidden md:inline" />
        </button>

        {/* Bloque flotante superior: buscador arriba, afectaciones rápidas debajo.
            Es un único contenedor absoluto dentro del mapa (queda bajo el header y centrado en el espacio libre
            junto al sidebar), así que ambos controles se apilan sin superponerse. */}
        <div
          className={`absolute top-1 md:top-3 left-1/2 -translate-x-1/2 z-[3000] max-w-[calc(100%-1.5rem)] flex-col items-center gap-2 pointer-events-none
            ${isSidebarOpen ? 'hidden md:flex' : 'flex'}
          `}
        >
          <SearchBar
            onSelectLocation={handleSelectLocation}
            className="pointer-events-auto w-[calc(100vw-110px)] max-w-[200px] sm:max-w-[240px] md:w-64 lg:w-72 md:max-w-none"
          />
          {vista !== 'noticias' && (
            <QuickFilters
              selectedTags={selectedTags}
              onTagsChange={setSelectedTags}
              className="pointer-events-auto flex max-w-full px-0.5 py-0.5"
            />
          )}
        </div>

        {/* Panel de Filtros: se renderiza dentro del ancla del botón "Filtros" del header */}
        {isFiltersOpen && filtersAnchor && createPortal(
          <FilterPanel
            vista={vista}
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
            onReset={handleResetFilters}
          />,
          filtersAnchor
        )}

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

          {!isHeatmapActive && activityItems.map(item => (
            item.kind === 'reporte' ? (
              <ReportMarker key={item.key} report={item.report} markerKey={item.key} onMarkerChange={handleMarkerChange} />
            ) : (
              <NewsMarker key={item.key} news={item.news} markerKey={item.key} onMarkerChange={handleMarkerChange} />
            )
          ))}

          <HeatmapLayer 
            reports={filteredReports} 
            isVisible={isHeatmapActive} 
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


