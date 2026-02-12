import { Router } from 'express'
import supabase from '../db/supabase.js'

export const messagesRouter = Router()

function formatMessage(m) {
  return {
    ...m,
    username: m.users?.username || 'Unknown',
    users: undefined,
  }
}

messagesRouter.get('/channel/:channelId', async (req, res) => {
  const { channelId } = req.params
  const limit = Math.min(parseInt(req.query.limit) || 50, 100)
  const before = req.query.before

  try {
    let query = supabase
      .from('messages')
      .select('*, users!messages_user_id_fkey(username)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (before) {
      query = query.lt('created_at', before)
    }

    const { data, error } = await query
    if (error) throw error

    const messages = (data || []).map(formatMessage)
    const msgIds = messages.map((m) => m.id)
    const replyToIds = [...new Set(messages.filter((m) => m.reply_to_id).map((m) => m.reply_to_id))]

    // Fetch reply-to messages
    let replyToMap = {}
    if (replyToIds.length > 0) {
      const { data: replyMsgs } = await supabase
        .from('messages')
        .select('id, content, user_id, users!messages_user_id_fkey(username)')
        .in('id', replyToIds)
      ;(replyMsgs || []).forEach((m) => {
        replyToMap[m.id] = { username: m.users?.username || 'Unknown', content: (m.content || '').slice(0, 100) }
      })
    }

    // Fetch reactions for these messages
    const { data: reactions } = await supabase
      .from('message_reactions')
      .select('message_id, user_id, emoji')
      .in('message_id', msgIds.length ? msgIds : ['__none__'])

    const reactionsByMsg = {}
    ;(reactions || []).forEach((r) => {
      if (!reactionsByMsg[r.message_id]) reactionsByMsg[r.message_id] = []
      reactionsByMsg[r.message_id].push({ user_id: r.user_id, emoji: r.emoji })
    })

    const result = messages.reverse().map((m) => ({
      ...m,
      reply_to: m.reply_to_id ? replyToMap[m.reply_to_id] : undefined,
      reactions: reactionsByMsg[m.id] || [],
    }))

    res.json(result)
  } catch (err) {
    console.error('Fetch messages error:', err)
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

// Get single message (for realtime sync) — must be after /channel/:channelId
messagesRouter.get('/single/:id', async (req, res) => {
  const { id } = req.params
  try {
    const { data: m, error } = await supabase
      .from('messages')
      .select('*, users!messages_user_id_fkey(username)')
      .eq('id', id)
      .single()
    if (error || !m) return res.status(404).json({ error: 'Message not found' })

    let replyTo = null
    if (m.reply_to_id) {
      const { data: parent } = await supabase
        .from('messages')
        .select('id, content, user_id, users!messages_user_id_fkey(username)')
        .eq('id', m.reply_to_id)
        .single()
      if (parent) replyTo = { username: parent.users?.username || 'Unknown', content: (parent.content || '').slice(0, 100) }
    }

    const { data: reactions } = await supabase
      .from('message_reactions')
      .select('message_id, user_id, emoji')
      .eq('message_id', id)

    res.json({
      ...formatMessage(m),
      reply_to: replyTo,
      reactions: reactions || [],
    })
  } catch (err) {
    console.error('Get message error:', err)
    res.status(500).json({ error: 'Failed to fetch message' })
  }
})

messagesRouter.post('/', async (req, res) => {
  const { channelId, userId, content, replyToId, attachments } = req.body
  if (!channelId || !userId || !content) {
    return res.status(400).json({ error: 'channelId, userId, content required' })
  }

  try {
    // Rules channel: only owner/admin can create messages (no chat from regular members)
    const { data: ch } = await supabase.from('channels').select('server_id, type').eq('id', channelId).single()
    if (ch?.type === 'rules') {
      const { data: member } = await supabase
        .from('server_members')
        .select('role')
        .eq('server_id', ch.server_id)
        .eq('user_id', userId)
        .single()
      if (!member || !['owner', 'admin'].includes(member.role)) {
        return res.status(403).json({ error: 'Rules channel is read-only. Only owner or admin can set up rules.' })
      }
    }
    const id = 'm' + Date.now() + Math.random().toString(36).slice(2)
    const insert = {
      id,
      channel_id: channelId,
      user_id: userId,
      content: String(content).trim(),
      attachments: Array.isArray(attachments) ? attachments : [],
    }
    if (replyToId) insert.reply_to_id = replyToId

    const { error: insertError } = await supabase.from('messages').insert(insert)
    if (insertError) throw insertError

    const { data: msg, error: fetchError } = await supabase
      .from('messages')
      .select('*, users!messages_user_id_fkey(username)')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    let replyTo = null
    if (msg.reply_to_id) {
      const { data: parent } = await supabase
        .from('messages')
        .select('id, content, users!messages_user_id_fkey(username)')
        .eq('id', msg.reply_to_id)
        .single()
      if (parent) replyTo = { username: parent.users?.username || 'Unknown', content: (parent.content || '').slice(0, 100) }
    }
    const { data: reactions } = await supabase.from('message_reactions').select('message_id, user_id, emoji').eq('message_id', id)

    res.status(201).json({
      ...formatMessage(msg),
      reply_to: replyTo,
      reactions: reactions || [],
    })
  } catch (err) {
    console.error('Send message error:', err)
    res.status(500).json({ error: 'Failed to send message' })
  }
})

messagesRouter.patch('/:id', async (req, res) => {
  const { id } = req.params
  const { userId, content } = req.body
  if (!userId || !content) {
    return res.status(400).json({ error: 'userId and content required' })
  }

  try {
    const { data: msg, error: fetchError } = await supabase
      .from('messages')
      .select('user_id')
      .eq('id', id)
      .single()

    if (fetchError || !msg) return res.status(404).json({ error: 'Message not found' })
    if (msg.user_id !== userId) return res.status(403).json({ error: 'Can only edit your own messages' })

    const { data: updated, error } = await supabase
      .from('messages')
      .update({ content: String(content).trim(), edited_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, users!messages_user_id_fkey(username)')
      .single()

    if (error) throw error
    res.json(formatMessage(updated))
  } catch (err) {
    console.error('Edit message error:', err)
    res.status(500).json({ error: 'Failed to edit message' })
  }
})

messagesRouter.delete('/:id', async (req, res) => {
  const { id } = req.params
  const userId = req.query.userId

  try {
    const { data: msg, error: fetchError } = await supabase
      .from('messages')
      .select('user_id, channel_id')
      .eq('id', id)
      .single()

    if (fetchError || !msg) return res.status(404).json({ error: 'Message not found' })

    const { data: ch } = await supabase.from('channels').select('server_id').eq('id', msg.channel_id).single()
    const serverIdFromChannel = ch?.server_id
    const isOwner = msg.user_id === userId

    if (!isOwner) {
      // Check if user is admin/owner of server
      if (!serverIdFromChannel || !userId) return res.status(403).json({ error: 'Forbidden' })
      const { data: member } = await supabase
        .from('server_members')
        .select('role')
        .eq('server_id', serverIdFromChannel)
        .eq('user_id', userId)
        .single()
      const canDelete = member && ['owner', 'admin'].includes(member.role)
      if (!canDelete) return res.status(403).json({ error: 'Only message author or server admin can delete' })
    }

    const { error: deleteError } = await supabase.from('messages').delete().eq('id', id)
    if (deleteError) throw deleteError
    res.json({ success: true })
  } catch (err) {
    console.error('Delete message error:', err)
    res.status(500).json({ error: 'Failed to delete message' })
  }
})

// Add/remove reaction
messagesRouter.post('/:id/reactions', async (req, res) => {
  const { id } = req.params
  const { userId, emoji } = req.body
  if (!userId || !emoji) return res.status(400).json({ error: 'userId and emoji required' })

  try {
    const { error } = await supabase
      .from('message_reactions')
      .upsert({ message_id: id, user_id: userId, emoji: String(emoji).slice(0, 32) }, { onConflict: 'message_id,user_id,emoji' })

    if (error) throw error

    // If this is a rules channel and emoji matches server's accept emoji, record rules acceptance
    const { data: msg } = await supabase.from('messages').select('channel_id').eq('id', id).single()
    if (msg?.channel_id) {
      const { data: ch } = await supabase.from('channels').select('server_id, type').eq('id', msg.channel_id).single()
      if (ch?.type === 'rules') {
        const { data: srv } = await supabase.from('servers').select('rules_channel_id, rules_accept_emoji').eq('id', ch.server_id).single()
        const acceptEmoji = (srv?.rules_accept_emoji || '👍').trim()
        if (srv?.rules_channel_id === msg.channel_id && String(emoji).trim() === acceptEmoji) {
          await supabase.from('rules_acceptances').upsert(
            { server_id: ch.server_id, user_id: userId, accepted_at: new Date().toISOString() },
            { onConflict: 'server_id,user_id' }
          )
        }
      }
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Add reaction error:', err)
    res.status(500).json({ error: 'Failed to add reaction' })
  }
})

messagesRouter.delete('/:id/reactions', async (req, res) => {
  const { id } = req.params
  const { userId, emoji } = req.query
  if (!userId || !emoji) return res.status(400).json({ error: 'userId and emoji required' })

  try {
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', id)
      .eq('user_id', userId)
      .eq('emoji', emoji)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    console.error('Remove reaction error:', err)
    res.status(500).json({ error: 'Failed to remove reaction' })
  }
})
