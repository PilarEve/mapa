"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, Map, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simulando delay de red
    setTimeout(() => {
      if (username === 'admin' && password === '12345') {
        // Establecemos cookie para el middleware
        document.cookie = "auth_token=true; path=/; max-age=86400"; // expira en 1 día
        router.push('/mapa');
      } else {
        setError('Usuario o contraseña incorrectos');
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden font-sans">
      {/* Background Decorativo */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-400/20 blur-[100px]"></div>
        <div className="absolute bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-cyan-400/20 blur-[100px]"></div>
        <div className="absolute top-[30%] right-[20%] w-[20%] h-[20%] rounded-full bg-indigo-500/10 blur-[80px]"></div>
      </div>

      <div className="w-full max-w-md p-6 z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/50 overflow-hidden">
          
          <div className="p-8 pb-6 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-blue-500/30 mb-6 transform rotate-3">
              <Map size={32} className="text-white -rotate-3" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Acceso al Sistema</h1>
            <p className="text-sm text-slate-500">
              Plataforma de Monitoreo de Inundaciones<br/>
              Área Metropolitana de Asunción
            </p>
          </div>

          <form onSubmit={handleLogin} className="p-8 pt-2 space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm font-medium p-3 rounded-xl border border-red-100 text-center animate-in shake">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all font-medium text-slate-700"
                  required
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all font-medium text-slate-700"
                  required
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold py-3.5 px-6 rounded-xl shadow-[0_8px_20px_rgb(37,99,235,0.25)] hover:shadow-[0_8px_25px_rgb(37,99,235,0.35)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Ingresar a la Plataforma</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
            
            <p className="text-center text-xs text-slate-400 mt-6 font-medium">
              Solo personal autorizado. (Pruebas: admin / 12345)
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
