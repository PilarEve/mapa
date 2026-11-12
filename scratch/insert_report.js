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

async function insertReport() {
  const { data, error } = await supabase
    .from('reportes')
    .insert([
      {
        latitud: -25.2950,
        longitud: -57.6250,
        descripcion: 'Acumulación importante de agua sobre la calzada tras lluvias intensas. El agua cubre parcialmente las veredas y dificulta el tránsito vehicular.',
        imagen_url: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?q=80&w=1000&auto=format&fit=crop',
        afectaciones: ['Calle inundada', 'Interrupción de tránsito']
      }
    ]);

  if (error) {
    console.error('Error inserting report:', error);
    process.exit(1);
  } else {
    console.log('Report inserted successfully:', data);
  }
}

insertReport();
