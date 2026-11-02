import { redirect } from 'next/navigation';
import { Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { checkIsAdmin } from '@/lib/admin/auth';
import { login } from '../actions';

export const metadata = {
  title: 'Acceso administrativo - Venus',
  robots: { index: false, follow: false },
};

const MESSAGES: Record<string, string> = {
  credenciales: 'Correo o contraseña incorrectos.',
  no_autorizado: 'Esta cuenta no tiene permisos de administrador.',
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user && (await checkIsAdmin(supabase))) redirect('/admin');

  const { error } = await searchParams;
  const message = error ? MESSAGES[error] : undefined;

  return (
    <main className="flex-1 overflow-y-auto flex items-center justify-center p-4">
      <form
        action={login}
        className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center">
            <Lock size={18} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">Acceso administrativo</h1>
            <p className="text-xs text-slate-500">Solo personal autorizado</p>
          </div>
        </div>

        {message && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {message}
          </p>
        )}

        <label className="block text-sm font-medium text-slate-700">
          Correo electrónico
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            maxLength={254}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Contraseña
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            maxLength={200}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Iniciar sesión
        </button>
      </form>
    </main>
  );
}

