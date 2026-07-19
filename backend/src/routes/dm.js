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
      .select('id, username, display_name, avatar_url')
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
      const other = userMap[otherId] || { id: otherId, username: 'Unknown', display_name: null, avatar_url: null }
      const displayName = (other.display_name && other.display_name.trim()) || other.username
      return {
        id: c.id,
        created_at: c.created_at,
        other_user: { id: other.id, username: displayName, avatar_url: other.avatar_url },
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
      .select('id, conversation_id, user_id, content, created_at, reply_to_id')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    if (error) throw error

    const msgIds = (data || []).map((m) => m.id)
    const { data: reactions } = msgIds.length
      ? await supabase.from('dm_message_reactions').select('message_id, user_id, emoji').in('message_id', msgIds)
      : { data: [] }
    const reactionsByMsg = {}
    for (const r of reactions || []) {
      if (!reactionsByMsg[r.message_id]) reactionsByMsg[r.message_id] = []
      reactionsByMsg[r.message_id].push({ user_id: r.user_id, emoji: r.emoji })
    }

    const userIds = [...new Set((data || []).map((m) => m.user_id))]
    const { data: users } = userIds.length
      ? await supabase.from('users').select('id, username, display_name').in('id', userIds)
      : { data: [] }
    const userMap = {}
    for (const u of users || []) {
      userMap[u.id] = (u.display_name && u.display_name.trim()) || u.username
    }

    const byId = {}
    for (const m of data || []) byId[m.id] = m

    const result = (data || []).map((m) => {
      const parent = m.reply_to_id ? byId[m.reply_to_id] : null
      return {
        id: m.id,
        conversation_id: m.conversation_id,
        user_id: m.user_id,
        content: m.content,
        created_at: m.created_at,
        username: userMap[m.user_id] || 'Unknown',
        reply_to_id: m.reply_to_id || null,
        reply_to: parent
          ? {
              id: parent.id,
              content: parent.content,
              username: userMap[parent.user_id] || 'Unknown',
            }
          : null,
        reactions: reactionsByMsg[m.id] || [],
      }
    })

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
      .select('id, conversation_id, user_id, content, created_at, reply_to_id')
      .eq('id', id)
      .single()

    if (error || !m) return res.status(404).json({ error: 'Not found' })

    const { data: u } = await supabase.from('users').select('username, display_name').eq('id', m.user_id).single()
    const { data: reactions } = await supabase
      .from('dm_message_reactions')
      .select('user_id, emoji')
      .eq('message_id', id)

    let reply_to = null
    if (m.reply_to_id) {
      const { data: parent } = await supabase
        .from('dm_messages')
        .select('id, content, user_id')
        .eq('id', m.reply_to_id)
        .maybeSingle()
      if (parent) {
        const { data: pu } = await supabase.from('users').select('username, display_name').eq('id', parent.user_id).single()
        reply_to = {
          id: parent.id,
          content: parent.content,
          username: (pu?.display_name && pu.display_name.trim()) || pu?.username || 'Unknown',
        }
      }
    }

    res.json({
      id: m.id,
      conversation_id: m.conversation_id,
      user_id: m.user_id,
      content: m.content,
      created_at: m.created_at,
      username: (u?.display_name && u.display_name.trim()) || u?.username || 'Unknown',
      reply_to_id: m.reply_to_id || null,
      reply_to,
      reactions: (reactions || []).map((r) => ({ user_id: r.user_id, emoji: r.emoji })),
    })
  } catch (err) {
    console.error('DM get message error:', err)
    res.status(500).json({ error: 'Failed to fetch message' })
  }
})

