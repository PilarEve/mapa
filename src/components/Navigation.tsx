"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Home, Map, Activity } from 'lucide-react';

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);



  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Handle click outside menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const navLinks = [
    { href: '/', label: 'Inicio', icon: Home },
    { href: '/mapa', label: 'Mapa', icon: Map },
    { href: '/estaciones', label: 'Estaciones', icon: Activity },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  return (
    <header className="h-12 md:h-16 border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-[4000] w-full font-sans transition-all duration-200">
      <div className="max-w-7xl mx-auto h-full px-3 sm:px-6 lg:px-8 flex items-center justify-between">
        
        {/* Brand / Logo */}
        <Link 
          href="/" 
          onClick={() => setIsOpen(false)}
          className="flex items-center gap-2 md:gap-2.5 group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg p-0.5"
          aria-label="Monitoreo Inundaciones - Ir a la página de inicio"
        >
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-base md:text-lg shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
            M
          </div>
          <span className="font-bold text-base md:text-lg text-slate-800 tracking-tight group-hover:text-blue-600 transition-colors">
            Monitoreo de Inundaciones
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Navegación principal">
          {navLinks.map((link) => {
            const Active = isActive(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2 outline-none focus:ring-2 focus:ring-blue-500 ${
                  Active
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                }`}
                aria-current={Active ? 'page' : undefined}
              >
                <Icon size={16} />
                {link.label}
                {Active && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-blue-600 rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Mobile Hamburger Button */}
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          type="button"
          className="md:hidden inline-flex items-center justify-center p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          aria-controls="mobile-menu"
          aria-expanded={isOpen}
          aria-label={isOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[4005] md:hidden transition-opacity" 
          aria-hidden="true" 
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Navigation Drawer */}
      <div
        id="mobile-menu"
        ref={menuRef}
        className={`fixed inset-0 w-full h-[100dvh] bg-white z-[4010] md:hidden transform transition-transform duration-300 ease-out flex flex-col justify-between ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Menú móvil"
      >
        {/* Mobile Drawer Header */}
        <div className="h-9 px-3 border-b border-slate-100 flex items-center justify-end">
          <button
            onClick={() => setIsOpen(false)}
            type="button"
            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mobile Nav Options */}
        <nav className="p-2.5 pt-2 flex flex-col gap-1.5 flex-1 overflow-y-auto" aria-label="Navegación móvil">
          {navLinks.map((link) => {
            const Active = isActive(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 outline-none focus:ring-2 focus:ring-blue-500 ${
                  Active
                    ? 'text-blue-600 bg-blue-50 font-semibold'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
                aria-current={Active ? 'page' : undefined}
              >
                <Icon size={18} className={Active ? 'text-blue-600' : 'text-slate-400'} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile Drawer Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <p className="text-[11px] text-slate-400 text-center font-normal">
            Monitoreo Asunción © 2026
          </p>
        </div>
      </div>
    </header>
  );
}

