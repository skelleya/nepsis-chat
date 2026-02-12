import { Router } from 'express'
import supabase from '../db/supabase.js'

export const usersRouter = Router()

// Lookup user by username (for Add Friend, etc.) — must be before /:id routes
usersRouter.get('/lookup', async (req, res) => {
  const { username } = req.query
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'username query required' })
  }
  const q = username.trim()
  if (!q) return res.status(400).json({ error: 'username cannot be empty' })
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, display_name, avatar_url')
      .ilike('username', q)
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (!data) return res.json(null)
    return res.json({
      id: data.id,
      username: data.username,
      display_name: data.display_name,
      avatar_url: data.avatar_url,
    })
  } catch (err) {
    console.error('User lookup error:', err)
    res.status(500).json({ error: 'Failed to lookup user' })
  }
})

// Update presence (online, offline, in-voice)
usersRouter.put('/:id/presence', async (req, res) => {
  const { id } = req.params
  const { status, voiceChannelId } = req.body
  if (!status) return res.status(400).json({ error: 'status required' })

  const valid = ['online', 'offline', 'in-voice', 'away', 'dnd']
  if (!valid.includes(status)) return res.status(400).json({ error: 'status must be online, offline, in-voice, away, or dnd' })

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

// Update user profile (username, display_name, avatar_url, banner_url) — own account only
usersRouter.patch('/:id', async (req, res) => {
  const { id } = req.params
  const { username, display_name, avatar_url, banner_url } = req.body

  try {
    const updates = {}
    if (typeof username === 'string' && username.trim().length > 0) updates.username = username.trim()
    if (display_name !== undefined) updates.display_name = typeof display_name === 'string' ? (display_name.trim() || null) : null
    if (typeof avatar_url === 'string') updates.avatar_url = avatar_url || null
    if (typeof banner_url === 'string') updates.banner_url = banner_url || null

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' })

    const { data, error } = await supabase.from('users').update(updates).eq('id', id).select().single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    console.error('Profile update error:', err)
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

// Get user profiles (personal, work) — for non-guest accounts
usersRouter.get('/:id/profiles', async (req, res) => {
  const { id } = req.params
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', id)

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('Profiles fetch error:', err)
    res.status(500).json({ error: 'Failed to fetch profiles' })
  }
})

// Upsert user profile (personal or work)
usersRouter.put('/:id/profiles', async (req, res) => {
  const { id } = req.params
  const { profile_type, display_name, avatar_url, banner_url } = req.body

  if (!profile_type || !['personal', 'work'].includes(profile_type)) {
    return res.status(400).json({ error: 'profile_type must be personal or work' })
  }

  try {
    const profileId = `${id}-${profile_type}`
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(
        {
          id: profileId,
          user_id: id,
          profile_type,
          display_name: display_name || '',
          avatar_url: avatar_url || null,
          banner_url: banner_url || null,
        },
        { onConflict: 'id' }
      )
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err) {
    console.error('Profile upsert error:', err)
    res.status(500).json({ error: 'Failed to save profile' })
  }
})
