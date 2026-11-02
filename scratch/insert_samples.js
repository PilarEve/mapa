/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function getEnv() {
  const envPath = path.resolve(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('Archivo .env.local no encontrado.');
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const url = (content.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/) || [])[1]?.trim().replace(/^["']|["']$/g, '');
  const key = (content.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim().replace(/^["']|["']$/g, '');
  if (!url || !key) {
    throw new Error('Variables NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY no encontradas en .env.local');
  }
  return { url, key };
}

const { url: supabaseUrl, key: supabaseAnonKey } = getEnv();
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const sampleReports = [
  {
    latitud: -25.285,
    longitud: -57.568,
    descripcion: 'Inundación repentina cerca del Shopping del Sol. El agua cubre media calzada.',
    afectaciones: ['Calle inundada', 'Interrupción de tránsito']
  },
  {
    latitud: -25.326,
    longitud: -57.595,
    descripcion: 'Arroyo desbordado cerca de la Terminal. Tránsito interrumpido.',
    afectaciones: ['Calle inundada', 'Interrupción de tránsito']
  },
  {
    latitud: -25.277,
    longitud: -57.635,
    descripcion: 'Acumulación de agua en la zona de la Costanera. Precaución.',
    afectaciones: ['Calle inundada', 'Sin daños visibles']
  },
  {
    latitud: -25.297,
    longitud: -57.585,
    descripcion: 'Puntos críticos en Villa Morra. Sumideros tapados.',
    afectaciones: ['Servicio público afectado', 'Interrupción de tránsito']
  },
  {
    latitud: -25.305,
    longitud: -57.620,
    descripcion: 'Agua estancada en Barrio Obrero después de la tormenta.',
    afectaciones: ['Calle inundada']
  }
];

async function insertSamples() {
  console.log('Inserting sample reports...');
  const { error } = await supabase
    .from('reportes')
    .insert(sampleReports);

  if (error) {
    console.error('Error inserting reports:', error.message);
  } else {
    console.log('Successfully inserted sample reports.');
  }
}

insertSamples();
