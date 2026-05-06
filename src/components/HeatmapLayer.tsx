"use client";

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import { Report } from '../types/report';

interface HeatmapLayerProps {
  reports: Report[];
  isVisible: boolean;
}

export default function HeatmapLayer({ reports, isVisible }: HeatmapLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!map || !isVisible) return;

    // Convertir reportes a formato [lat, lng, intensity] para leaflet.heat
    const points = reports.map(report => {
      let intensity = 0.3;
      switch (report.severity) {
        case 'bajo': intensity = 0.3; break;
        case 'medio': intensity = 0.5; break;
        case 'alto': intensity = 0.8; break;
        case 'critico': intensity = 1.0; break;
      }
      return [report.lat, report.lng, intensity] as L.HeatLatLngTuple;
    });

    const heatLayer = L.heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 14,
      gradient: {
        0.4: 'blue',
        0.6: 'cyan',
        0.7: 'lime',
        0.8: 'yellow',
        1.0: 'red'
      }
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, reports, isVisible]);

  return null;
}
