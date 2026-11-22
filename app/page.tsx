import Link from 'next/link';
import { Map, Activity, AlertCircle, Users, Eye, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Inicio - Monitoreo de Inundaciones Asunción',
  description: 'Plataforma para el monitoreo de inundaciones y reportes ciudadanos en el Área Metropolitana de Asunción.',
};

export default function Home() {
  return (
    <main className="flex-1 w-full bg-slate-50 font-sans text-slate-800 py-6 sm:py-8 md:py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto w-full space-y-8 md:space-y-10">
        
        {/* Hero Section */}
        <section className="text-center space-y-4 md:space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold uppercase tracking-wider animate-pulse">
            <AlertCircle size={14} /> Monitoreo en Tiempo Real
          </div>
          
          <h1 className="text-3xl sm:text-4xl md:text-[2.65rem] font-black text-slate-900 tracking-tight leading-[1.18]">
            Plataforma de Monitoreo de Inundaciones
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-800 mt-0.5">
              Área Metropolitana de Asunción
            </span>
          </h1>
          
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed">
            Una herramienta interactiva e integradora para la prevención, visualización y reporte de anegamientos y crecidas en zonas críticas.
          </p>

          {/* Call to Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 pt-2 sm:pt-3">
            <Link
              href="/mapa"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white font-bold py-3 px-7 rounded-2xl shadow-xl shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all duration-200 border border-blue-500/20 group"
            >
              <Map size={19} />
              <span>Ver Mapa Interactivo</span>
              <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            
            <Link
              href="/estaciones"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-800 font-bold py-3 px-7 rounded-2xl shadow-md border border-slate-200 hover:scale-105 active:scale-95 transition-all duration-200 group"
            >
              <Activity size={19} className="text-blue-600" />
              <span>Ver Estaciones</span>
              <ArrowRight size={17} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </section>

        {/* Feature/Information Grid */}
        <section className="grid sm:grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6 pt-1 sm:pt-2">
          
          {/* Card 1: Objetivo Principal */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-300">
            <div className="space-y-3 sm:space-y-3.5">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <AlertCircle size={22} />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">Objetivo Principal</h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Facilitar información geográfica y alertas tempranas para mitigar los riesgos de inundación, protegiendo vidas y bienes de la ciudadanía.
              </p>
            </div>
          </div>

          {/* Card 2: Monitoreo de Inundaciones */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-300">
            <div className="space-y-3 sm:space-y-3.5">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Eye size={22} />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">Monitoreo Hidrológico</h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Vigilancia sistemática de caudales y precipitaciones para anticipar crecidas de arroyos y acumulaciones pluviales críticas en zonas de riesgo.
              </p>
            </div>
          </div>

          {/* Card 3: Aporte Ciudadano */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-300 sm:col-span-2 md:col-span-1">
            <div className="space-y-3 sm:space-y-3.5">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users size={22} />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">Reportes Ciudadanos</h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                La participación activa de los vecinos nos permite mapear en tiempo real calles anegadas y daños, adjuntando evidencias fotográficas geolocalizadas.
              </p>
            </div>
          </div>

        </section>

        {/* Info Banner */}
        <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 relative overflow-hidden shadow-xl mb-4 sm:mb-6">
          <div className="absolute right-0 bottom-0 translate-y-1/4 translate-x-1/4 w-72 h-72 rounded-full bg-blue-600/10 blur-3xl" />
          <div className="relative z-10 max-w-2xl space-y-2.5">
            <h3 className="text-base sm:text-lg font-bold text-blue-400">¿Cómo funciona?</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Puedes navegar por el <strong>Mapa</strong> para ver y enviar reportes ciudadanos con evidencias multimedia geolocalizadas. O visitar la sección de <strong>Estaciones</strong> para analizar las mediciones hidrometeorológicas del área metropolitana.
            </p>
          </div>
        </section>
        
      </div>
    </main>
  );
}
