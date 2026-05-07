import { supabase } from '@/lib/supabase'

export default async function TestDBPage() {
  const { data, error } = await supabase
    .from('reportes')
    .select('*')

  return (
    <main style={{ padding: '20px' }}>
      <h1>Prueba Supabase</h1>

      <h2>Datos:</h2>
      <pre>{JSON.stringify(data, null, 2)}</pre>

      <h2>Error:</h2>
      <pre>{JSON.stringify(error, null, 2)}</pre>
    </main>
  )
}
