import { Router } from 'express'
import { isIP } from 'net'
import dns from 'dns/promises'

export const embedsRouter = Router()

const MAX_HTML_BYTES = 1_500_000
const CACHE_TTL_MS = 60 * 60 * 1000
const CACHE_MAX = 500
const requestLog = new Map()
const cache = new Map()

function allowRequest(req, action, limit) {
  if (requestLog.size > 10_000) {
    const cutoff = Date.now() - 60_000
    for (const [key, times] of requestLog) {
      if (!times.some((time) => time > cutoff)) requestLog.delete(key)
    }
  }
  const key = `${req.ip}:${action}`
  const cutoff = Date.now() - 60_000
  const recent = (requestLog.get(key) || []).filter((time) => time > cutoff)
  if (recent.length >= limit) return false
  recent.push(Date.now())
  requestLog.set(key, recent)
  return true
}

function isPrivateIp(ip) {
  if (!ip) return true
  const v = ip.toLowerCase()
  if (v === '::1' || v === '0.0.0.0') return true
  if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true
  if (v.includes(':')) return false
  const parts = v.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true
  const [a, b] = parts
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

async function assertPublicUrl(rawUrl) {
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('Invalid URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are supported')
  }
  if (url.username || url.password) throw new Error('Credentials in URL are not allowed')
  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === 'metadata.google.internal'
  ) {
    throw new Error('Private hosts are not allowed')
  }
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error('Private IPs are not allowed')
    return url
  }
  const records = await dns.lookup(host, { all: true, verbatim: true })
  if (!records.length) throw new Error('Could not resolve host')
  for (const record of records) {
    if (isPrivateIp(record.address)) throw new Error('Private IPs are not allowed')
  }
  return url
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim()
}

function metaContent(html, key) {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i'
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["'][^>]*>`,
      'i'
    ),
  ]
  for (const re of patterns) {
    const match = html.match(re)
    if (match?.[1]) return decodeEntities(match[1])
  }
  return ''
}

function parseHtmlEmbed(html, pageUrl) {
  const title =
    metaContent(html, 'og:title') ||
    metaContent(html, 'twitter:title') ||
    decodeEntities((html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim())
  const description =
    metaContent(html, 'og:description') ||
    metaContent(html, 'twitter:description') ||
    metaContent(html, 'description')
  let image =
    metaContent(html, 'og:image') ||
    metaContent(html, 'twitter:image') ||
    metaContent(html, 'twitter:image:src')
  const siteName = metaContent(html, 'og:site_name') || pageUrl.hostname.replace(/^www\./, '')
  let favicon = ''
  const iconMatch =
    html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["'][^>]*>/i) ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["'][^>]*>/i)
  if (iconMatch?.[1]) favicon = iconMatch[1]

  const resolve = (value) => {
    if (!value) return ''
    try {
      return new URL(value, pageUrl).href
    } catch {
      return ''
    }
  }

  image = resolve(image)
  favicon = resolve(favicon) || `${pageUrl.origin}/favicon.ico`

  if (!title && !description && !image) return null
  return {
    url: pageUrl.href,
    title: title.slice(0, 200),
    description: description.slice(0, 400),
    image: image.slice(0, 2000),
    siteName: siteName.slice(0, 120),
    favicon: favicon.slice(0, 2000),
  }
}

async function fetchEmbed(rawUrl) {
  const startUrl = await assertPublicUrl(rawUrl)
  let current = startUrl
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    await assertPublicUrl(current.href)
    const response = await fetch(current, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'NepsisChatBot/1.0 (+https://github.com/skelleya/nepsis-chat)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(8_000),
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location || redirect === 3) throw new Error('Too many redirects')
      current = new URL(location, current)
      continue
    }
    if (!response.ok) throw new Error(`Fetch failed (${response.status})`)
    const contentType = (response.headers.get('content-type') || '').toLowerCase()
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      // Non-HTML: still return a minimal card from the URL itself
      return {
        url: current.href,
        title: current.hostname.replace(/^www\./, ''),
        description: current.href,
        image: '',
        siteName: current.hostname.replace(/^www\./, ''),
        favicon: `${current.origin}/favicon.ico`,
      }
    }
    const declared = Number(response.headers.get('content-length') || 0)
    if (declared > MAX_HTML_BYTES) throw new Error('Page is too large')
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Empty response')
    const chunks = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_HTML_BYTES) {
        await reader.cancel()
        break
      }
      chunks.push(value)
    }
    const html = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8')
    const parsed = parseHtmlEmbed(html, current)
    if (!parsed) {
      return {
        url: current.href,
        title: current.hostname.replace(/^www\./, ''),
        description: current.href,
        image: '',
        siteName: current.hostname.replace(/^www\./, ''),
        favicon: `${current.origin}/favicon.ico`,
      }
    }
    return parsed
  }
  throw new Error('Could not fetch URL')
}

function getCached(url) {
  const hit = cache.get(url)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(url)
    return null
  }
  return hit.data
}

function setCached(url, data) {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value
    if (first) cache.delete(first)
  }
  cache.set(url, { at: Date.now(), data })
}

embedsRouter.post('/unfurl', async (req, res) => {
  if (!allowRequest(req, 'unfurl', 40)) {
    return res.status(429).json({ error: 'Too many preview requests. Try again shortly.' })
  }
  const raw = String(req.body?.url || '').trim()
  if (!raw || raw.length > 2000) {
    return res.status(400).json({ error: 'A valid URL is required' })
  }

  const cached = getCached(raw)
  if (cached) return res.json(cached)

  try {
    const embed = await fetchEmbed(raw)
    setCached(raw, embed)
    setCached(embed.url, embed)
    return res.json(embed)
  } catch (err) {
    return res.status(400).json({ error: err?.message || 'Could not load preview' })
  }
})