// Send a DM message
dmRouter.post('/messages', async (req, res) => {
  const { conversationId, userId, content, replyToId } = req.body
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
    const row = {
      id,
      conversation_id: conversationId,
      user_id: userId,
      content: content.trim(),
    }
    if (replyToId) row.reply_to_id = replyToId

    const { data: inserted, error } = await supabase
      .from('dm_messages')
      .insert(row)
      .select('id, conversation_id, user_id, content, created_at, reply_to_id')
      .single()

    if (error) throw error

    const { data: u } = await supabase.from('users').select('username, display_name').eq('id', userId).single()

    let reply_to = null
    if (inserted.reply_to_id) {
      const { data: parent } = await supabase
        .from('dm_messages')
        .select('id, content, user_id')
        .eq('id', inserted.reply_to_id)
        .maybeSingle()
      if (parent) {
        const { data: pu } = await supabase.from('users').select('username, display_name').eq('id', parent.user_id).single()
        reply_to = {
          id: parent.id,
          content: parent.content,
          username: (pu?.display_name && pu.display_name.trim()) || pu?.username || 'Unknown',
        }
      }
    }

    res.json({
      id: inserted.id,
      conversation_id: inserted.conversation_id,
      user_id: inserted.user_id,
      content: inserted.content,
      created_at: inserted.created_at,
      username: (u?.display_name && u.display_name.trim()) || u?.username || 'Unknown',
      reply_to_id: inserted.reply_to_id || null,
      reply_to,
      reactions: [],
    })
  } catch (err) {
    console.error('DM send error:', err)
    if (isTableMissingError(err)) {
      return res.status(501).json({ error: DM_NOT_CONFIGURED })
    }
    res.status(500).json({ error: 'Failed to send DM' })
  }
})

// Add DM reaction
dmRouter.post('/messages/:id/reactions', async (req, res) => {
  const { id } = req.params
  const { userId, emoji } = req.body
  if (!userId || !emoji) return res.status(400).json({ error: 'userId and emoji required' })

  try {
    const { data: msg } = await supabase.from('dm_messages').select('id, conversation_id').eq('id', id).maybeSingle()
    if (!msg) return res.status(404).json({ error: 'Message not found' })

    const { data: participants } = await supabase
      .from('dm_participants')
      .select('user_id')
      .eq('conversation_id', msg.conversation_id)
    if (!participants?.some((p) => p.user_id === userId)) {
      return res.status(403).json({ error: 'Not a participant' })
    }

    const { error } = await supabase
      .from('dm_message_reactions')
      .upsert(
        { message_id: id, user_id: userId, emoji: String(emoji).slice(0, 32) },
        { onConflict: 'message_id,user_id,emoji' }
      )
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    console.error('DM add reaction error:', err)
    res.status(500).json({ error: 'Failed to add reaction' })
  }
})

// Remove DM reaction
dmRouter.delete('/messages/:id/reactions', async (req, res) => {
  const { id } = req.params
  const { userId, emoji } = req.query
  if (!userId || !emoji) return res.status(400).json({ error: 'userId and emoji required' })

  try {
    const { error } = await supabase
      .from('dm_message_reactions')
      .delete()
      .eq('message_id', id)
      .eq('user_id', userId)
      .eq('emoji', emoji)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    console.error('DM remove reaction error:', err)
    res.status(500).json({ error: 'Failed to remove reaction' })
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
          const { data: other } = await supabase.from('users').select('id, username, display_name, avatar_url').eq('id', targetUserId).single()
          const dn = other ? ((other.display_name && other.display_name.trim()) || other.username) : 'Unknown'
          return res.json({
            id: convId,
            created_at: new Date().toISOString(),
            other_user: other ? { id: other.id, username: dn, avatar_url: other.avatar_url } : { id: targetUserId, username: 'Unknown', avatar_url: null },
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
    const { data: other } = await supabase.from('users').select('id, username, display_name, avatar_url').eq('id', targetUserId).single()
    const dn = other ? ((other.display_name && other.display_name.trim()) || other.username) : 'Unknown'
    return res.json({
      id,
      created_at: new Date().toISOString(),
      other_user: other ? { id: other.id, username: dn, avatar_url: other.avatar_url } : { id: targetUserId, username: 'Unknown', avatar_url: null },
    })
  } catch (err) {
    console.error('DM create error:', err)
    if (isTableMissingError(err)) {
      return res.status(501).json({ error: DM_NOT_CONFIGURED })
    }
    return res.status(500).json({ error: 'Failed to create DM' })
  }
})
