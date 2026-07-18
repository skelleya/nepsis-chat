import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = (process.env.SUPABASE_URL || '').trim()
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const anonKey = (process.env.SUPABASE_ANON_KEY || '').trim()

// Prefer service role (bypasses RLS). Fall back to anon for local/dev if unset.
const supabaseKey = serviceRoleKey || anonKey

/** False when Railway/host is missing Supabase env — process still starts for /api/health. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

if (!isSupabaseConfigured) {
  console.error(
    '[supabase] Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY). ' +
      'Server will start for health checks, but API routes will fail until these are set in Railway Variables.'
  )
} else if (!serviceRoleKey && anonKey) {
  console.warn(
    '[supabase] SUPABASE_SERVICE_ROLE_KEY is empty — using SUPABASE_ANON_KEY. ' +
      'Paste the service_role key from Dashboard → Settings → API for production and storage uploads.'
  )
}

// Placeholder client keeps imports from crashing when env is missing (deploy diagnostics).
const supabase = createClient(
  supabaseUrl || 'https://example.supabase.co',
  supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder'
)

export default supabase
