"use client";

import {
  Calendar,
  MapPin,
  Camera,
  X,
  Droplet,
  AlertCircle,
  TreeDeciduous,
  Home,
  Car,
  User,
  Skull,
  Road,
  Zap,
  Trash2,
  EyeOff,
  Loader2,
  Search,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createBrowserClient } from '@supabase/ssr';
import * as tus from 'tus-js-client';
import {
  resolveGoogleMapsShortUrl,
  crearReporteManual,
  actualizarReporteManual,
  type OrigenManual,
} from '../../app/admin/carga-manual/actions';

const InteractiveMap = dynamic(() => import('./InteractiveMap'), {
  ssr: false,
  loading: () => (
    <div className="aspect-video w-full bg-slate-100 border border-slate-200 rounded flex items-center justify-center text-sm text-slate-500">
      Cargando mapa...
    </div>
  ),
});

const LOCATION_TABS: { key: 'map' | 'google' | 'coords' | 'address'; label: string }[] = [
  { key: 'map', label: 'Mapa' },
  { key: 'google', label: 'Google Maps' },
  { key: 'coords', label: 'Coordenadas' },
  { key: 'address', label: 'Dirección' },
];

const ORIGIN_OPTIONS: { value: OrigenManual; label: string }[] = [
  { value: 'whatsapp_manual', label: 'WhatsApp manual' },
  { value: 'redes_sociales', label: 'Redes sociales' },
  { value: 'observacion_campo', label: 'Observación de campo' },
  { value: 'otro', label: 'Otro' },
];

export interface ManualReportInitialData {
  id: string;
  latitud: number;
  longitud: number;
  imagen_url: string;
  fecha_evento: string;
  origen_manual: OrigenManual;
  afectaciones: string[];
  descripcion: string | null;
}

