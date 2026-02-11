import { Router } from 'express'
import supabase from '../db/supabase.js'

export const friendsRouter = Router()

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
