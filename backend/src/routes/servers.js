import { Router } from 'express'
import supabase from '../db/supabase.js'

export const serversRouter = Router()

serversRouter.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase.from('servers').select('*')
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch servers' })
  }
})

serversRouter.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('servers')
      .select('*')
      .eq('id', req.params.id)
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Server not found' })
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch server' })
  }
})

serversRouter.get('/:id/channels', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('server_id', req.params.id)
      .order('order')
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch channels' })
  }
})
