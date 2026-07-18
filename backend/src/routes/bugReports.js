import { Router } from 'express'
import crypto from 'crypto'
import supabase from '../db/supabase.js'

export const bugReportsRouter = Router()

// Submit a bug report — registered (non-guest) accounts only
bugReportsRouter.post('/', async (req, res) => {
  try {
    const { userId, username, email, title, description } = req.body

    if (!title?.trim() || !description?.trim()) {
      return res.status(400).json({ error: 'Title and description are required' })
    }

    if (!userId || typeof userId !== 'string') {
      return res.status(403).json({ error: 'Sign in required to submit bug reports' })
    }

    const { data: account, error: userErr } = await supabase
      .from('users')
      .select('id, is_guest')
      .eq('id', userId)
      .maybeSingle()

    if (userErr) throw userErr
    if (!account) {
      return res.status(403).json({ error: 'Sign in required to submit bug reports' })
    }
    if (account.is_guest) {
      return res.status(403).json({
        error: 'Guest accounts cannot submit bug reports. Sign in or create an account first.',
      })
    }

    const reportId = 'br-' + crypto.randomUUID()
    const url = req.body.url || null
    const userAgent = req.headers['user-agent'] || null

    const { error } = await supabase.from('bug_reports').insert({
      id: reportId,
      user_id: userId,
      username: username?.trim() || null,
      email: email?.trim() || null,
      title: title.trim().slice(0, 256),
      description: description.trim().slice(0, 8000),
      url: url?.trim()?.slice(0, 2048) || null,
      user_agent: userAgent?.slice(0, 1024) || null,
      status: 'pending',
    })

    if (error) {
      if (error.code === '42P01' || /relation.*does not exist/i.test(error.message || '')) {
        return res.status(503).json({
          error: 'Bug reports not configured. Run migration 20250211000008_bug_reports.sql',
        })
      }
      throw error
    }

    res.status(201).json({ id: reportId, success: true })
  } catch (err) {
    console.error('Bug report error:', err)
    res.status(500).json({ error: 'Failed to submit bug report' })
  }
})
