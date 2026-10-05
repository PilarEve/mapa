import { Activity, Calendar, Filter, Database, HelpCircle } from 'lucide-react';

export const metadata = {
  title: 'Estaciones - Monitoreo de Inundaciones Asunción',
  description: 'Información y mediciones en tiempo real de las estaciones hidrometeorológicas del Área Metropolitana de Asunción.',
};

export default function EstacionesPage() {
  // Empty state structure prepared for real data binding
  return (
    <div className="flex-1 w-full bg-slate-50 font-sans text-slate-800 py-4 sm:py-8 px-3 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 border-b border-slate-200/60 pb-4 sm:pb-6">
          <div>
            <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Estaciones Hidrometeorológicas
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1 font-medium">
              Red de sensores de nivel de agua y precipitación en tiempo real.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg sm:rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-[11px] sm:text-xs font-semibold self-start sm:self-auto">
            <Database size={13} className="shrink-0" /> Próxima Integración
          </div>
        </div>

        {/* Filters bar */}
        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col md:flex-row gap-3 sm:gap-4 items-stretch md:items-center justify-between opacity-60 pointer-events-none">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-4 w-full md:w-auto">
            {/* Filter by Station */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter size={15} className="text-slate-400 shrink-0 hidden xs:block" />
              <label htmlFor="station-filter" className="sr-only">Filtrar por estación</label>
              <select 
                id="station-filter"
                className="bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 outline-none w-full sm:w-64"
                disabled
                defaultValue="todos"
              >
                <option value="todos">Todas las estaciones</option>
                <option value="est-1">Estación Club Mbigua</option>
                <option value="est-2">Estación Puente Remanso</option>
                <option value="est-3">Estación Arroyo Mburicaó</option>
              </select>
            </div>

            {/* Filter by Date Range */}
            <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto overflow-hidden">
              <Calendar size={15} className="text-slate-400 shrink-0 hidden xs:block" />
              <div className="grid grid-cols-2 gap-1.5 items-center w-full">
                <input 
                  type="date" 
                  aria-label="Fecha de inicio"
                  className="bg-slate-50 border border-slate-200 text-[11px] sm:text-sm font-semibold rounded-lg sm:rounded-xl px-2 py-1.5 sm:px-3 sm:py-2 outline-none w-full min-w-0"
                  disabled
                />
                <input 
                  type="date" 
                  aria-label="Fecha de fin"
                  className="bg-slate-50 border border-slate-200 text-[11px] sm:text-sm font-semibold rounded-lg sm:rounded-xl px-2 py-1.5 sm:px-3 sm:py-2 outline-none w-full min-w-0"
                  disabled
                />
              </div>
            </div>
          </div>
          
          <button 
            type="button"
            className="bg-blue-600 text-white font-bold text-xs sm:text-sm px-4 py-1.5 sm:px-5 sm:py-2 rounded-lg sm:rounded-xl w-full md:w-auto"
            disabled
          >
            Filtrar
          </button>
        </div>

        {/* Dashboard / Layout Structure */}
        <div className="relative min-h-[340px] sm:min-h-[400px] w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden flex flex-col justify-center items-center p-4 sm:p-8">
          
          {/* Background Skeleton */}
          <div className="absolute inset-0 p-4 sm:p-8 opacity-[0.03] select-none pointer-events-none flex flex-col gap-4 sm:gap-6 w-full">
            <div className="h-6 sm:h-8 bg-slate-900 rounded-lg w-1/4" />
            <div className="border border-slate-900 rounded-xl flex-1 flex flex-col divide-y divide-slate-900">
              <div className="h-10 sm:h-12 bg-slate-900/40" />
              <div className="h-12 sm:h-16" />
              <div className="h-12 sm:h-16" />
            </div>
          </div>

          {/* Premium Empty State component */}
          <div className="relative z-10 max-w-md text-center space-y-4 sm:space-y-5">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
              <Activity size={24} className="sm:w-8 sm:h-8 animate-pulse" />
            </div>
            
            <div className="space-y-1.5 sm:space-y-2">
              <h3 className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-snug">
                Los datos de las estaciones estarán disponibles próximamente.
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed px-2">
                Estamos trabajando en la integración de los sensores hidrometeorológicos públicos e institucionales para proveer alertas y gráficos históricos automáticos.
              </p>
            </div>

            {/* Info Points */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-left grid grid-cols-2 gap-2.5 sm:gap-3 max-w-sm mx-auto">
              <div className="space-y-0.5">
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 tracking-wider uppercase">Nivel de Agua</span>
                <p className="text-[11px] sm:text-xs font-semibold text-slate-700">Lecturas en metros (m)</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 tracking-wider uppercase">Precipitación</span>
                <p className="text-[11px] sm:text-xs font-semibold text-slate-700">Acumulado en (mm)</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 tracking-wider uppercase">Actualización</span>
                <p className="text-[11px] sm:text-xs font-semibold text-slate-700">Cada 15 minutos</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 tracking-wider uppercase">Historial</span>
                <p className="text-[11px] sm:text-xs font-semibold text-slate-700">Gráficos de tendencia</p>
              </div>
            </div>
            
            <div className="text-xs font-bold text-blue-600 inline-flex items-center gap-1">
              <span>Soporte e Integración</span>
              <HelpCircle size={14} />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
