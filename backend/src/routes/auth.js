import { Router } from 'express'
import supabase from '../db/supabase.js'

export const authRouter = Router()

// Guest login — username only, no password (temp account)
authRouter.post('/login', async (req, res) => {
  const { username } = req.body
  if (!username) {
    return res.status(400).json({ error: 'Username required' })
  }
  try {
    // Check if guest user exists
    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('is_guest', true)
      .single()

    if (existing) return res.json(existing)

    // Create new guest user — seed display_name + personal profile so members never show "Unknown"
    const id = 'u' + Date.now()
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({ id, username, display_name: username, is_guest: true })
      .select()
      .single()

    if (error) throw error
    // Best-effort profile seed (members list falls back to username if this fails)
    const { error: profileError } = await supabase.from('user_profiles').upsert(
      {
        id: `p-${id}-personal`,
        user_id: id,
        profile_type: 'personal',
        display_name: username,
        discoverable: true,
      },
      { onConflict: 'user_id,profile_type' }
    )
    if (profileError) console.warn('Guest profile seed failed', profileError.message)
    res.json(newUser)
  } catch (err) {
    console.error('Guest login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

// Sign in with username + password (for registered users; looks up email server-side)
authRouter.post('/signin-username', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' })
  }
  try {
    // Look up non-guest user by username
    const { data: appUser, error: userError } = await supabase
      .from('users')
      .select('id, username, email, auth_id')
      .eq('username', username.trim())
      .eq('is_guest', false)
      .not('auth_id', 'is', null)
      .maybeSingle()

    if (userError || !appUser?.email) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }

    // Sign in via Supabase Auth (email + password)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: appUser.email,
      password,
    })

    if (authError || !authData?.session) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }

    res.json({
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
    })
  } catch (err) {
    console.error('Username sign-in error:', err)
    res.status(500).json({ error: 'Sign-in failed' })
  }
})

// Email login/register — via Supabase Auth token
authRouter.post('/auth/callback', async (req, res) => {
  const { auth_id, email, username } = req.body
  if (!auth_id || !email) {
    return res.status(400).json({ error: 'auth_id and email required' })
  }
  try {
    // Check if user with this auth_id already exists
    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', auth_id)
      .single()

    if (existing) return res.json(existing)

    // Create user linked to Supabase Auth — seed display_name + personal profile
    const id = 'u' + Date.now()
    const displayName = username || email.split('@')[0]
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({ id, username: displayName, display_name: displayName, email, auth_id, is_guest: false })
      .select()
      .single()

    if (error) throw error
    const { error: profileError } = await supabase.from('user_profiles').upsert(
      {
        id: `p-${id}-personal`,
        user_id: id,
        profile_type: 'personal',
        display_name: displayName,
        discoverable: true,
      },
      { onConflict: 'user_id,profile_type' }
    )
    if (profileError) console.warn('Auth profile seed failed', profileError.message)
    res.json(newUser)
  } catch (err) {
    console.error('Auth callback error:', err)
    res.status(500).json({ error: 'Auth callback failed' })
  }
})

/** Cascade-delete a server the account owns (messages → channels → categories → members → server). */
async function deleteOwnedServer(serverId) {
  const { data: channels } = await supabase.from('channels').select('id').eq('server_id', serverId)
  if (channels?.length) {
    const channelIds = channels.map((c) => c.id)
    await supabase.from('messages').delete().in('channel_id', channelIds)
    await supabase.from('channels').delete().eq('server_id', serverId)
  }
  await supabase.from('categories').delete().eq('server_id', serverId)
  await supabase.from('server_members').delete().eq('server_id', serverId)
  // invites / audit / bans / emojis / rules_acceptances cascade from servers where configured
  await supabase.from('server_invites').delete().eq('server_id', serverId)
  await supabase.from('server_audit_log').delete().eq('server_id', serverId)
  await supabase.from('server_emojis').delete().eq('server_id', serverId)
  await supabase.from('server_bans').delete().eq('server_id', serverId)
  await supabase.from('rules_acceptances').delete().eq('server_id', serverId)
  const { error } = await supabase.from('servers').delete().eq('id', serverId)
  if (error) throw error
}

/**
 * Purge all app data for a user, then delete the users row.
 * Handles NO ACTION FKs (owned servers, DMs, messages, invites, etc.).
 * CASCADE tables (presence, profiles, privacy, memberships, …) fall away with the user.
 */
