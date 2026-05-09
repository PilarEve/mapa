
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing env variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSupabase() {
  console.log('Testing Supabase connection...');
  
  // Test DB connection
  const { data: dbData, error: dbError } = await supabase
    .from('reportes')
    .select('*')
    .limit(1);

  if (dbError) {
    console.error('Database error:', dbError.message);
  } else {
    console.log('Database connection successful. Reports found:', dbData.length);
  }

  // Test Storage bucket
  const { data: bucketData, error: bucketError } = await supabase.storage.getBucket('reportes');

  if (bucketError) {
    console.error('Storage error:', bucketError.message);
  } else {
    console.log('Bucket "reportes" found and accessible.');
  }
}

testSupabase();
