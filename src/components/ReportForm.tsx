"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { Report } from '../types/report';
import { MapPin, Camera, Image as ImageIcon, X, Loader2, AlertTriangle, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';


const AVAILABLE_TAGS = [
  'Calle inundada',
  'Deslizamiento',
  'Árbol caído',
  'Vivienda afectada',
  'Vehículo afectado',
  'Persona atrapada',
  'Fallecimiento reportado',
  'Interrupción de tránsito',
  'Servicio público afectado',
  'Acumulación de basura',
  'Sin daños visibles'
];
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const defaultIcon = L.divIcon({
  className: 'custom-leaflet-icon bg-transparent border-0',
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3b82f6" width="32" height="32" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3" fill="white"></circle>
    </svg>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

function LocationSelector({ setLocation }: { setLocation: (lat: string, lng: string) => void }) {
  useMapEvents({
    click(e) {
      setLocation(e.latlng.lat.toString(), e.latlng.lng.toString());
    },
  });
  return null;
}

function MapUpdater({ lat, lng }: { lat: string; lng: string }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.flyTo([parseFloat(lat), parseFloat(lng)], map.getZoom() < 15 ? 15 : map.getZoom(), { animate: true });
    }
  }, [lat, lng, map]);
  return null;
}

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

interface ReportFormProps {
  onClose: () => void;
  onSubmit: (report: Report) => void;
}

