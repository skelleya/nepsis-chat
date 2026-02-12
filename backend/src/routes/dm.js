import { Router } from 'express'
import { randomUUID } from 'crypto'
import supabase from '../db/supabase.js'

export const dmRouter = Router()

const DM_NOT_CONFIGURED = 'DM feature not yet configured. Run the DM tables migration (see supabase/run-all-pending-migrations.sql).'

function isTableMissingError(err) {
  if (!err) return false
  const code = err.code || err?.error?.code
  const msg = (err.message || err?.error?.message || '').toLowerCase()
  return code === '42P01' || /relation.*does not exist/.test(msg) || /dm_(conversations|participants|messages).*does not exist/.test(msg)
}

// List DM conversations for a user (with other participant info)
dmRouter.get('/conversations', async (req, res) => {
  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'userId required' })

  try {
    const { data: myConvs } = await supabase
      .from('dm_participants')
      .select('conversation_id')
      .eq('user_id', userId)

    if (!myConvs?.length) return res.json([])

    const convIds = myConvs.map((c) => c.conversation_id)

    const { data: participants } = await supabase
      .from('dm_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', convIds)

    const otherByConv = {}
    for (const p of participants || []) {
      if (p.user_id !== userId) {
        otherByConv[p.conversation_id] = p.user_id
      }
    }

    const otherIds = [...new Set(Object.values(otherByConv))]
    if (otherIds.length === 0) return res.json([])

    const { data: users } = await supabase
      .from('users')
      .select('id, username, avatar_url')
      .in('id', otherIds)

    const userMap = {}
    for (const u of users || []) userMap[u.id] = u

    const { data: convs } = await supabase
      .from('dm_conversations')
      .select('id, created_at')
      .in('id', convIds)
      .order('created_at', { ascending: false })

    const result = (convs || []).map((c) => {
      const otherId = otherByConv[c.id]
      const other = userMap[otherId] || { id: otherId, username: 'Unknown', avatar_url: null }
      return {
        id: c.id,
        created_at: c.created_at,
        other_user: { id: other.id, username: other.username, avatar_url: other.avatar_url },
      }
    })

    res.json(result)
  } catch (err) {
    console.error('DM list error:', err)
    if (isTableMissingError(err)) {
      return res.status(501).json({ error: DM_NOT_CONFIGURED })
    }
    res.status(500).json({ error: 'Failed to list DMs' })
  }
})

// Get messages for a DM conversation
dmRouter.get('/conversations/:id/messages', async (req, res) => {
  const { id } = req.params
  const userId = req.query.userId
  if (!userId) return res.status(400).json({ error: 'userId required' })

  try {
    const { data: participants } = await supabase
      .from('dm_participants')
      .select('user_id')
      .eq('conversation_id', id)

    const isMember = participants?.some((p) => p.user_id === userId)
    if (!isMember) return res.status(403).json({ error: 'Not a participant' })

    const { data, error } = await supabase
      .from('dm_messages')
      .select('id, conversation_id, user_id, content, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    if (error) throw error

    const userIds = [...new Set((data || []).map((m) => m.user_id))]
    const { data: users } = userIds.length
      ? await supabase.from('users').select('id, username').in('id', userIds)
      : { data: [] }
    const userMap = {}
    for (const u of users || []) userMap[u.id] = u.username

    const result = (data || []).map((m) => ({
      id: m.id,
      conversation_id: m.conversation_id,
      user_id: m.user_id,
      content: m.content,
      created_at: m.created_at,
      username: userMap[m.user_id] || 'Unknown',
    }))

    res.json(result)
  } catch (err) {
    console.error('DM messages error:', err)
    if (isTableMissingError(err)) {
      return res.status(501).json({ error: DM_NOT_CONFIGURED })
    }
    res.status(500).json({ error: 'Failed to fetch DM messages' })
  }
})

// Get single DM message (for realtime sync)
dmRouter.get('/messages/:id', async (req, res) => {
  const { id } = req.params
  try {
    const { data: m, error } = await supabase
      .from('dm_messages')
      .select('id, conversation_id, user_id, content, created_at')
      .eq('id', id)
      .single()

    if (error || !m) return res.status(404).json({ error: 'Not found' })

    const { data: u } = await supabase.from('users').select('username').eq('id', m.user_id).single()

    res.json({
      id: m.id,
      conversation_id: m.conversation_id,
      user_id: m.user_id,
      content: m.content,
      created_at: m.created_at,
      username: u?.username || 'Unknown',
    })
  } catch (err) {
    console.error('DM get message error:', err)
    res.status(500).json({ error: 'Failed to fetch message' })
  }
})

// Send a DM message
dmRouter.post('/messages', async (req, res) => {
  const { conversationId, userId, content } = req.body
  if (!conversationId || !userId || !content?.trim()) {
    return res.status(400).json({ error: 'conversationId, userId, and content required' })
  }

  try {
    const { data: participants } = await supabase
      .from('dm_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)

    const isMember = participants?.some((p) => p.user_id === userId)
    if (!isMember) return res.status(403).json({ error: 'Not a participant' })

    const id = `dmmsg_${randomUUID()}`
    const { data: inserted, error } = await supabase
      .from('dm_messages')
      .insert({ id, conversation_id: conversationId, user_id: userId, content: content.trim() })
      .select('id, conversation_id, user_id, content, created_at')
      .single()

    if (error) throw error

    const { data: u } = await supabase.from('users').select('username').eq('id', userId).single()

    res.json({
      id: inserted.id,
      conversation_id: inserted.conversation_id,
      user_id: inserted.user_id,
      content: inserted.content,
      created_at: inserted.created_at,
      username: u?.username || 'Unknown',
    })
  } catch (err) {
    console.error('DM send error:', err)
    if (isTableMissingError(err)) {
      return res.status(501).json({ error: DM_NOT_CONFIGURED })
    }
    res.status(500).json({ error: 'Failed to send DM' })
  }
})

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
          const { data: other } = await supabase.from('users').select('id, username, avatar_url').eq('id', targetUserId).single()
          return res.json({
            id: convId,
            created_at: new Date().toISOString(),
            other_user: other || { id: targetUserId, username: 'Unknown', avatar_url: null },
          })
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
    const { data: other } = await supabase.from('users').select('id, username, avatar_url').eq('id', targetUserId).single()
    return res.json({
      id,
      created_at: new Date().toISOString(),
      other_user: other || { id: targetUserId, username: 'Unknown', avatar_url: null },
    })
  } catch (err) {
    console.error('DM create error:', err)
    if (isTableMissingError(err)) {
      return res.status(501).json({ error: DM_NOT_CONFIGURED })
    }
    return res.status(500).json({ error: 'Failed to create DM' })
  }
})
