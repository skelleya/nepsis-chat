import { Router } from 'express'
import supabase from '../db/supabase.js'

export const friendsRouter = Router()

// List friends (status = accepted)
friendsRouter.get('/list', async (req, res) => {
  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'userId required' })

  try {
    const { data: rows, error } = await supabase
      .from('friend_requests')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

    if (error) {
      if (error.code === '42P01') {
        return res.status(501).json({ error: 'Friends feature not yet configured. Run the friends migration.' })
      }
      throw error
    }
    if (!rows?.length) return res.json([])

    const friendIds = rows.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id))
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id, username, avatar_url')
      .in('id', friendIds)

    if (usersErr) throw usersErr
    return res.json(users || [])
  } catch (err) {
    console.error('Friends list error:', err)
    return res.status(500).json({ error: 'Failed to fetch friends' })
  }
})

// List pending friend requests (incoming)
friendsRouter.get('/requests', async (req, res) => {
  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'userId required' })

  try {
    const { data: rows, error } = await supabase
      .from('friend_requests')
      .select('requester_id, created_at')
      .eq('addressee_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      if (error.code === '42P01') {
        return res.status(501).json({ error: 'Friends feature not yet configured. Run the friends migration.' })
      }
      throw error
    }
    if (!rows?.length) return res.json([])

    const requesterIds = rows.map((r) => r.requester_id)
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id, username, avatar_url')
      .in('id', requesterIds)

    if (usersErr) throw usersErr
    const userMap = {}
    for (const u of users || []) userMap[u.id] = u
    return res.json(
      rows.map((r) => ({
        requester_id: r.requester_id,
        created_at: r.created_at,
        user: userMap[r.requester_id] || { id: r.requester_id, username: 'Unknown', avatar_url: null },
      }))
    )
  } catch (err) {
    console.error('Friend requests error:', err)
    return res.status(500).json({ error: 'Failed to fetch friend requests' })
  }
})

// Accept friend request
friendsRouter.post('/accept', async (req, res) => {
  const { userId, requesterId } = req.body
  if (!userId || !requesterId) {
    return res.status(400).json({ error: 'userId and requesterId required' })
  }

  try {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('requester_id', requesterId)
      .eq('addressee_id', userId)
      .eq('status', 'pending')

    if (error) {
      if (error.code === '42P01') {
        return res.status(501).json({ error: 'Friends feature not yet configured. Run the friends migration.' })
      }
      throw error
    }
    return res.json({ success: true })
  } catch (err) {
    console.error('Accept friend error:', err)
    return res.status(500).json({ error: 'Failed to accept friend request' })
  }
})

// Decline friend request
friendsRouter.post('/decline', async (req, res) => {
  const { userId, requesterId } = req.body
  if (!userId || !requesterId) {
    return res.status(400).json({ error: 'userId and requesterId required' })
  }

  try {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('requester_id', requesterId)
      .eq('addressee_id', userId)
      .eq('status', 'pending')

    if (error) {
      if (error.code === '42P01') {
        return res.status(501).json({ error: 'Friends feature not yet configured. Run the friends migration.' })
      }
      throw error
    }
    return res.json({ success: true })
  } catch (err) {
    console.error('Decline friend error:', err)
    return res.status(500).json({ error: 'Failed to decline friend request' })
  }
})

// Send friend request (creates pending request)
friendsRouter.post('/request', async (req, res) => {
  const { userId, targetUserId } = req.body
  if (!userId || !targetUserId) {
    return res.status(400).json({ error: 'userId and targetUserId required' })
  }
  if (userId === targetUserId) {
    return res.status(400).json({ error: 'Cannot add yourself as friend' })
  }

  try {
    const { error } = await supabase.from('friend_requests').insert({
      requester_id: userId,
      addressee_id: targetUserId,
      status: 'pending',
    })

    if (error) {
      if (error.code === '42P01') {
        return res.status(501).json({ error: 'Friends feature not yet configured. Run the friends migration.' })
      }
      if (error.code === '23505') {
        return res.json({ success: true }) // Already sent
      }
      throw error
    }
    return res.json({ success: true })
  } catch (err) {
    console.error('Friend request error:', err)
    return res.status(500).json({ error: 'Failed to send friend request' })
  }
})
