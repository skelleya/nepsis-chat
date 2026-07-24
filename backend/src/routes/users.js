import { Router } from 'express'
import supabase from '../db/supabase.js'

export const usersRouter = Router()

/**
 * Search discoverable profiles by display name (public identities).
 * Never returns login usernames — profiles are separate public personas.
 * Must be before /:id routes.
 */
usersRouter.get('/profiles/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'q must be at least 2 characters' })
  }
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, user_id, profile_type, display_name, bio, avatar_url, banner_url, discoverable')
      .eq('discoverable', true)
      .ilike('display_name', `%${q}%`)
      .limit(20)

    if (error) throw error

    return res.json(
      (data || [])
        .filter((p) => p.display_name && p.display_name.trim())
        .map((p) => ({
          profile_id: p.id,
          user_id: p.user_id,
          profile_type: p.profile_type,
          display_name: p.display_name,
          bio: p.bio || '',
          avatar_url: p.avatar_url,
          banner_url: p.banner_url,
        }))
    )
  } catch (err) {
    console.error('Profile search error:', err)
    res.status(500).json({ error: 'Failed to search profiles' })
  }
})

/**
 * Legacy username lookup — kept for guests / internal tools.
 * Does NOT expose username in a friend-facing way on the new search path.
 * Prefer /profiles/search for Add Friend.
 */
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
      .select('id, display_name, avatar_url, banner_url, active_profile, is_guest')
      .ilike('username', q)
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (!data) return res.json(null)

    // Resolve public presentation from their default/active profile when possible
    const profileType = data.active_profile === 'work' ? 'work' : 'personal'
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('profile_type, display_name, bio, avatar_url, banner_url, discoverable')
      .eq('user_id', data.id)
      .eq('profile_type', profileType)
      .maybeSingle()

    return res.json({
      id: data.id,
      display_name: (profile?.display_name && profile.display_name.trim()) || data.display_name || 'Unknown',
      bio: profile?.bio || '',
      avatar_url: profile?.avatar_url || data.avatar_url,
      banner_url: profile?.banner_url || data.banner_url,
      profile_type: profile?.profile_type || 'personal',
      is_guest: !!data.is_guest,
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

const DEFAULT_PRIVACY = {
  who_can_dm: 'friends',
  who_can_call: 'friends',
  who_can_add_friend: 'everyone',
  show_voice_channel: 'everyone',
  show_online_status: 'everyone',
  allow_voice_activity_indicator: true,
}

const PRIVACY_ENUMS = {
  who_can_dm: ['everyone', 'friends', 'nobody'],
  who_can_call: ['everyone', 'friends', 'nobody'],
  who_can_add_friend: ['everyone', 'server_members', 'nobody'],
  show_voice_channel: ['everyone', 'friends', 'nobody'],
  show_online_status: ['everyone', 'friends', 'nobody'],
}

// Update user profile (username, display_name, avatar_url, banner_url, active_profile)
usersRouter.patch('/:id', async (req, res) => {
  const { id } = req.params
  const { username, display_name, avatar_url, banner_url, active_profile } = req.body

  try {
    const updates = {}
    if (typeof username === 'string' && username.trim().length > 0) updates.username = username.trim()
    if (display_name !== undefined) updates.display_name = typeof display_name === 'string' ? (display_name.trim() || null) : null
    if (typeof avatar_url === 'string') updates.avatar_url = avatar_url || null
    if (typeof banner_url === 'string') updates.banner_url = banner_url || null
    if (active_profile !== undefined) {
      if (!['personal', 'work'].includes(active_profile)) {
        return res.status(400).json({ error: 'active_profile must be personal or work' })
      }

      // Work requires a saved Work display name; otherwise keep Personal
      if (active_profile === 'work') {
        const { data: workProfile } = await supabase
          .from('user_profiles')
          .select('display_name')
          .eq('user_id', id)
          .eq('profile_type', 'work')
          .maybeSingle()
        if (!workProfile?.display_name?.trim()) {
          return res.status(400).json({ error: 'Set up a Work profile display name before switching to Work' })
        }
      }

      updates.active_profile = active_profile

      // Sync public presentation immediately from the selected profile (or username for empty Personal)
      const { data: selected } = await supabase
        .from('user_profiles')
        .select('display_name, avatar_url, banner_url')
        .eq('user_id', id)
        .eq('profile_type', active_profile)
        .maybeSingle()
      const { data: accountRow } = await supabase
        .from('users')
        .select('username')
        .eq('id', id)
        .maybeSingle()
      const fallbackName = accountRow?.username || null
      updates.display_name = (selected?.display_name && selected.display_name.trim()) || fallbackName
      if (selected) {
        updates.avatar_url = selected.avatar_url || null
        updates.banner_url = selected.banner_url || null
      }
    }

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' })

    const { data, error } = await supabase.from('users').update(updates).eq('id', id).select().single()
    if (error) throw error

    // Keep active user_profiles row in sync when My Account changes avatar/banner.
    // Members list prefers profile.avatar_url over users.avatar_url — without this,
    // others keep seeing the old photo after a My Account upload.
    if (typeof avatar_url === 'string' || typeof banner_url === 'string') {
      const profileType = data.active_profile === 'work' ? 'work' : 'personal'
      const profileId = `${id}-${profileType}`
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id, display_name, avatar_url, banner_url, bio, discoverable')
        .eq('user_id', id)
        .eq('profile_type', profileType)
        .maybeSingle()

      const profileRow = {
        id: existingProfile?.id || profileId,
        user_id: id,
        profile_type: profileType,
        display_name: (existingProfile?.display_name && existingProfile.display_name.trim())
          || data.display_name
          || data.username
          || '',
        avatar_url: typeof avatar_url === 'string' ? (avatar_url || null) : (existingProfile?.avatar_url ?? data.avatar_url ?? null),
        banner_url: typeof banner_url === 'string' ? (banner_url || null) : (existingProfile?.banner_url ?? data.banner_url ?? null),
        bio: existingProfile?.bio || '',
        discoverable: existingProfile?.discoverable !== undefined
          ? existingProfile.discoverable
          : profileType === 'personal',
      }

      const { error: profileErr } = await supabase
        .from('user_profiles')
        .upsert(profileRow, { onConflict: 'id' })
      if (profileErr) {
        console.error('Active profile media sync error:', profileErr)
      }
    }

    res.json(data)
  } catch (err) {
    console.error('Profile update error:', err)
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

// Get privacy settings (defaults if none saved)
usersRouter.get('/:id/privacy', async (req, res) => {
  const { id } = req.params
  try {
    const { data, error } = await supabase
      .from('user_privacy_settings')
      .select('*')
      .eq('user_id', id)
      .maybeSingle()
    if (error) {
      if (error.code === '42P01' || /does not exist/i.test(error.message || '')) {
        return res.json({ user_id: id, ...DEFAULT_PRIVACY })
      }
      throw error
    }
    res.json(data ? { ...DEFAULT_PRIVACY, ...data } : { user_id: id, ...DEFAULT_PRIVACY })
  } catch (err) {
    console.error('Privacy fetch error:', err)
    res.status(500).json({ error: 'Failed to fetch privacy settings' })
  }
})

// Upsert privacy settings
usersRouter.put('/:id/privacy', async (req, res) => {
  const { id } = req.params
  const body = req.body || {}
  const updates = { user_id: id, updated_at: new Date().toISOString() }

  for (const [key, allowed] of Object.entries(PRIVACY_ENUMS)) {
    if (body[key] !== undefined) {
      if (!allowed.includes(body[key])) {
        return res.status(400).json({ error: `${key} must be one of: ${allowed.join(', ')}` })
      }
      updates[key] = body[key]
    }
  }
  if (body.allow_voice_activity_indicator !== undefined) {
    updates.allow_voice_activity_indicator = !!body.allow_voice_activity_indicator
  }

  try {
    const { data: existing } = await supabase
      .from('user_privacy_settings')
      .select('*')
      .eq('user_id', id)
      .maybeSingle()

    const row = { ...DEFAULT_PRIVACY, ...(existing || {}), ...updates, user_id: id }
    const { data, error } = await supabase
      .from('user_privacy_settings')
      .upsert(row, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err) {
    console.error('Privacy update error:', err)
    res.status(500).json({ error: 'Failed to save privacy settings' })
  }
})

// Get user profiles (personal, work) — for non-guest accounts
usersRouter.get('/:id/profiles', async (req, res) => {
  const { id } = req.params
  const actorUserId = typeof req.query.actorUserId === 'string' ? req.query.actorUserId : ''
  if (actorUserId !== id) {
    return res.status(403).json({ error: 'Forbidden' })
  }
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

// Upsert user profile (personal or work) — public identity fields only
usersRouter.put('/:id/profiles', async (req, res) => {
  const { id } = req.params
  const { profile_type, display_name, avatar_url, banner_url, bio, discoverable } = req.body

  if (!profile_type || !['personal', 'work'].includes(profile_type)) {
    return res.status(400).json({ error: 'profile_type must be personal or work' })
  }

  try {
    const profileId = `${id}-${profile_type}`
    const row = {
      id: profileId,
      user_id: id,
      profile_type,
      display_name: typeof display_name === 'string' ? display_name.trim() : '',
      avatar_url: avatar_url || null,
      banner_url: banner_url || null,
    }
    if (bio !== undefined) row.bio = typeof bio === 'string' ? bio.slice(0, 190) : ''
    if (discoverable !== undefined) row.discoverable = !!discoverable
    // Sensible defaults for new work vs personal discoverability
    if (discoverable === undefined) {
      row.discoverable = profile_type === 'personal'
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single()

    if (error) throw error

    // Keep users row presentation in sync with the active default profile
    const { data: userRow } = await supabase
      .from('users')
      .select('active_profile')
      .eq('id', id)
      .maybeSingle()
    const active = userRow?.active_profile === 'work' ? 'work' : 'personal'
    if (profile_type === active || (!userRow?.active_profile && profile_type === 'personal')) {
      await supabase.from('users').update({
        display_name: data.display_name || null,
        avatar_url: data.avatar_url,
        banner_url: data.banner_url,
      }).eq('id', id)
    }

    res.json(data)
  } catch (err) {
    console.error('Profile upsert error:', err)
    res.status(500).json({ error: 'Failed to save profile' })
  }
})

// Get account summary for settings (includes active_profile; username only for the owner UI)
usersRouter.get('/:id/account', async (req, res) => {
  const { id } = req.params
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, display_name, avatar_url, banner_url, active_profile, is_guest')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'User not found' })
    res.json(data)
  } catch (err) {
    console.error('Account fetch error:', err)
    res.status(500).json({ error: 'Failed to fetch account' })
  }
})
