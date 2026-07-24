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

function presentUser(user, fallbackId) {
  const displayName = (user?.display_name && user.display_name.trim()) || user?.username || 'Unknown'
  return { id: user?.id || fallbackId, username: displayName, avatar_url: user?.avatar_url || null }
}

async function getConversationForUser(conversationId, viewerId) {
  const { data: conversation, error: conversationError } = await supabase
    .from('dm_conversations')
    .select('id, created_at, is_group, name, created_by, updated_at')
    .eq('id', conversationId)
    .maybeSingle()
  if (conversationError) throw conversationError
  if (!conversation) return null

  const { data: rows, error: participantError } = await supabase
    .from('dm_participants')
    .select('user_id, joined_at')
    .eq('conversation_id', conversationId)
  if (participantError) throw participantError
  if (!rows?.some((row) => row.user_id === viewerId)) return null

  const userIds = rows.map((row) => row.user_id)
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url')
    .in('id', userIds)
  if (usersError) throw usersError
  const userMap = new Map((users || []).map((user) => [user.id, user]))
  const members = rows.map((row) => ({ ...presentUser(userMap.get(row.user_id), row.user_id), joined_at: row.joined_at }))
  const other = members.find((member) => member.id !== viewerId)
  return {
    ...conversation,
    is_group: !!conversation.is_group,
    participants: members,
    other_user: conversation.is_group ? undefined : other,
  }
}

async function areAcceptedFriends(userId, targetIds) {
  if (targetIds.length === 0) return true
  const [{ data: outbound, error: outboundError }, { data: inbound, error: inboundError }] = await Promise.all([
    supabase
      .from('friend_requests')
      .select('addressee_id')
      .eq('requester_id', userId)
      .eq('status', 'accepted')
      .in('addressee_id', targetIds),
    supabase
      .from('friend_requests')
      .select('requester_id')
      .eq('addressee_id', userId)
      .eq('status', 'accepted')
      .in('requester_id', targetIds),
  ])
  if (outboundError) throw outboundError
  if (inboundError) throw inboundError
  const friendIds = new Set([
    ...(outbound || []).map((row) => row.addressee_id),
    ...(inbound || []).map((row) => row.requester_id),
  ])
  return targetIds.every((targetId) => friendIds.has(targetId))
}

