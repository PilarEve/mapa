"use client";

import { useState } from 'react';
import { Severity, Report } from '../types/report';
import { MapPin, Camera, X } from 'lucide-react';

interface ReportFormProps {
  onClose: () => void;
  onSubmit: (report: Omit<Report, 'id' | 'status'>) => void;
}

export default function ReportForm({ onClose, onSubmit }: ReportFormProps) {
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [severity, setSeverity] = useState<Severity>('medio');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isLocating, setIsLocating] = useState(false);

  const handleGetLocation = () => {
    setIsLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude.toString());
          setLng(position.coords.longitude.toString());
          setIsLocating(false);
        },
        (error) => {
          console.error("Error al obtener ubicación", error);
          alert("No se pudo obtener la ubicación. Por favor, ingrese las coordenadas manualmente.");
          setIsLocating(false);
        }
      );
    } else {
      alert("Geolocalización no soportada por el navegador.");
      setIsLocating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lat || !lng || !description) {
      alert("Por favor complete los campos obligatorios.");
      return;
    }

    onSubmit({
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      description,
      severity,
      dateTime: new Date().toISOString(),
      imageUrl: imageUrl || "https://placehold.co/400x300/EEE/31343C?font=montserrat&text=Nueva+Foto"
    });
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4 transition-all">
      <div className="bg-white md:rounded-3xl rounded-t-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300">
        
        <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-6 flex justify-between items-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <h2 className="text-xl font-bold relative z-10">Nuevo Reporte Ciudadano</h2>
          <button 
            onClick={onClose} 
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full backdrop-blur-sm transition-colors relative z-10"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-600">Ubicación <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              <input 
                type="number" 
                step="any"
                placeholder="Latitud" 
                value={lat} 
                onChange={(e) => setLat(e.target.value)}
                className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all font-medium"
                required
              />
              <input 
                type="number" 
                step="any"
                placeholder="Longitud" 
                value={lng} 
                onChange={(e) => setLng(e.target.value)}
                className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all font-medium"
                required
              />
            </div>
            <button 
              type="button" 
              onClick={handleGetLocation}
              disabled={isLocating}
              className="w-full flex justify-center items-center gap-2 py-3 text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-blue-100"
            >
              <MapPin size={18} /> 
              {isLocating ? 'Obteniendo coordenadas...' : 'Usar mi ubicación actual'}
            </button>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-600">Descripción del evento <span className="text-red-500">*</span></label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describa la situación de la inundación (ej: agua sobre la vereda, arroyo desbordado)..."
              className="w-full text-sm p-4 bg-slate-50 border border-slate-200 rounded-xl h-28 resize-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all font-medium"
              required
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-600">Nivel de Severidad <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-4 gap-3">
              {(['bajo', 'medio', 'alto', 'critico'] as Severity[]).map((sev) => (
                <label 
                  key={sev} 
                  className={`flex flex-col items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition-all ${
                    severity === sev 
                    ? (sev === 'bajo' ? 'border-green-500 bg-green-50 shadow-sm' : 
                       sev === 'medio' ? 'border-yellow-400 bg-yellow-50 shadow-sm' : 
                       sev === 'alto' ? 'border-orange-500 bg-orange-50 shadow-sm' : 
                       'border-red-500 bg-red-50 shadow-sm')
                    : 'border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200'
                  }`}
                  onClick={() => setSeverity(sev)}
                >
                  <span className={`w-4 h-4 rounded-full mb-2 shadow-inner ${
                    sev === 'bajo' ? 'bg-green-500' :
                    sev === 'medio' ? 'bg-yellow-400' :
                    sev === 'alto' ? 'bg-orange-500' : 'bg-red-500'
                  }`}></span>
                  <span className={`text-xs font-bold capitalize ${severity === sev ? 'text-slate-800' : 'text-slate-500'}`}>
                    {sev}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-600">Fotografía</label>
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer text-slate-500 group">
              <div className="bg-white p-3 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                <Camera size={24} className="text-slate-400 group-hover:text-blue-500" />
              </div>
              <span className="text-sm text-center font-medium">Haga clic para adjuntar evidencia gráfica</span>
              <input 
                type="file" 
                className="hidden" 
                accept="image/*"
                onChange={(e) => {
                  if(e.target.files && e.target.files[0]) {
                     setImageUrl(URL.createObjectURL(e.target.files[0]));
                  }
                }}
              />
            </div>
            {imageUrl && <p className="text-xs text-green-600 mt-2 font-bold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Imagen adjuntada correctamente.</p>}
          </div>

          <div className="pt-6 pb-2">
            <button 
              type="submit"
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-4 px-6 rounded-xl shadow-[0_8px_20px_rgb(37,99,235,0.3)] hover:shadow-[0_8px_25px_rgb(37,99,235,0.4)] transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Confirmar y Enviar Reporte
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
