import { Router } from 'express'
import { randomUUID } from 'crypto'
import supabase from '../db/supabase.js'

export const dmRouter = Router()

// Create or get DM conversation between two users
dmRouter.post('/conversations', async (req, res) => {
  const { userId, targetUserId } = req.body
  if (!userId || !targetUserId) {
    return res.status(400).json({ error: 'userId and targetUserId required' })
  }
  if (userId === targetUserId) {
    return res.status(400).json({ error: 'Cannot DM yourself' })
  }

  try {
    // Check for existing conversation
    const { data: participants } = await supabase
      .from('dm_participants')
      .select('conversation_id')
      .in('user_id', [userId, targetUserId])

    if (participants?.length) {
      const convIds = [...new Set(participants.map((p) => p.conversation_id))]
      for (const convId of convIds) {
        const { data: conv } = await supabase
          .from('dm_participants')
          .select('user_id')
          .eq('conversation_id', convId)
        const userIds = conv?.map((c) => c.user_id) ?? []
        if (userIds.includes(userId) && userIds.includes(targetUserId)) {
          return res.json({ id: convId })
        }
      }
    }

    // Create new conversation
    const id = `dm_${randomUUID()}`
    await supabase.from('dm_conversations').insert({ id })
    await supabase.from('dm_participants').insert([
      { conversation_id: id, user_id: userId },
      { conversation_id: id, user_id: targetUserId },
    ])
    return res.json({ id })
  } catch (err) {
    console.error('DM create error:', err)
    return res.status(500).json({ error: 'Failed to create DM' })
  }
})
