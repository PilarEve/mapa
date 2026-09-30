"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { Report } from '../types/report';
import { MapPin, Camera, X, Loader2, AlertTriangle, ChevronDown, ChevronUp, Trash2, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
  'Sin daños visibles'
];

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
  const replaceInputRef = useRef<HTMLInputElement>(null);
  
  const [impactTags, setImpactTags] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string>('');
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<'idle' | 'uploading' | 'saving' | 'success'>('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const [isAfectacionesOpen, setIsAfectacionesOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  const handleGetLocation = () => {
    setIsLocating(true);
    setFormError(null);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude.toString());
          setLng(position.coords.longitude.toString());
          setIsLocating(false);
          setIsMapOpen(true);
        },
        (error) => {
          console.error("Error al obtener ubicación", error);
          setFormError("No se pudo obtener la ubicación automáticamente. Por favor, usá el mapa para ubicar manualmente.");
          setIsLocating(false);
          setIsMapOpen(true);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setFormError("Geolocalización no soportada por este navegador. Por favor, usá el mapa.");
      setIsLocating(false);
      setIsMapOpen(true);
    }
  };

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Permitir fotos tomadas por cámaras de celulares (image/*, HEIC, JPG, WEBP, PNG, etc.)
    const isImage = file.type ? file.type.startsWith('image/') : /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.name);
    
    if (!isImage) {
      return {
        valid: false,
        error: "Archivo no válido. Por favor, seleccioná una imagen (JPG, PNG, WebP o formato de foto del celular)."
      };
    }

    const maxSize = 10 * 1024 * 1024; // 10MB máximo para fotos móviles de alta resolución
    if (file.size > maxSize) {
      return {
        valid: false,
        error: "La imagen supera el tamaño máximo permitido (10 MB)."
      };
    }

    return { valid: true };
  };

  const processSelectedFile = (file: File) => {
    setFormError(null);
    const validation = validateFile(file);
    if (!validation.valid) {
      setFormError(validation.error || "Error en el archivo");
      return;
    }

    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }

    setImageFile(file);
    setFilePreviewUrl(URL.createObjectURL(file));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
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
    if (replaceInputRef.current) replaceInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevenir doble submit

    if (!lat || !lng) {
      setFormError("Debés marcar una ubicación en el mapa antes de enviar el reporte.");
      setIsMapOpen(true);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setSubmitStage('uploading');

    let finalImageUrl: string | null = null;
    let archivoTipo: 'imagen' | null = null;

    try {
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop() || 'jpg';
        archivoTipo = 'imagen';

        const fileName = `${Date.now()}_${crypto.randomUUID()}.${fileExt}`;
        const filePath = `imagenes/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('reportes')
          .upload(filePath, imageFile, {
            contentType: imageFile.type || 'image/jpeg',
            upsert: false
          });

        if (uploadError) {
          throw new Error(`Fallo al subir la imagen: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('reportes')
          .getPublicUrl(filePath);

        finalImageUrl = publicUrl;
      }

      setSubmitStage('saving');

      const { data, error: insertError } = await supabase
        .from("reportes")
        .insert({
          descripcion: descriptionRef.current?.value || null,
          latitud: parseFloat(lat),
          longitud: parseFloat(lng),
          imagen_url: finalImageUrl,
          archivo_tipo: archivoTipo,
          estado: "pendiente",
          afectaciones: impactTags,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Fallo al guardar el reporte: ${insertError.message}`);
      }

      setSubmitStage('success');

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

      setTimeout(() => {
        onSubmit(mappedNewReport);
      }, 500);

    } catch (error: unknown) {
      console.error('Error al enviar el reporte:', error);
      const msg = error instanceof Error ? error.message : 'Ocurrió un error al enviar el reporte. Por favor, intentá nuevamente.';
      setFormError(msg);
      setSubmitStage('idle');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 transition-all">
      <div className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300 flex flex-col max-h-[90dvh] md:max-h-[85vh]">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-5 flex justify-between items-center relative overflow-hidden shrink-0">
          <div>
            <h2 className="text-lg md:text-xl font-bold relative z-10">Nuevo Reporte Ciudadano</h2>
            <p className="text-xs text-blue-100/90 relative z-10 mt-0.5">Reportá inundaciones o anegamientos en tiempo real</p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            disabled={isSubmitting}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full backdrop-blur-sm transition-colors relative z-10 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Error Banner */}
        {formError && (
          <div className="bg-red-50 border-b border-red-200 px-5 py-3 flex items-start gap-2.5 shrink-0 text-red-700 text-xs font-semibold animate-in fade-in duration-200">
            <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16} />
            <div className="flex-1">{formError}</div>
            <button type="button" onClick={() => setFormError(null)} className="text-red-400 hover:text-red-700">
              <X size={14} />
            </button>
          </div>
        )}
        
        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="form-scrollable p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-200">
          
          {/* Ubicación */}
          <div className="space-y-2.5 border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
            <div className="flex justify-between items-center select-none">
              <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin size={16} className="text-blue-600" />
                Ubicación del evento <span className="text-red-500">*</span>
              </label>
              {lat && lng && (
                <span className="text-xs text-green-700 font-bold bg-green-50 border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  Ubicado
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button 
                type="button" 
                onClick={handleGetLocation}
                disabled={isLocating || isSubmitting}
                className="flex justify-center items-center gap-2 py-2.5 px-3 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 rounded-xl transition-colors disabled:opacity-50 border border-blue-100 cursor-pointer"
              >
                {isLocating ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                <span>{isLocating ? 'Obteniendo GPS...' : 'Mi ubicación actual'}</span>
              </button>

              <button 
                type="button"
                onClick={() => setIsMapOpen(!isMapOpen)}
                disabled={isSubmitting}
                className={`flex justify-center items-center gap-2 py-2.5 px-3 text-xs font-bold border rounded-xl transition-all cursor-pointer ${
                  isMapOpen 
                    ? 'bg-slate-200 border-slate-300 text-slate-800' 
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span>Ubicar en el mapa</span>
                {isMapOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>

            {/* Sub-mapa para seleccionar ubicación exacta */}
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isMapOpen ? 'max-h-[300px] opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
              <p className="text-[11px] text-slate-500 mb-2">Tocá o hacé clic en el mapa para marcar el lugar exacto:</p>
              <div className="w-full h-48 rounded-xl overflow-hidden border border-slate-200 relative z-0">
                {useMemo(() => (
                  <MapContainer 
                    center={[-25.2855, -57.6150]} 
                    zoom={13} 
                    zoomControl={false}
                    className="w-full h-full"
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; OpenStreetMap'
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

          {/* Evidencia fotográfica desde móvil/escritorio */}
          <div className="space-y-2.5 border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
            <label className="text-sm font-bold text-slate-800 flex items-center justify-between">
              <span>Evidencia fotográfica</span>
              <span className="text-[11px] font-normal text-slate-500">Opcional</span>
            </label>

            {!filePreviewUrl ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {/* Botón 1: Cámara celular */}
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isSubmitting}
                    className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-blue-200 hover:border-blue-400 bg-white hover:bg-blue-50/50 rounded-xl transition-all group cursor-pointer text-center"
                  >
                    <div className="p-2 rounded-full bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform mb-1.5">
                      <Camera size={20} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Tomar foto</span>
                    <span className="text-[10px] text-slate-400">Usar la cámara</span>
                  </button>

                  {/* Botón 2: Galería */}
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={isSubmitting}
                    className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-200 hover:border-blue-400 bg-white hover:bg-blue-50/50 rounded-xl transition-all group cursor-pointer text-center"
                  >
                    <div className="p-2 rounded-full bg-slate-100 text-slate-600 group-hover:scale-110 transition-transform mb-1.5">
                      <ImageIcon size={20} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Galería</span>
                    <span className="text-[10px] text-slate-400">Elegir archivo</span>
                  </button>
                </div>

                {/* Inputs ocultos */}
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
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white p-3 space-y-3 shadow-sm">
                <div className="w-full h-44 relative rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center">
                  <img 
                    src={filePreviewUrl} 
                    alt="Vista previa de foto" 
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                
                <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div className="truncate max-w-[180px] font-semibold text-slate-800">
                    {imageFile?.name || 'Fotografía seleccionada'}
                  </div>
                  <div className="text-[11px] font-bold text-slate-500">
                    {formatBytes(imageFile?.size ?? 0)}
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-red-100 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 size={14} /> Eliminar
                  </button>
                  <button
                    type="button"
                    onClick={() => replaceInputRef.current?.click()}
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-slate-200 cursor-pointer disabled:opacity-50"
                  >
                    Cambiar
                  </button>
                  <input 
                    ref={replaceInputRef}
                    type="file" 
                    accept="image/*"
                    className="hidden" 
                    onChange={handleFileChange}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Afectaciones (Acordeón) */}
          <div className="space-y-2 border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
            <div 
              onClick={() => setIsAfectacionesOpen(!isAfectacionesOpen)}
              className="flex items-center justify-between cursor-pointer select-none group"
            >
              <div>
                <label className="text-sm font-bold text-slate-800 cursor-pointer group-hover:text-blue-600 transition-colors">
                  ¿Qué afectaciones se observan?
                </label>
                {impactTags.length > 0 && !isAfectacionesOpen && (
                  <p className="text-xs text-blue-600 font-semibold mt-0.5">
                    {impactTags.length} seleccionada(s)
                  </p>
                )}
              </div>
              <div className="text-slate-400 bg-slate-100 group-hover:bg-slate-200 p-1.5 rounded-full transition-colors">
                {isAfectacionesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isAfectacionesOpen ? 'max-h-[300px] opacity-100 pt-2' : 'max-h-0 opacity-0'}`}>
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto scrollbar-thin">
                {AVAILABLE_TAGS.map((tag) => {
                  const isSelected = impactTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        if (isSelected) {
                          setImpactTags(prev => prev.filter(t => t !== tag));
                        } else {
                          setImpactTags(prev => [...prev, tag]);
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-full text-xs font-semibold transition-colors border cursor-pointer ${
                        isSelected 
                          ? 'bg-blue-600 border-blue-600 text-white' 
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Descripción del evento</label>
            <textarea 
              ref={descriptionRef}
              disabled={isSubmitting}
              placeholder="Escribí aquí detalles sobre el nivel del agua, tránsito o daños..."
              className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl h-24 resize-none focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all disabled:opacity-50"
            />
          </div>

          {/* Botón de envío con estado claro */}
          <div className="pt-2 pb-1 shrink-0">
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>
                    {submitStage === 'uploading' && 'Subiendo fotografía...'}
                    {submitStage === 'saving' && 'Guardando reporte...'}
                    {submitStage === 'success' && '¡Reporte creado!'}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>Confirmar y Enviar Reporte</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

