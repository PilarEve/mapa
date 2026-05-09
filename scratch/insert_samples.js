
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gexfcndaymqdnuobjxnb.supabase.co';
const supabaseAnonKey = 'sb_publishable_qyzs56H5QD7AXb53GKd48Q_ruiGV-rj';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const sampleReports = [
  {
    latitud: -25.285,
    longitud: -57.568,
    descripcion: 'Inundación repentina cerca del Shopping del Sol. El agua cubre media calzada.',
    nivel_agua_categoria: 'medio',
    tipo_evento: 'inundacion',
    estado: 'pendiente'
  },
  {
    latitud: -25.326,
    longitud: -57.595,
    descripcion: 'Arroyo desbordado cerca de la Terminal. Tránsito interrumpido.',
    nivel_agua_categoria: 'alto',
    tipo_evento: 'inundacion',
    estado: 'pendiente'
  },
  {
    latitud: -25.277,
    longitud: -57.635,
    descripcion: 'Acumulación de agua en la zona de la Costanera. Precaución.',
    nivel_agua_categoria: 'bajo',
    tipo_evento: 'inundacion',
    estado: 'pendiente'
  },
  {
    latitud: -25.297,
    longitud: -57.585,
    descripcion: 'Puntos críticos en Villa Morra. Sumideros tapados.',
    nivel_agua_categoria: 'alto',
    tipo_evento: 'inundacion',
    estado: 'pendiente'
  },
  {
    latitud: -25.305,
    longitud: -57.620,
    descripcion: 'Agua estancada en Barrio Obrero después de la tormenta.',
    nivel_agua_categoria: 'bajo',
    tipo_evento: 'inundacion',
    estado: 'pendiente'
  }
];

async function insertSamples() {
  console.log('Inserting sample reports...');
  const { data, error } = await supabase
    .from('reportes')
    .insert(sampleReports);

  if (error) {
    console.error('Error inserting reports:', error.message);
  } else {
    console.log('Successfully inserted sample reports.');
  }
}

insertSamples();
