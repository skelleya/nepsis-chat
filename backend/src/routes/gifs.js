import { Router } from 'express'
import crypto from 'crypto'
import supabase from '../db/supabase.js'

export const gifsRouter = Router()

const BUCKET = 'attachments'
const MAX_BYTES = Number(process.env.GIF_IMPORT_MAX_BYTES) || 8 * 1024 * 1024
const requestLog = new Map()

function allowRequest(req, userId, action, limit) {
  if (!userId) return false
  if (requestLog.size > 10_000) {
    const cutoff = Date.now() - 60_000
    for (const [key, times] of requestLog) {
      if (!times.some((time) => time > cutoff)) requestLog.delete(key)
    }
  }
  const key = `${req.ip}:${userId}:${action}`
  const cutoff = Date.now() - 60_000
  const recent = (requestLog.get(key) || []).filter((time) => time > cutoff)
  if (recent.length >= limit) return false
  recent.push(Date.now())
  requestLog.set(key, recent)
  return true
}

async function isKnownUser(userId) {
  const { data } = await supabase.from('users').select('id').eq('id', userId).maybeSingle()
  return !!data
}

function isAllowedTenorUrl(url) {
  return url.protocol === 'https:' &&
    (url.hostname === 'media.tenor.com' || url.hostname.endsWith('.tenor.com'))
}

async function downloadTenorGif(source) {
  let current = new URL(source)
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    if (!isAllowedTenorUrl(current)) throw new Error('Only Tenor GIF URLs are allowed')
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location || redirect === 3) throw new Error('Too many GIF redirects')
      current = new URL(location, current)
      continue
    }
    if (!response.ok || !response.body) throw new Error('Could not download GIF')
    const contentType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase()
    if (contentType !== 'image/gif') throw new Error('Selected media is not a GIF')
    const declaredSize = Number(response.headers.get('content-length') || 0)
    if (declaredSize > MAX_BYTES) throw new Error('GIF is too large')

    const reader = response.body.getReader()
    const chunks = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BYTES) {
        await reader.cancel()
        throw new Error('GIF is too large')
      }
      chunks.push(value)
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total)
  }
  throw new Error('Could not download GIF')
}

gifsRouter.get('/search', async (req, res) => {
  const apiKey = process.env.TENOR_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'GIF search is not configured. Set TENOR_API_KEY.' })
  }
  const query = String(req.query.q || '').trim().slice(0, 80)
  const userId = String(req.query.userId || '')
  if (!allowRequest(req, userId, 'search', 30)) {
    return res.status(429).json({ error: 'Too many GIF searches. Try again shortly.' })
  }
  if (!(await isKnownUser(userId))) return res.status(403).json({ error: 'Unknown user' })
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
  const userId = String(req.body?.userId || '')
  if (!allowRequest(req, userId, 'import', 12)) {
    return res.status(429).json({ error: 'Too many GIF imports. Try again shortly.' })
  }
  if (!(await isKnownUser(userId))) return res.status(403).json({ error: 'Unknown user' })
  let url
  try {
    url = new URL(source)
  } catch {
    return res.status(400).json({ error: 'Invalid GIF URL' })
  }
  if (!isAllowedTenorUrl(url)) {
    return res.status(400).json({ error: 'Only Tenor GIF URLs are allowed' })
  }

  try {
    const buffer = await downloadTenorGif(url)
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
    const message = err?.message || 'Failed to import GIF'
    const status = message === 'GIF is too large' ? 413
      : /Tenor|GIF|download|redirect|media/.test(message) ? 400
        : 500
    return res.status(status).json({ error: message })
  }
})
