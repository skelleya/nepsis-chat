import { Router } from 'express'
import crypto from 'crypto'
import supabase from '../db/supabase.js'

export const gifsRouter = Router()

const BUCKET = 'attachments'
const MAX_BYTES = Number(process.env.GIF_IMPORT_MAX_BYTES) || 8 * 1024 * 1024

gifsRouter.get('/search', async (req, res) => {
  const apiKey = process.env.TENOR_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'GIF search is not configured. Set TENOR_API_KEY.' })
  }
  const query = String(req.query.q || '').trim().slice(0, 80)
  if (!query) return res.json([])
  const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 24))

  try {
    const url = new URL('https://tenor.googleapis.com/v2/search')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('client_key', 'nepsis_chat')
    url.searchParams.set('q', query)
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('contentfilter', 'medium')
    url.searchParams.set('media_filter', 'gif,tinygif')
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw new Error(`Tenor returned ${response.status}`)
    const payload = await response.json()
    return res.json((payload.results || []).map((item) => ({
      id: item.id,
      title: item.content_description || query,
      previewUrl: item.media_formats?.tinygif?.url || item.media_formats?.gif?.url,
      url: item.media_formats?.gif?.url || item.media_formats?.tinygif?.url,
    })).filter((item) => item.url && item.previewUrl))
  } catch (err) {
    console.error('GIF search error:', err)
    return res.status(502).json({ error: 'GIF search is temporarily unavailable' })
  }
})

gifsRouter.post('/import', async (req, res) => {
  const source = String(req.body?.url || '')
  let url
  try {
    url = new URL(source)
  } catch {
    return res.status(400).json({ error: 'Invalid GIF URL' })
  }
  if (url.protocol !== 'https:' || !(url.hostname === 'media.tenor.com' || url.hostname.endsWith('.tenor.com'))) {
    return res.status(400).json({ error: 'Only Tenor GIF URLs are allowed' })
  }

  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15_000) })
    if (!response.ok) return res.status(400).json({ error: 'Could not download GIF' })
    const contentType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase()
    if (contentType !== 'image/gif') return res.status(400).json({ error: 'Selected media is not a GIF' })
    const declaredSize = Number(response.headers.get('content-length') || 0)
    if (declaredSize > MAX_BYTES) return res.status(413).json({ error: 'GIF is too large' })
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > MAX_BYTES) return res.status(413).json({ error: 'GIF is too large' })
    if (!['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) {
      return res.status(400).json({ error: 'Invalid GIF data' })
    }

    const path = `gifs/${crypto.randomUUID()}.gif`
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: 'image/gif', upsert: false })
    if (error) throw error
    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
    return res.status(201).json({ url: publicData.publicUrl, path: data.path })
  } catch (err) {
    console.error('GIF import error:', err)
    return res.status(500).json({ error: 'Failed to import GIF' })
  }
})
