import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const authToken = request.cookies.get('auth_token')?.value;

  // Si intentamos acceder a /mapa sin estar logueado, redirigimos al login
  if (request.nextUrl.pathname.startsWith('/mapa')) {
    if (authToken !== 'true') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Si estamos en login (/) y ya estamos logueados, redirigimos a /mapa
  if (request.nextUrl.pathname === '/') {
    if (authToken === 'true') {
      return NextResponse.redirect(new URL('/mapa', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/mapa/:path*'],
};
