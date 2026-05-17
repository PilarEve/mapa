const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const url = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const key = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('noticias_historicas').select('id, latitud, longitud').limit(1);
  if (data && data.length > 0) {
    console.log('latitud type:', typeof data[0].latitud, 'value:', data[0].latitud);
    console.log('longitud type:', typeof data[0].longitud, 'value:', data[0].longitud);
  }
}

check();