function isValidLatLng(lat: number, lng: number): boolean {
  return !Number.isNaN(lat) && !Number.isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function parseCombinedCoords(raw: string): { lat: string; lng: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const dotPair = trimmed.match(/^\(?\s*(-?\d+(?:\.\d+)?)\s*(?:[,;|/]|\s+)\s*(-?\d+(?:\.\d+)?)\s*\)?$/);
  if (dotPair) {
    const la = Number(dotPair[1]);
    const ln = Number(dotPair[2]);
    if (isValidLatLng(la, ln)) return { lat: dotPair[1], lng: dotPair[2] };
  }

  const commaPair = trimmed.match(/^\(?\s*(-?\d+,\d+)\s*(?:[;|/]|\s+)\s*(-?\d+,\d+)\s*\)?$/);
  if (commaPair) {
    const sLat = commaPair[1].replace(',', '.');
    const sLng = commaPair[2].replace(',', '.');
    if (isValidLatLng(Number(sLat), Number(sLng))) return { lat: sLat, lng: sLng };
  }

  if (trimmed.includes('°')) {
    const dms = extractCoordsFromGoogleMapsText(trimmed);
    if (dms) return { lat: dms.lat.toFixed(6), lng: dms.lng.toFixed(6) };
  }

  return null;
}

export function extractCoordsFromGoogleMapsText(rawText: string): { lat: number; lng: number } | null {
  if (!rawText.trim()) return null;
  let decoded = rawText.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Mantener cadena original si contiene % sueltos
  }

  const pinMatches = [...decoded.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)];
  if (pinMatches.length > 0) {
    const last = pinMatches[pinMatches.length - 1];
    const lat = Number(last[1]);
    const lng = Number(last[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const embedMatch = decoded.match(/!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/);
  if (embedMatch) {
    const lng = Number(embedMatch[1]);
    const lat = Number(embedMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const queryNormalized = decoded.replace(/\+/g, ' ');
  const queryMatch = queryNormalized.match(
    /[?&](?:q|query|ll|center|destination|saddr|daddr)=(?:loc:)?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i
  );
  if (queryMatch) {
    const lat = Number(queryMatch[1]);
    const lng = Number(queryMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const pathMatch = queryNormalized.match(
    /\/maps\/(?:search|place|dir)\/\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i
  );
  if (pathMatch) {
    const lat = Number(pathMatch[1]);
    const lng = Number(pathMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const atMatch = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const lat = Number(atMatch[1]);
    const lng = Number(atMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const dmsMatch = queryNormalized.match(
    /(\d{1,2})°\s*(\d{1,2})'\s*(\d{1,2}(?:\.\d+)?)"?\s*([NSns])[,\s]+(\d{1,3})°\s*(\d{1,2})'\s*(\d{1,2}(?:\.\d+)?)"?\s*([EWewOo])/
  );
  if (dmsMatch) {
    let lat = Number(dmsMatch[1]) + Number(dmsMatch[2]) / 60 + Number(dmsMatch[3]) / 3600;
    if (dmsMatch[4].toUpperCase() === 'S') lat = -lat;
    let lng = Number(dmsMatch[5]) + Number(dmsMatch[6]) / 60 + Number(dmsMatch[7]) / 3600;
    if (['W', 'O'].includes(dmsMatch[8].toUpperCase())) lng = -lng;
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const htmlArrMatch = decoded.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
  if (htmlArrMatch) {
    const lat = Number(htmlArrMatch[1]);
    const lng = Number(htmlArrMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  return null;
}

interface NominatimItem {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  geojson?: {
    type: string;
    coordinates: unknown;
  };
}

function collectGeoPoints(items: NominatimItem[]): [number, number][] {
  const pts: [number, number][] = [];
  for (const item of items) {
    const g = item.geojson;
    if (g && g.type === 'LineString' && Array.isArray(g.coordinates)) {
      for (const c of g.coordinates as [number, number][]) {
        if (Array.isArray(c) && c.length >= 2) pts.push([Number(c[1]), Number(c[0])]);
      }
    } else if (g && g.type === 'MultiLineString' && Array.isArray(g.coordinates)) {
      for (const line of g.coordinates as [number, number][][]) {
        for (const c of line) {
          if (Array.isArray(c) && c.length >= 2) pts.push([Number(c[1]), Number(c[0])]);
        }
      }
    } else {
      const la = Number(item.lat);
      const ln = Number(item.lon);
      if (!Number.isNaN(la) && !Number.isNaN(ln)) pts.push([la, ln]);
    }
  }
  return pts;
}

function findClosestStreetCrossing(
  ptsA: [number, number][],
  ptsB: [number, number][]
): { lat: number; lng: number } | null {
  let minDistSq = Infinity;
  let best: { lat: number; lng: number } | null = null;
  for (const [la1, ln1] of ptsA) {
    for (const [la2, ln2] of ptsB) {
      const dLat = la1 - la2;
      const dLng = ln1 - ln2;
      const dSq = dLat * dLat + dLng * dLng;
      if (dSq < minDistSq) {
        minDistSq = dSq;
        best = { lat: (la1 + la2) / 2, lng: (ln1 + ln2) / 2 };
      }
    }
  }
  if (best && Math.sqrt(minDistSq) <= 0.0015) {
    return best;
  }
  return null;
}

async function fetchNominatim(query: string, withGeometry = false): Promise<NominatimItem[]> {
  const geoParam = withGeometry ? '&polygon_geojson=1' : '';
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    query
  )}&countrycodes=py&viewbox=-57.75,-25.15,-57.45,-25.40&limit=8&addressdetails=1&accept-language=es${geoParam}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Error consultando Nominatim');
  return (await res.json()) as NominatimItem[];
}

// Formatea un Date a YYYY-MM-DDTHH:mm en hora local de Paraguay (America/Asuncion)
function formatDateToParaguayInput(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

function getParaguayNowISO(): string {
  return formatDateToParaguayInput(new Date());
}

// Convierte un valor datetime-local (hora Paraguay) a ISO timestamptz exacto
function paraguayLocalToISO(localDateTime: string): string | null {
  const m = localDateTime.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const approx = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00-03:00`);
  if (Number.isNaN(approx.getTime())) return null;

  const tzPart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Asuncion',
    timeZoneName: 'longOffset',
  })
    .formatToParts(approx)
    .find((p) => p.type === 'timeZoneName')?.value;
  const offsetMatch = tzPart?.match(/GMT([+-]\d{2}:\d{2})/);
  const offset = offsetMatch ? offsetMatch[1] : '-03:00';
  const exact = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00${offset}`);
  return Number.isNaN(exact.getTime()) ? null : exact.toISOString();
}

async function uploadManualWithTus(
  file: File,
  filePath: string,
  accessToken: string,
  onProgress?: (pct: number) => void
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error('Configuración de Supabase no disponible.');
  }

  return new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
        'x-upsert': 'false',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: 'reportes',
        objectName: filePath,
        contentType: file.type || 'image/jpeg',
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024,
      onError: (err) => reject(err),
      onProgress: (uploaded, total) => {
        if (total > 0 && onProgress) {
          onProgress(Math.round((uploaded / total) * 100));
        }
      },
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}

export default function ManualForm({ initialData }: { initialData?: ManualReportInitialData | null }) {
  const router = useRouter();
  const isEditMode = Boolean(initialData?.id);

  // ---- State -------------------------------------------------------
  const [locationMethod, setLocationMethod] = useState<'map' | 'google' | 'coords' | 'address'>('map');
  const [lat, setLat] = useState(() => (initialData ? String(initialData.latitud) : ''));
  const [lng, setLng] = useState(() => (initialData ? String(initialData.longitud) : ''));
  const [mapLink, setMapLink] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [intersection, setIntersection] = useState('');
  const [dateTime, setDateTime] = useState(() =>
    initialData?.fecha_evento
      ? formatDateToParaguayInput(new Date(initialData.fecha_evento))
      : getParaguayNowISO()
  );
  const [origin, setOrigin] = useState<OrigenManual>(() => initialData?.origen_manual ?? 'whatsapp_manual');
  const [tags, setTags] = useState<string[]>(() => initialData?.afectaciones ?? []);
  const [description, setDescription] = useState(() => initialData?.descripcion ?? '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState(() => initialData?.imagen_url ?? '');
  const [previewUrl, setPreviewUrl] = useState('');
  const [idempotenciaToken] = useState(() => crypto.randomUUID());

  const [mapLinkLoading, setMapLinkLoading] = useState(false);
  const [mapLinkError, setMapLinkError] = useState('');
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressMessage, setAddressMessage] = useState<{ type: 'info' | 'error'; text: string } | null>(null);
  const [addressResults, setAddressResults] = useState<NominatimItem[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectMapPoint = (newLat: number, newLng: number) => {
    setLat(newLat.toFixed(6));
    setLng(newLng.toFixed(6));
  };

  const applyGoogleMapsLink = async (rawLink: string) => {
    const trimmed = rawLink.trim();
    setMapLinkError('');
    if (!trimmed) return;

    const direct = extractCoordsFromGoogleMapsText(trimmed);
    if (direct) {
      handleSelectMapPoint(direct.lat, direct.lng);
      return;
    }

    if (/^https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl|(?:www\.|maps\.)?google\.com(?:\.py)?)\//i.test(trimmed)) {
      setMapLinkLoading(true);
      try {
        const res = await resolveGoogleMapsShortUrl(trimmed);
        if (res.error) {
          setMapLinkError(res.error);
          return;
        }
        const fromFinal =
          (res.finalUrl ? extractCoordsFromGoogleMapsText(res.finalUrl) : null) ??
          (res.htmlSnippet ? extractCoordsFromGoogleMapsText(res.htmlSnippet) : null);

        if (fromFinal) {
          handleSelectMapPoint(fromFinal.lat, fromFinal.lng);
        } else {
          setMapLinkError('No se encontraron coordenadas en el enlace. Abrí el enlace y copiá la URL completa.');
        }
      } catch {
        setMapLinkError('No se pudo procesar el enlace de Google Maps.');
      } finally {
        setMapLinkLoading(false);
      }
    } else {
      setMapLinkError('No se reconocieron coordenadas en el enlace ingresado.');
    }
  };

  const handleAddressSearch = async () => {
    const c = city.trim();
    const s = street.trim();
    const inter = intersection.trim();

    if (!c && !s) {
      setAddressMessage({ type: 'error', text: 'Ingresá al menos la calle o la ciudad para buscar.' });
      return;
    }

    setAddressLoading(true);
    setAddressMessage(null);
    setAddressResults([]);

    try {
      if (s && inter) {
        const qStreet = [s, c].filter(Boolean).join(', ');
        const qInter = [inter, c].filter(Boolean).join(', ');
        const [resStreet, resInter] = await Promise.all([
          fetchNominatim(qStreet, true),
          fetchNominatim(qInter, true),
        ]);

        if (resStreet.length > 0 && resInter.length > 0) {
          const crossing = findClosestStreetCrossing(
            collectGeoPoints(resStreet),
            collectGeoPoints(resInter)
          );
          if (crossing) {
            handleSelectMapPoint(crossing.lat, crossing.lng);
            setAddressMessage({
              type: 'info',
              text: `Intersección ubicada: ${s} y ${inter}${c ? ` (${c})` : ''}.`,
            });
            setAddressResults(resStreet.slice(0, 4));
            return;
          }
        }

        if (resStreet.length > 0) {
          const first = resStreet[0];
          handleSelectMapPoint(Number(first.lat), Number(first.lon));
          setAddressResults(resStreet.slice(0, 5));
          setAddressMessage({
            type: 'info',
            text: `No se halló el cruce exacto con "${inter}"; se ubicó "${s}". Podés ajustar el punto haciendo clic en el mapa.`,
          });
          return;
        }
      }

      const mainQuery = [s, c].filter(Boolean).join(', ');
      const data = await fetchNominatim(mainQuery, false);

      if (data.length === 0) {
        setAddressMessage({
          type: 'error',
          text: 'No se encontraron resultados para esa dirección en Paraguay.',
        });
        return;
      }

      const first = data[0];
      handleSelectMapPoint(Number(first.lat), Number(first.lon));
      setAddressResults(data.slice(0, 5));
    } catch {
      setAddressMessage({
        type: 'error',
        text: 'No se pudo consultar el servicio de búsqueda de direcciones.',
      });
    } finally {
      setAddressLoading(false);
    }
  };

  // ---- Image preview -----------------------------------------------------
  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl('');
    }
  }, [imageFile]);

  const activePreview = previewUrl || existingImageUrl;

  const handleFilePick = (file: File | null) => {
    if (!file) return;
    const rawExt = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'avif'];
    if (!allowedExts.includes(rawExt) && !file.type.startsWith('image/')) {
      setSubmitError('Formato de imagen no admitido. Usá JPG, PNG, WEBP, HEIC, HEIF o AVIF.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setSubmitError('La fotografía supera el límite máximo permitido de 50 MB.');
      return;
    }
    setSubmitError('');
    setImageFile(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setExistingImageUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 11)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setSubmitError('');

    const parsedLat = Number(lat.trim().replace(',', '.'));
    const parsedLng = Number(lng.trim().replace(',', '.'));
    if (!lat.trim() || !lng.trim() || !isValidLatLng(parsedLat, parsedLng)) {
      setSubmitError('Seleccioná una ubicación válida en el mapa antes de guardar el reporte.');
      return;
    }

    if (!imageFile && !existingImageUrl) {
      setSubmitError('Debés adjuntar una fotografía obligatoria para guardar el reporte.');
      return;
    }

    const fechaEventoIso = paraguayLocalToISO(dateTime);
    if (!fechaEventoIso) {
      setSubmitError('Ingresá una fecha y hora válidas.');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(null);

    let finalImageUrl = existingImageUrl;
    let uploadedStoragePath: string | null = null;

    const browserSupabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    try {
      if (imageFile) {
        const rawExt = (imageFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'avif'];
        const ext = allowedExts.includes(rawExt) ? rawExt : 'jpg';
        const filePath = `imagenes/manuales/${crypto.randomUUID()}.${ext}`;

        if (imageFile.size >= 6 * 1024 * 1024) {
          const { data: sessionData } = await browserSupabase.auth.getSession();
          const token = sessionData.session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
          try {
            await uploadManualWithTus(imageFile, filePath, token, (pct) => setUploadProgress(pct));
          } catch {
            setUploadProgress(null);
            const { error: upErr } = await browserSupabase.storage
              .from('reportes')
              .upload(filePath, imageFile, {
                contentType: imageFile.type || 'image/jpeg',
                upsert: false,
              });
            if (upErr) throw new Error(`Error al subir la fotografía: ${upErr.message}`);
          }
        } else {
          const { error: upErr } = await browserSupabase.storage
            .from('reportes')
            .upload(filePath, imageFile, {
              contentType: imageFile.type || 'image/jpeg',
              upsert: false,
            });
          if (upErr) throw new Error(`Error al subir la fotografía: ${upErr.message}`);
        }

        uploadedStoragePath = filePath;
        const { data: pubData } = browserSupabase.storage.from('reportes').getPublicUrl(filePath);
        finalImageUrl = pubData.publicUrl;
      }

      const res = isEditMode && initialData
        ? await actualizarReporteManual({
            id: initialData.id,
            latitud: parsedLat,
            longitud: parsedLng,
            imagenUrl: finalImageUrl,
            newUploadedStoragePath: uploadedStoragePath,
            fechaEventoIso,
            origenManual: origin,
            afectaciones: tags,
            descripcion: description,
          })
        : await crearReporteManual({
            latitud: parsedLat,
            longitud: parsedLng,
            imagenUrl: finalImageUrl,
            uploadedStoragePath,
            fechaEventoIso,
            origenManual: origin,
            afectaciones: tags,
            descripcion: description,
            idempotenciaToken,
          });

      if (!res.ok) {
        setSubmitError(res.message);
        return;
      }

      router.push('/admin/manuales');
      router.refresh();
    } catch (err) {
      if (uploadedStoragePath) {
        await browserSupabase.storage.from('reportes').remove([uploadedStoragePath]).catch(() => {});
      }
      setSubmitError(
        err instanceof Error ? err.message : 'Ocurrió un error al guardar el reporte manual.'
      );
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  const handleCancel = () => {
    router.push('/admin/manuales');
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-6 bg-gray-50 p-6 rounded-lg shadow-sm">
      {/* Header */}
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-800">
          {isEditMode ? 'Editar reporte manual' : 'Registrar reporte manual'}
        </h1>
        <p className="text-sm text-slate-600">
          {isEditMode
            ? 'Modifique los datos del evento o reemplace la fotografía si corresponde.'
            : 'Complete los datos del evento y cargue la fotografía correspondiente.'}
        </p>
      </header>

      {/* Two‑column layout */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* ---------- LEFT COLUMN ---------- */}
        <section className="bg-white rounded-lg shadow p-4 space-y-4">
          <div className="flex items-center gap-2 text-slate-700 mb-2">
            <MapPin size={20} />
            <h2 className="text-lg font-semibold">Ubicación</h2>
          </div>

          {/* Tabs for location method */}
          <div className="flex flex-wrap gap-2 mb-2">
            {LOCATION_TABS.map(({ key, label }) => (
              <button
                type="button"
                key={key}
                onClick={() => setLocationMethod(key)}
                className={`px-3 py-1 rounded-t-md text-sm font-medium border-b-2 ${
                  locationMethod === key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Method‑specific fields */}
          {locationMethod === 'google' && (
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-slate-700">Enlace de Google Maps</span>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={mapLink}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMapLink(val);
                    setMapLinkError('');
                    const direct = extractCoordsFromGoogleMapsText(val);
                    if (direct) {
                      handleSelectMapPoint(direct.lat, direct.lng);
                    }
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text');
                    if (pasted && !extractCoordsFromGoogleMapsText(pasted)) {
                      setTimeout(() => applyGoogleMapsLink(pasted), 0);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      applyGoogleMapsLink(mapLink);
                    }
                  }}
                  className="flex-1 h-10 rounded border border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-2.5 text-sm"
                  placeholder="https://www.google.com/maps/... o https://maps.app.goo.gl/..."
                />
                <button
                  type="button"
                  onClick={() => applyGoogleMapsLink(mapLink)}
                  disabled={mapLinkLoading || !mapLink.trim()}
                  className="h-10 px-3 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {mapLinkLoading && <Loader2 size={14} className="animate-spin" />}
                  Ubicar
                </button>
              </div>
              {mapLinkError && <p className="text-xs text-red-600">{mapLinkError}</p>}
            </div>
          )}

          {locationMethod === 'coords' && (
            <div className="space-y-2">
              <div className="grid sm:grid-cols-2 gap-2">
                <label className="block">
                  <span className="block text-sm font-medium text-slate-700 mb-1">Latitud</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={lat}
                    onChange={(e) => {
                      const val = e.target.value;
                      const pair = parseCombinedCoords(val);
                      if (pair) {
                        setLat(pair.lat);
                        setLng(pair.lng);
                      } else {
                        setLat(val);
                      }
                    }}
                    className="w-full h-10 rounded border border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-2.5 text-sm"
                    placeholder="-25.286 o -25.286, -57.616"
                  />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-slate-700 mb-1">Longitud</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={lng}
                    onChange={(e) => {
                      const val = e.target.value;
                      const pair = parseCombinedCoords(val);
                      if (pair) {
                        setLat(pair.lat);
                        setLng(pair.lng);
                      } else {
                        setLng(val);
                      }
                    }}
                    className="w-full h-10 rounded border border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-2.5 text-sm"
                    placeholder="-57.616"
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500">
                Podés ingresarlas por separado o pegar ambas juntas (ej: -25.286, -57.616).
              </p>
              {lat.trim() !== '' &&
                lng.trim() !== '' &&
                !isValidLatLng(
                  Number(lat.trim().replace(',', '.')),
                  Number(lng.trim().replace(',', '.'))
                ) && (
                  <p className="text-xs text-red-600">
                    Coordenadas fuera de rango (latitud entre -90 y 90, longitud entre -180 y 180).
                  </p>
                )}
            </div>
          )}

          {locationMethod === 'address' && (
            <div className="space-y-2">
              <div className="grid gap-2">
                <label className="block">
                  <span className="block text-sm font-medium text-slate-700 mb-1">Ciudad</span>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddressSearch();
                      }
                    }}
                    className="w-full h-10 rounded border border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-2.5 text-sm"
                    placeholder="Ej: Asunción, Luque, San Lorenzo..."
                  />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-slate-700 mb-1">Calle</span>
                  <input
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddressSearch();
                      }
                    }}
                    className="w-full h-10 rounded border border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-2.5 text-sm"
                    placeholder="Ej: Av. Mariscal López"
                  />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-slate-700 mb-1">Intersección (opcional)</span>
                  <input
                    type="text"
                    value={intersection}
                    onChange={(e) => setIntersection(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddressSearch();
                      }
                    }}
                    className="w-full h-10 rounded border border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-2.5 text-sm"
                    placeholder="Ej: San Martín"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleAddressSearch}
                disabled={addressLoading || (!city.trim() && !street.trim())}
                className="w-full h-10 px-3 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {addressLoading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                Buscar dirección
              </button>

              {addressMessage && (
                <p className={`text-xs ${addressMessage.type === 'error' ? 'text-red-600' : 'text-blue-700'}`}>
                  {addressMessage.text}
                </p>
              )}

              {addressResults.length > 1 && (
                <div className="border border-slate-200 rounded divide-y divide-slate-100 max-h-36 overflow-y-auto bg-slate-50">
                  {addressResults.map((item) => (
                    <button
                      key={item.place_id}
                      type="button"
                      onClick={() => handleSelectMapPoint(Number(item.lat), Number(item.lon))}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-blue-50 transition-colors"
                    >
                      {item.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Map interactive */}
          <InteractiveMap lat={lat} lng={lng} onSelectLocation={handleSelectMapPoint} />

          {/* Coordinates display (when lat/lng set) */}
          {(lat || lng) && (
            <div className="text-sm text-slate-600">
              Coordenadas seleccionadas: {lat || '-'} , {lng || '-'}
            </div>
          )}

          {/* Photo uploader – mandatory visual */}
          <div className="space-y-2">
            <span className="block text-sm font-medium text-slate-700">Fotografía (obligatoria)</span>
            <div className="border-2 border-dashed border-slate-300 rounded p-4 flex flex-col items-center justify-center text-center">
              {activePreview ? (
                <div className="space-y-2 w-full flex flex-col items-center">
                  <div className="relative w-full max-w-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={activePreview} alt="Previsualización" className="w-full max-h-56 object-contain rounded" />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      title="Eliminar fotografía"
                      className="absolute top-1 right-1 bg-white rounded-full p-1 shadow hover:bg-slate-200"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1 text-xs font-medium rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    >
                      Reemplazar foto
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="px-3 py-1 text-xs font-medium rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 text-blue-600 hover:underline py-4"
                >
                  <Camera size={20} className="text-slate-500" />
                  Seleccionar foto
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif,image/*"
                className="hidden"
                onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        </section>

        {/* ---------- RIGHT COLUMN ---------- */}
        <section className="bg-white rounded-lg shadow p-4 space-y-4">
          <div className="flex items-center gap-2 text-slate-700 mb-2">
            <Calendar size={20} />
            <h2 className="text-lg font-semibold">Datos del evento</h2>
          </div>

          {/* Date & Time */}
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">Fecha y hora (Paraguay)</span>
            <input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              className="w-full h-10 rounded border border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-2.5 text-sm"
            />
          </label>

          {/* Origin */}
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">Origen del reporte</span>
            <select
              value={origin}
              onChange={(e) => setOrigin(e.target.value as OrigenManual)}
              className="w-full h-10 rounded border border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-2.5 text-sm bg-white"
            >
              {ORIGIN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {/* Afectaciones – grid */}
          <div>
            <span className="block text-sm font-medium text-slate-700 mb-1">Afectaciones (opcional)</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { label: 'Calle inundada', icon: <Droplet size={14} /> },
                { label: 'Deslizamiento', icon: <AlertCircle size={14} /> },
                { label: 'Árbol caído', icon: <TreeDeciduous size={14} /> },
                { label: 'Vivienda afectada', icon: <Home size={14} /> },
                { label: 'Vehículo afectado', icon: <Car size={14} /> },
                { label: 'Persona atrapada', icon: <User size={14} /> },
                { label: 'Fallecimiento reportado', icon: <Skull size={14} /> },
                { label: 'Interrupción de tránsito', icon: <Road size={14} /> },
                { label: 'Servicio público afectado', icon: <Zap size={14} /> },
                { label: 'Acumulación de basura', icon: <Trash2 size={14} /> },
                { label: 'Sin daños visibles', icon: <EyeOff size={14} /> },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => toggleTag(item.label)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded border ${
                    tags.includes(item.label)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">Descripción (opcional)</span>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              className="w-full h-24 rounded border border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-2.5 py-1.5 text-sm"
              placeholder="Detalles del evento..."
            />
          </label>
        </section>
      </div>

      {submitError && (
        <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
          {submitError}
        </div>
      )}

      {/* Action buttons placed under both columns */}
      <div className="flex justify-end gap-4 pt-4">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-2"
        >
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          {isSubmitting
            ? uploadProgress !== null
              ? `Subiendo foto (${uploadProgress}%)...`
              : 'Guardando...'
            : isEditMode
              ? 'Guardar cambios'
              : 'Guardar reporte'}
        </button>
      </div>
    </form>
  );
}
