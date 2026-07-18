import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.SUPABASE_URL
<<<<<<< HEAD
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const anonKey = (process.env.SUPABASE_ANON_KEY || '').trim()

// Prefer service role (bypasses RLS). Fall back to anon for local/dev if unset —
// many tables already have open read/write policies; uploads may still need service role.
const supabaseKey = serviceRoleKey || anonKey
=======
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.SUPABASE_ANON_KEY

// Prefer service role (bypasses RLS). Fall back to anon for local/dev if unset —
// many tables already have open read/write policies; uploads may still need service role.
const supabaseKey = (serviceRoleKey && serviceRoleKey.trim()) || (anonKey && anonKey.trim()) || ''
>>>>>>> origin/master

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL and a Supabase key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY)')
  process.exit(1)
}

<<<<<<< HEAD
if (!serviceRoleKey && anonKey) {
=======
if (!serviceRoleKey || !serviceRoleKey.trim()) {
>>>>>>> origin/master
  console.warn(
    '[supabase] SUPABASE_SERVICE_ROLE_KEY is empty — using SUPABASE_ANON_KEY. ' +
      'Paste the service_role key from Dashboard → Settings → API for production and storage uploads.'
  )
}

const supabase = createClient(supabaseUrl, supabaseKey)

export default supabase
