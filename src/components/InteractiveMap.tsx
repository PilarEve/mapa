"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const ASUNCION_CENTER: [number, number] = [-25.2855, -57.6150];

// Mismo ícono SVG utilizado en el formulario ciudadano (sin dependencias adicionales)
const markerIcon = L.divIcon({
  className: "custom-leaflet-icon bg-transparent border-0",
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#2563eb" width="32" height="32" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3" fill="white"></circle>
    </svg>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

function MapUpdater({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      const targetZoom = map.getZoom() < 16 ? 16 : map.getZoom();
      map.flyTo(position, targetZoom, { animate: true, duration: 0.8 });
    }
  }, [position, map]);
  return null;
}

function MapClickSelector({ onSelect }: { onSelect?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onSelect) {
        onSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

interface InteractiveMapProps {
  lat?: string;
  lng?: string;
  onSelectLocation?: (lat: number, lng: number) => void;
}

export default function InteractiveMap({ lat, lng, onSelectLocation }: InteractiveMapProps) {
  const parsedLat = lat !== undefined && lat.trim() !== "" ? Number(lat.trim().replace(",", ".")) : NaN;
  const parsedLng = lng !== undefined && lng.trim() !== "" ? Number(lng.trim().replace(",", ".")) : NaN;
  const isValidPosition =
    !Number.isNaN(parsedLat) &&
    !Number.isNaN(parsedLng) &&
    parsedLat >= -90 &&
    parsedLat <= 90 &&
    parsedLng >= -180 &&
    parsedLng <= 180;

  const markerPosition: [number, number] | null = isValidPosition ? [parsedLat, parsedLng] : null;

  return (
    <div className="relative aspect-video w-full bg-slate-100 border border-slate-200 rounded overflow-hidden z-0">
      <div className="absolute inset-0">
        <MapContainer
          center={ASUNCION_CENTER}
          zoom={13}
          scrollWheelZoom={true}
          className="w-full h-full z-0"
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={19}
          />
          <MapClickSelector onSelect={onSelectLocation} />
          <MapUpdater position={markerPosition} />
          {markerPosition && <Marker position={markerPosition} icon={markerIcon} />}
        </MapContainer>
      </div>
    </div>
  );
}