export default function ReportForm({ onClose, onSubmit }: ReportFormProps) {
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [impactTags, setImpactTags] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string>('');
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAfectacionesOpen, setIsAfectacionesOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  const handleGetLocation = () => {
    setIsLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude.toString());
          setLng(position.coords.longitude.toString());
          setIsLocating(false);
          setIsMapOpen(false); // NO desplegar el mapa de selección manual al usar GPS
        },
        (error) => {
          console.error("Error al obtener ubicación", error);
          alert("No se pudo obtener la ubicación automáticamente. Por favor, usá la opción 'Ubicar manualmente'.");
          setIsLocating(false);
        }
      );
    } else {
      alert("Geolocalización no soportada por el navegador. Por favor, usá la opción 'Ubicar manualmente'.");
      setIsLocating(false);
    }
  };

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (!file.type.startsWith('image/')) {
      return {
        valid: false,
        error: "Tipo de archivo no permitido. Solo se aceptan imágenes."
      };
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        valid: false,
        error: "La imagen supera el tamaño máximo permitido (10 MB)."
      };
    }

    return { valid: true };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      const validation = validateFile(file);
      if (!validation.valid) {
        alert(validation.error);
        e.target.value = '';
        return;
      }

      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }

      setImageFile(file);
      setFilePreviewUrl(URL.createObjectURL(file));
      setIsImagePickerOpen(false);
    }
  };

  const handleRemoveFile = () => {
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setImageFile(null);
    setFilePreviewUrl('');

    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!lat || !lng) {
      alert("Seleccioná una ubicación en el mapa antes de enviar el reporte.");
      return;
    }

    if (!imageFile) {
      alert("Debés adjuntar una evidencia fotográfica obligatoria para enviar el reporte.");
      return;
    }

    setIsSubmitting(true);
    let finalImageUrl = null;
    let archivoTipo: 'imagen' | null = null;

    try {
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop() || '';
        archivoTipo = 'imagen';

        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `imagenes/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('reportes')
          .upload(filePath, imageFile, {
            contentType: imageFile.type,
            upsert: false
          });

        if (uploadError) {
          throw new Error(`Error al subir la imagen: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('reportes')
          .getPublicUrl(filePath);

        finalImageUrl = publicUrl;
      }

      const { data, error: insertError } = await supabase
        .from("reportes")
        .insert({
          descripcion: descriptionRef.current?.value || null,
          latitud: parseFloat(lat),
          longitud: parseFloat(lng),
          imagen_url: finalImageUrl ?? null,
          archivo_tipo: archivoTipo ?? null,
          estado: "pendiente",
          afectaciones: impactTags,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Error al guardar el reporte: ${insertError.message}`);
      }

      alert("¡Reporte enviado con éxito!");

      const mappedNewReport: Report = {
        id: data.id,
        lat: Number(data.latitud),
        lng: Number(data.longitud),
        description: data.descripcion || 'Sin descripción',
        impactTags: data.afectaciones || [],
        dateTime: data.creado_en || new Date().toISOString(),
        imageUrl: data.imagen_url || undefined,
        status: (data.estado || 'pendiente') as Report['status'],
        archivoTipo: data.archivo_tipo || null,
      };

      setLat('');
      setLng('');
      if (descriptionRef.current) descriptionRef.current.value = '';
      setImpactTags([]);
      setImageFile(null);
      setFilePreviewUrl('');

      onSubmit(mappedNewReport);
    } catch (error: unknown) {
      console.error('Error al enviar el reporte:', error);
      const msg = error instanceof Error ? error.message : 'Ocurrió un error al enviar el reporte. Por favor, intentá nuevamente.';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3500] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6 transition-all">
      <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[86vh] md:max-h-[90vh] my-auto">
        
        <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white px-4 py-3 md:px-6 md:py-4 flex justify-between items-center relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <h2 className="text-base md:text-xl font-bold relative z-10 pr-2">Nuevo Reporte Ciudadano</h2>
          <button 
            onClick={onClose} 
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 md:p-2 rounded-full backdrop-blur-sm transition-colors relative z-10 shrink-0"
            aria-label="Cerrar formulario"
          >
            <X size={16} className="md:w-5 md:h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="form-scrollable p-3 sm:p-4 md:p-6 space-y-3 md:space-y-5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 flex-1">
          <div className="space-y-2 md:space-y-3 border border-slate-100 rounded-xl md:rounded-2xl p-3 md:p-4 bg-slate-50/30">
            <div className="flex justify-between items-center select-none">
              <label className="text-xs md:text-sm font-bold text-slate-700">Ubicación <span className="text-red-500">*</span></label>
              {lat && lng && !isMapOpen && (
                <p className="text-[10px] md:text-xs text-green-600 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  Ubicación seleccionada
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button 
                type="button" 
                onClick={handleGetLocation}
                disabled={isLocating}
                className="flex justify-center items-center gap-1.5 py-2 md:py-3 px-2 text-xs md:text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg md:rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-blue-100 cursor-pointer text-center"
              >
                <MapPin size={15} className="shrink-0" /> 
                <span className="truncate">{isLocating ? 'Obteniendo...' : 'Mi ubicación'}</span>
              </button>

              <button 
                type="button"
                onClick={() => setIsMapOpen(!isMapOpen)}
                className={`flex justify-center items-center gap-1.5 py-2 md:py-3 px-2 text-xs md:text-sm font-bold border rounded-lg md:rounded-xl transition-all cursor-pointer text-center ${
                  isMapOpen 
                    ? 'bg-slate-100 border-slate-300 text-slate-700' 
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <span className="truncate">Ubicar manualmente</span>
                {isMapOpen ? <ChevronUp size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
              </button>
            </div>

            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isMapOpen ? 'max-h-[350px] opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
              <p className="text-[10.5px] md:text-xs text-slate-500 mb-2 pt-0.5">Marcá la ubicación exacta del evento tocando o haciendo clic en el mapa.</p>
              <div className="w-full h-40 md:h-56 rounded-xl overflow-hidden border border-slate-200 relative z-0">
                {useMemo(() => (
                  <MapContainer 
                    center={[-25.2855, -57.6150]} 
                    zoom={13} 
                    zoomControl={false}
                    className="w-full h-full"
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <LocationSelector setLocation={(l, lg) => { setLat(l); setLng(lg); }} />
                    <MapUpdater lat={lat} lng={lng} />
                    {lat && lng && (
                      <Marker position={[parseFloat(lat), parseFloat(lng)]} icon={defaultIcon} />
                    )}
                  </MapContainer>
                ), [lat, lng])}
              </div>
            </div>
          </div>

          <div className="space-y-2 md:space-y-3 border border-slate-100 rounded-xl md:rounded-2xl p-3 md:p-4 bg-slate-50/30">
            <div 
              onClick={() => setIsAfectacionesOpen(!isAfectacionesOpen)}
              className="flex items-center justify-between cursor-pointer select-none group"
            >
              <div>
                <label className="text-xs md:text-sm font-bold text-slate-700 cursor-pointer group-hover:text-blue-600 transition-colors">
                  ¿Qué afectaciones se observan?
                </label>
                {!isAfectacionesOpen && impactTags.length > 0 && (
                  <p className="text-[10px] md:text-xs text-blue-600 font-semibold mt-0.5">
                    {impactTags.length} {impactTags.length === 1 ? 'afectación seleccionada' : 'afectaciones seleccionadas'}
                  </p>
                )}
              </div>
              <div className="text-slate-400 bg-slate-100 group-hover:bg-slate-200 p-1 md:p-1.5 rounded-full transition-colors">
                {isAfectacionesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </div>

            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isAfectacionesOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <p className="text-[10.5px] md:text-xs text-slate-500 mb-1.5 pt-0.5">Opcional. Podés seleccionar una o varias opciones.</p>
              <div className="flex flex-wrap gap-1.5 md:gap-2">
                {AVAILABLE_TAGS.map((tag) => {
                  const isSelected = impactTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setImpactTags(prev => prev.filter(t => t !== tag));
                        } else {
                          setImpactTags(prev => [...prev, tag]);
                        }
                      }}
                      className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-xs md:text-sm font-medium transition-colors border cursor-pointer ${
                        isSelected 
                          ? 'bg-blue-100 border-blue-500 text-blue-800' 
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {(impactTags.includes('Persona atrapada') || impactTags.includes('Fallecimiento reportado')) && (
              <div className="mt-2 md:mt-3 p-2.5 md:p-3 bg-red-50 border border-red-200 rounded-lg md:rounded-xl flex items-start gap-2 md:gap-3">
                <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={15} />
                <p className="text-xs md:text-sm text-red-700 font-medium">
                  Si hay personas en riesgo o una emergencia activa, contactá inmediatamente a los servicios de emergencia correspondientes.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5 md:space-y-3">
            <label className="text-xs md:text-sm font-bold text-slate-700">Descripción del evento</label>
            <textarea 
              ref={descriptionRef}
              placeholder="Describa la situación de la inundación (ej: agua sobre la vereda, arroyo desbordado)..."
              className="w-full text-xs md:text-sm p-3 md:p-4 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl h-20 md:h-28 resize-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all font-medium"
            />
          </div>

          {/* Evidencia fotográfica */}
          <div className="space-y-1.5 md:space-y-3">
            <label className="text-xs md:text-sm font-bold text-slate-700">
              Evidencia fotográfica <span className="text-red-500">*</span>
            </label>
            
            {!filePreviewUrl ? (
              <div 
                onClick={() => setIsImagePickerOpen(true)}
                className="relative border-2 border-dashed border-slate-300 rounded-xl md:rounded-2xl overflow-hidden bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer group min-h-[85px] md:min-h-[150px] flex flex-col items-center justify-center py-2.5 md:py-3"
              >
                <div className="px-3 py-0.5 flex flex-col items-center justify-center text-slate-500">
                  <div className="bg-white p-2 md:p-3 rounded-full shadow-sm mb-1 md:mb-3 group-hover:scale-110 transition-transform">
                    <Camera size={18} className="text-slate-400 group-hover:text-blue-500 md:w-6 md:h-6" />
                  </div>
                  <span className="text-xs md:text-sm text-center font-medium">Haga clic para adjuntar evidencia gráfica o tomar foto</span>
                </div>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl md:rounded-2xl overflow-hidden bg-slate-50 p-3 md:p-4 space-y-3 md:space-y-4">
                <div className="w-full h-36 md:h-48 relative rounded-lg md:rounded-xl overflow-hidden bg-slate-900 border border-slate-200 flex items-center justify-center">
                  <img 
                    src={filePreviewUrl} 
                    alt="Vista previa de la imagen" 
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                
                <div className="bg-white p-3 md:p-4 rounded-lg md:rounded-xl border border-slate-100 space-y-1.5 md:space-y-2 text-xs text-slate-600 shadow-sm">
                  <div className="flex justify-between items-center gap-4">
                    <span className="font-bold text-slate-500 uppercase tracking-wide text-[10px]">Nombre</span>
                    <span className="text-slate-800 font-semibold truncate max-w-[220px]" title={imageFile?.name}>{imageFile?.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-500 uppercase tracking-wide text-[10px]">Tamaño</span>
                    <span className="text-slate-800 font-semibold">{formatBytes(imageFile?.size ?? 0)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-500 uppercase tracking-wide text-[10px]">Tipo</span>
                    <span className="text-slate-800 font-semibold capitalize flex items-center gap-1">
                      <Camera size={14} className="text-blue-500" /> Imagen ({imageFile?.type.split('/').pop()})
                    </span>
                  </div>
                </div>

                <div className="flex gap-2.5 justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-xs font-bold cursor-pointer transition-colors border border-red-100"
                  >
                    <Trash2 size={13} /> Eliminar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsImagePickerOpen(true)}
                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-xs font-bold cursor-pointer transition-colors border border-slate-200"
                  >
                    Reemplazar
                  </button>
                </div>
              </div>
            )}
            {imageFile ? (
              <p className="text-[11px] md:text-xs text-green-600 mt-1 font-bold flex items-center gap-1.5 select-none">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> 
                Imagen adjuntada correctamente.
              </p>
            ) : (
              <p className="text-[11px] md:text-xs text-amber-600 mt-0.5 font-semibold flex items-center gap-1">
                <AlertTriangle size={12} className="shrink-0 text-amber-500" />
                Evidencia fotográfica requerida para poder enviar el reporte.
              </p>
            )}
          </div>

          <div className="pt-2 md:pt-6 pb-1">
            <button 
              type="submit"
              disabled={isSubmitting || !imageFile}
              className={`w-full font-bold py-3 md:py-4 px-5 md:px-6 text-sm md:text-base rounded-xl transition-all transform flex items-center justify-center gap-2 ${
                !imageFile
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-blue-700 hover:bg-blue-800 text-white shadow-[0_8px_20px_rgb(37,99,235,0.3)] hover:shadow-[0_8px_25px_rgb(37,99,235,0.4)] hover:-translate-y-0.5 active:translate-y-0 cursor-pointer'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Enviando reporte...
                </>
              ) : 'Confirmar y Enviar Reporte'}
            </button>
          </div>
        </form>

        {/* Inputs de archivos ocultos */}
        <input 
          ref={cameraInputRef}
          type="file" 
          accept="image/*"
          capture="environment"
          className="hidden" 
          onChange={handleFileChange}
        />
        <input 
          ref={galleryInputRef}
          type="file" 
          accept="image/*"
          className="hidden" 
          onChange={handleFileChange}
        />

        {/* Modal / Bottom Sheet para seleccionar origen de fotografía */}
        {isImagePickerOpen && (
          <div 
            className="fixed inset-0 z-[3500] bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-4"
            onClick={() => setIsImagePickerOpen(false)}
          >
            <div 
              className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl animate-in slide-in-from-bottom-5 sm:zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-slate-800">Seleccionar fotografía</h3>
                <button 
                  type="button"
                  onClick={() => setIsImagePickerOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-4 border border-slate-200 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/50 rounded-xl transition-all group cursor-pointer text-center"
                >
                  <div className="p-3 rounded-full bg-blue-100 text-blue-600 group-hover:scale-110 transition-transform mb-2">
                    <Camera size={22} />
                  </div>
                  <span className="text-xs font-bold text-slate-800">Tomar foto</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Abrir cámara</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-4 border border-slate-200 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/50 rounded-xl transition-all group cursor-pointer text-center"
                >
                  <div className="p-3 rounded-full bg-slate-100 text-slate-600 group-hover:scale-110 transition-transform mb-2">
                    <ImageIcon size={22} />
                  </div>
                  <span className="text-xs font-bold text-slate-800">Elegir de galería</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Archivos del celular</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
