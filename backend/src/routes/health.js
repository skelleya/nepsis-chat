import { Router } from 'express'
import { isSupabaseConfigured } from '../db/supabase.js'

export const healthRouter = Router()

/** GET /api/health — used by Railway and deploy smoke tests */
healthRouter.get('/', (_req, res) => {
  res.json({
    ok: true,
    supabaseConfigured: isSupabaseConfigured,
    port: process.env.PORT || null,
    nodeEnv: process.env.NODE_ENV || null,
  })
})