// List DM conversations for a user (1:1 and groups)
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
      .select('conversation_id, user_id, joined_at')
      .in('conversation_id', convIds)

    const participantIds = [...new Set((participants || []).map((participant) => participant.user_id))]

    const { data: users } = await supabase
      .from('users')
      .select('id, username, display_name, avatar_url')
      .in('id', participantIds)

    const userMap = new Map((users || []).map((entry) => [entry.id, entry]))
    const participantsByConv = new Map()
    for (const participant of participants || []) {
      const list = participantsByConv.get(participant.conversation_id) || []
      list.push({
        ...presentUser(userMap.get(participant.user_id), participant.user_id),
        joined_at: participant.joined_at,
      })
      participantsByConv.set(participant.conversation_id, list)
    }

    const { data: convs } = await supabase
      .from('dm_conversations')
      .select('id, created_at, is_group, name, created_by, updated_at')
      .in('id', convIds)
      .order('updated_at', { ascending: false })

    const result = (convs || []).map((c) => {
      const members = participantsByConv.get(c.id) || []
      const other = members.find((member) => member.id !== userId)
      return {
        ...c,
        is_group: !!c.is_group,
        participants: members,
        other_user: c.is_group ? undefined : other,
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
    await supabase
      .from('dm_conversations')
      .update({ updated_at: inserted.created_at || new Date().toISOString() })
      .eq('id', conversationId)

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

// Create a group DM. The creator plus at least two other people are required.
dmRouter.post('/conversations/group', async (req, res) => {
  const { userId, memberIds, name } = req.body
  const requested = [...new Set((Array.isArray(memberIds) ? memberIds : []).filter((id) => typeof id === 'string' && id && id !== userId))]
  if (!userId || requested.length < 2) {
    return res.status(400).json({ error: 'Choose at least two people for a group message' })
  }
  if (requested.length > 9) {
    return res.status(400).json({ error: 'Group messages support up to 10 people' })
  }

  const cleanName = typeof name === 'string' ? name.trim().slice(0, 80) : ''
  const id = `dm_${randomUUID()}`
  try {
    const allIds = [userId, ...requested]
    const { data: validUsers, error: usersError } = await supabase
      .from('users')
      .select('id')
      .in('id', allIds)
    if (usersError) throw usersError
    if ((validUsers || []).length !== allIds.length) {
      return res.status(400).json({ error: 'One or more selected users no longer exist' })
    }
    if (!(await areAcceptedFriends(userId, requested))) {
      return res.status(403).json({ error: 'Only accepted friends can be added to group messages' })
    }

    const { error: conversationError } = await supabase.from('dm_conversations').insert({
      id,
      is_group: true,
      name: cleanName || null,
      created_by: userId,
      updated_at: new Date().toISOString(),
    })
    if (conversationError) throw conversationError

    const { error: participantError } = await supabase.from('dm_participants').insert(
      allIds.map((memberId) => ({ conversation_id: id, user_id: memberId }))
    )
    if (participantError) {
      await supabase.from('dm_conversations').delete().eq('id', id)
      throw participantError
    }

    const conversation = await getConversationForUser(id, userId)
    return res.status(201).json(conversation)
  } catch (err) {
    console.error('Group DM create error:', err)
    return res.status(500).json({ error: 'Failed to create group message' })
  }
})

// Add people to an existing group DM. Any current participant may invite friends.
dmRouter.post('/conversations/:id/members', async (req, res) => {
  const { id } = req.params
  const { userId, memberIds } = req.body
  const requested = [...new Set((Array.isArray(memberIds) ? memberIds : []).filter((entry) => typeof entry === 'string' && entry && entry !== userId))]
  if (!userId || requested.length === 0) {
    return res.status(400).json({ error: 'userId and memberIds required' })
  }

  try {
    const conversation = await getConversationForUser(id, userId)
    if (!conversation) return res.status(403).json({ error: 'Not a participant' })
    if (!conversation.is_group) return res.status(400).json({ error: 'Add people is only available in group messages' })

    const existing = new Set(conversation.participants.map((participant) => participant.id))
    const additions = requested.filter((memberId) => !existing.has(memberId))
    if (existing.size + additions.length > 10) {
      return res.status(400).json({ error: 'Group messages support up to 10 people' })
    }
    if (additions.length === 0) return res.json(conversation)

    const { data: validUsers, error: usersError } = await supabase
      .from('users')
      .select('id')
      .in('id', additions)
    if (usersError) throw usersError
    if ((validUsers || []).length !== additions.length) {
      return res.status(400).json({ error: 'One or more selected users no longer exist' })
    }
    if (!(await areAcceptedFriends(userId, additions))) {
      return res.status(403).json({ error: 'Only accepted friends can be added to group messages' })
    }

    const { error } = await supabase.from('dm_participants').insert(
      additions.map((memberId) => ({ conversation_id: id, user_id: memberId }))
    )
    if (error) throw error
    await supabase.from('dm_conversations').update({ updated_at: new Date().toISOString() }).eq('id', id)
    return res.json(await getConversationForUser(id, userId))
  } catch (err) {
    console.error('Group DM add members error:', err)
    return res.status(500).json({ error: 'Failed to add people to group message' })
  }
})

// Rename an existing group DM.
dmRouter.patch('/conversations/:id', async (req, res) => {
  const { id } = req.params
  const { userId, name } = req.body
  const cleanName = typeof name === 'string' ? name.trim().slice(0, 80) : ''
  if (!userId || !cleanName) return res.status(400).json({ error: 'userId and name required' })
  try {
    const conversation = await getConversationForUser(id, userId)
    if (!conversation) return res.status(403).json({ error: 'Not a participant' })
    if (!conversation.is_group) return res.status(400).json({ error: 'Only group messages can be renamed' })
    const { error } = await supabase
      .from('dm_conversations')
      .update({ name: cleanName, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    return res.json(await getConversationForUser(id, userId))
  } catch (err) {
    console.error('Group DM rename error:', err)
    return res.status(500).json({ error: 'Failed to rename group message' })
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
        if (userIds.length === 2 && userIds.includes(userId) && userIds.includes(targetUserId)) {
          return res.json(await getConversationForUser(convId, userId))
        }
      }
    }

    // Create new conversation
    const id = `dm_${randomUUID()}`
    await supabase.from('dm_conversations').insert({
      id,
      is_group: false,
      created_by: userId,
      updated_at: new Date().toISOString(),
    })
    await supabase.from('dm_participants').insert([
      { conversation_id: id, user_id: userId },
      { conversation_id: id, user_id: targetUserId },
    ])
    return res.json(await getConversationForUser(id, userId))
  } catch (err) {
    console.error('DM create error:', err)
    if (isTableMissingError(err)) {
      return res.status(501).json({ error: DM_NOT_CONFIGURED })
    }
    return res.status(500).json({ error: 'Failed to create DM' })
  }
})
