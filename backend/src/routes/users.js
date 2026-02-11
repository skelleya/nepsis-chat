import { Router } from 'express'
import supabase from '../db/supabase.js'

export const usersRouter = Router()

// Update presence (online, offline, in-voice)
usersRouter.put('/:id/presence', async (req, res) => {
  const { id } = req.params
  const { status, voiceChannelId } = req.body
  if (!status) return res.status(400).json({ error: 'status required' })

  const valid = ['online', 'offline', 'in-voice']
  if (!valid.includes(status)) return res.status(400).json({ error: 'status must be online, offline, or in-voice' })

  try {
    const { error } = await supabase
      .from('user_presence')
      .upsert(
        { user_id: id, status, voice_channel_id: voiceChannelId || null, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    console.error('Presence update error:', err)
    res.status(500).json({ error: 'Failed to update presence' })
  }
})