async function purgeUserAccount(userId) {
  // 1. Servers this user owns block users.owner_id (NO ACTION)
  const { data: owned, error: ownedErr } = await supabase
    .from('servers')
    .select('id')
    .eq('owner_id', userId)
  if (ownedErr) console.warn('Account delete: list owned servers', ownedErr.message)
  for (const s of owned || []) {
    try {
      await deleteOwnedServer(s.id)
    } catch (e) {
      console.warn(`Account delete: server ${s.id}`, e?.message || e)
      throw e
    }
  }

  // 2. DMs — remove this user; drop empty conversations
  const { data: parts } = await supabase
    .from('dm_participants')
    .select('conversation_id')
    .eq('user_id', userId)
  const convIds = [...new Set((parts || []).map((p) => p.conversation_id).filter(Boolean))]
  try {
    await supabase.from('dm_messages').delete().eq('user_id', userId)
    await supabase.from('dm_participants').delete().eq('user_id', userId)
    for (const cid of convIds) {
      const { data: remaining } = await supabase
        .from('dm_participants')
        .select('user_id')
        .eq('conversation_id', cid)
        .limit(1)
      if (!remaining?.length) {
        await supabase.from('dm_messages').delete().eq('conversation_id', cid)
        await supabase.from('dm_conversations').delete().eq('id', cid)
      }
    }
  } catch (e) {
    console.warn('Account delete: DMs', e?.message || e)
  }

  // 3. Remaining NO ACTION / explicit cleanup (order matters where FKs nest)
  const simpleDeletes = [
    { table: 'friend_requests', column: 'requester_id' },
    { table: 'friend_requests', column: 'addressee_id' },
    { table: 'server_invites', column: 'created_by' },
    { table: 'server_audit_log', column: 'user_id' },
    { table: 'server_emojis', column: 'uploaded_by' },
    { table: 'message_reactions', column: 'user_id' },
    { table: 'messages', column: 'user_id' },
    { table: 'server_members', column: 'user_id' },
    { table: 'soundboard_sounds', column: 'user_id' },
    { table: 'server_bans', column: 'user_id' },
  ]

  for (const { table, column } of simpleDeletes) {
    try {
      const { error } = await supabase.from(table).delete().eq(column, userId)
      if (error) console.warn(`Account delete: ${table}.${column}`, error.message)
    } catch (e) {
      console.warn(`Account delete: ${table} (may not exist)`, e?.message || e)
    }
  }

  // Null out optional FKs that SET NULL on user delete (best-effort before delete)
  try {
    await supabase.from('bug_reports').update({ user_id: null }).eq('user_id', userId)
  } catch (e) {
    console.warn('Account delete: bug_reports', e?.message || e)
  }
  try {
    await supabase.from('server_bans').update({ banned_by: null }).eq('banned_by', userId)
  } catch (e) {
    console.warn('Account delete: server_bans.banned_by', e?.message || e)
  }

  const { error: deleteError } = await supabase.from('users').delete().eq('id', userId)
  if (deleteError) throw deleteError
}

// Delete any account (registered or guest) — used by User Settings → Delete Account
authRouter.delete('/account/:userId', async (req, res) => {
  const { userId } = req.params
  if (!userId) {
    return res.status(400).json({ error: 'userId required' })
  }
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, auth_id, is_guest')
      .eq('id', userId)
      .maybeSingle()

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    await purgeUserAccount(userId)

    if (user.auth_id) {
      try {
        const { error: authDelErr } = await supabase.auth.admin.deleteUser(user.auth_id)
        if (authDelErr) console.warn('Account delete: auth.admin.deleteUser', authDelErr.message)
      } catch (e) {
        console.warn('Account delete: auth admin', e?.message || e)
      }
    }

    res.json({ success: true, message: 'Account deleted' })
  } catch (err) {
    console.error('Account delete error:', err)
    res.status(500).json({ error: 'Failed to delete account' })
  }
})

// Guest logout — leaves all servers, deletes guest account and all references
authRouter.delete('/guest/:userId', async (req, res) => {
  const { userId } = req.params
  if (!userId) {
    return res.status(400).json({ error: 'userId required' })
  }
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, is_guest')
      .eq('id', userId)
      .eq('is_guest', true)
      .maybeSingle()

    if (userError || !user) {
      return res.status(404).json({ error: 'Guest user not found' })
    }

    await purgeUserAccount(userId)

    res.json({ success: true, message: 'Guest account deleted' })
  } catch (err) {
    console.error('Guest logout error:', err)
    res.status(500).json({ error: 'Failed to delete guest account' })
  }
})

authRouter.get('/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, display_name, avatar_url, is_guest')
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})
