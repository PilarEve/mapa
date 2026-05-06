import { Report } from '../types/report';

export const mockReports: Report[] = [
  {
    id: "R001",
    lat: -25.2985,
    lng: -57.6250,
    description: "Acumulación de agua sobre la avenida. Tráfico pesado.",
    severity: "medio",
    dateTime: "2026-05-06T14:30:00",
    imageUrl: "https://placehold.co/400x300/EEE/31343C?font=montserrat&text=Reporte+1",
    status: "validado"
  },
  {
    id: "R002",
    lat: -25.2855,
    lng: -57.6150,
    description: "Arroyo Mburicaó desbordado, agua ingresando a las viviendas cercanas.",
    severity: "critico",
    dateTime: "2026-05-06T15:00:00",
    imageUrl: "https://placehold.co/400x300/EEE/31343C?font=montserrat&text=Reporte+2",
    status: "validado"
  },
  {
    id: "R003",
    lat: -25.3050,
    lng: -57.6350,
    description: "Boca de tormenta trancada, olor desagradable.",
    severity: "bajo",
    dateTime: "2026-05-06T12:15:00",
    status: "pendiente"
  },
  {
    id: "R004",
    lat: -25.2900,
    lng: -57.6000,
    description: "Calle inundada, vehículos atrapados a mitad de cuadra.",
    severity: "alto",
    dateTime: "2026-05-06T16:20:00",
    status: "validado"
  },
  {
    id: "R005",
    lat: -25.2920,
    lng: -57.6100,
    description: "Agua en la vereda, pero transitable con precaución.",
    severity: "bajo",
    dateTime: "2026-05-06T13:45:00",
    status: "validado"
  }
];
