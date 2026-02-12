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

    // Create new guest user
    const id = 'u' + Date.now()
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({ id, username, is_guest: true })
      .select()
      .single()

    if (error) throw error
    res.json(newUser)
  } catch (err) {
    console.error('Guest login error:', err)
    res.status(500).json({ error: 'Login failed' })
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

    // Create user linked to Supabase Auth
    const id = 'u' + Date.now()
    const displayName = username || email.split('@')[0]
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({ id, username: displayName, email, auth_id, is_guest: false })
      .select()
      .single()

    if (error) throw error
    res.json(newUser)
  } catch (err) {
    console.error('Auth callback error:', err)
    res.status(500).json({ error: 'Auth callback failed' })
  }
})

// Guest logout — leaves all servers, deletes guest account and all references
authRouter.delete('/guest/:userId', async (req, res) => {
  const { userId } = req.params
  if (!userId) {
    return res.status(400).json({ error: 'userId required' })
  }
  try {
    // Verify user exists and is a guest
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .eq('is_guest', true)
      .single()

    if (userError || !user) {
      return res.status(404).json({ error: 'Guest user not found' })
    }

    // Delete in order to satisfy FK constraints (children before parents)
    const tables = [
      { table: 'dm_messages', column: 'user_id' },
      { table: 'dm_participants', column: 'user_id' },
      { table: 'friend_requests', column: null }, // uses requester_id OR addressee_id
      { table: 'server_invites', column: 'created_by' },
      { table: 'server_audit_log', column: 'user_id' },
      { table: 'message_reactions', column: 'user_id' }, // must be before messages
      { table: 'messages', column: 'user_id' },
      { table: 'server_members', column: 'user_id' },
    ]

    for (const { table, column } of tables) {
      try {
        if (column) {
          const { error } = await supabase.from(table).delete().eq(column, userId)
          if (error) console.warn(`Guest delete: ${table}`, error.message)
        } else if (table === 'friend_requests') {
          const { error: e1 } = await supabase.from(table).delete().eq('requester_id', userId)
          const { error: e2 } = await supabase.from(table).delete().eq('addressee_id', userId)
          if (e1) console.warn(`Guest delete: ${table} requester`, e1.message)
          if (e2) console.warn(`Guest delete: ${table} addressee`, e2.message)
        }
      } catch (e) {
        console.warn(`Guest delete: ${table} (table may not exist)`, e?.message || e)
      }
    }

    // Delete the guest user account (user_presence, user_profiles cascade)
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)
      .eq('is_guest', true)

    if (deleteError) throw deleteError

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
      .select('id, username, avatar_url, is_guest')
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})
