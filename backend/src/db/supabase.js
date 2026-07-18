import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.SUPABASE_URL
const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const anonKey = (process.env.SUPABASE_ANON_KEY || '').trim()
const supabaseKey = serviceRole || anonKey

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
  process.exit(1)
}

if (!serviceRole && anonKey) {
  console.warn(
    '[supabase] SUPABASE_SERVICE_ROLE_KEY is empty — using SUPABASE_ANON_KEY. Paste the service_role key from Dashboard → Settings → API for production and storage uploads.'
  )
}

// Service role client bypasses RLS — used for all backend operations
const supabase = createClient(supabaseUrl, supabaseKey)

export default supabase
