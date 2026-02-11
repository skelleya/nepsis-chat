import { Router } from 'express'
import supabase from '../db/supabase.js'

export const messagesRouter = Router()

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

    // Flatten the joined username into the message object
    const messages = (data || []).map((m) => ({
      ...m,
      username: m.users?.username || 'Unknown',
      users: undefined,
    }))

    res.json(messages.reverse())
  } catch (err) {
    console.error('Fetch messages error:', err)
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

messagesRouter.post('/', async (req, res) => {
  const { channelId, userId, content } = req.body
  if (!channelId || !userId || !content) {
    return res.status(400).json({ error: 'channelId, userId, content required' })
  }

  try {
    const id = 'm' + Date.now() + Math.random().toString(36).slice(2)
    const { error: insertError } = await supabase
      .from('messages')
      .insert({ id, channel_id: channelId, user_id: userId, content })

    if (insertError) throw insertError

    // Fetch with username joined
    const { data: msg, error: fetchError } = await supabase
      .from('messages')
      .select('*, users!messages_user_id_fkey(username)')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    res.status(201).json({
      ...msg,
      username: msg.users?.username || 'Unknown',
      users: undefined,
    })
  } catch (err) {
    console.error('Send message error:', err)
    res.status(500).json({ error: 'Failed to send message' })
  }
})
