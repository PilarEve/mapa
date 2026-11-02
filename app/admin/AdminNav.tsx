import Link from 'next/link';

const SECCIONES = [
  { key: 'reportes', label: 'Reportes ciudadanos', href: '/admin' },
  { key: 'noticias', label: 'Noticias históricas', href: '/admin/noticias' },
] as const;

export default function AdminNav({ activa }: { activa: (typeof SECCIONES)[number]['key'] }) {
  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3" aria-label="Secciones del panel">
      {SECCIONES.map((s) => (
        <Link
          key={s.key}
          href={s.href}
          aria-current={activa === s.key ? 'page' : undefined}
          className={`px-3 py-1.5 text-sm font-semibold border-b-2 transition-colors ${
            activa === s.key
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
