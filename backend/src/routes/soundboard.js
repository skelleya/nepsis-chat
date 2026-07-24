import { Router } from 'express'
import multer from 'multer'
import crypto from 'crypto'
import { parseBuffer } from 'music-metadata'
import supabase from '../db/supabase.js'

export const soundboardRouter = Router()

const BUCKET = 'attachments'
const SOUNDBOARD_PREFIX = 'soundboard'
const MAX_DURATION_SECONDS = 10
const MAX_SIZE = 10 * 1024 * 1024 // accommodates lossless 10s clips
const ALLOWED_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/flac',
]
const ALLOWED_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'webm', 'm4a', 'mp4', 'aac', 'flac'])

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = (file.originalname.split('.').pop() || '').toLowerCase()
    const allowed =
      ALLOWED_TYPES.includes(file.mimetype) ||
      file.mimetype.startsWith('audio/') ||
      (file.mimetype === 'application/octet-stream' && ALLOWED_EXTENSIONS.has(ext))
    if (allowed) cb(null, true)
    else cb(new Error('Only audio files allowed (MP3, WAV, OGG, WebM, M4A, AAC, FLAC)'), false)
  },
})

// List user's soundboard sounds
soundboardRouter.get('/', async (req, res) => {
  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'userId required' })

  try {
    const { data, error } = await supabase
      .from('soundboard_sounds')
      .select('id, name, url, duration_seconds, emoji')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('Soundboard list error:', err)
    const msg = err?.message || 'Failed to fetch soundboard'
    const hint = msg.includes('does not exist') ? ' Run migration 20250211000009_soundboard_sounds.sql in Supabase.' : ''
    res.status(500).json({ error: msg + hint })
  }
})

const receiveSoundboardFile = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Invalid audio upload' })
    next()
  })
}

// Upload soundboard sound (max 10 seconds)
soundboardRouter.post('/', receiveSoundboardFile, async (req, res) => {
  const { userId, name, emoji } = req.body
  if (!userId || !name || !req.file) {
    return res.status(400).json({ error: 'userId, name, and file required' })
  }
  const emojiVal = (emoji && String(emoji).trim().slice(0, 8)) || '🔊'

  try {
    let durationSeconds = 0
    try {
      // music-metadata v11 skips full duration scanning by default. MP3 files
      // without a Xing/VBR header therefore parsed successfully but returned no
      // duration, which was presented to users as 0.0 seconds.
      const metadata = await parseBuffer(
        req.file.buffer,
        { mimeType: req.file.mimetype, size: req.file.size },
        { duration: true }
      )
      durationSeconds = metadata.format.duration ?? 0
    } catch (parseErr) {
      console.warn('Soundboard metadata parse failed:', parseErr)
      return res.status(400).json({ error: 'Could not read audio file. Use MP3, WAV, OGG, WebM, M4A, AAC, or FLAC.' })
    }

    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      return res.status(400).json({
        error: 'Could not determine audio duration. Try converting the file to MP3 or WAV.',
      })
    }
    if (durationSeconds > MAX_DURATION_SECONDS) {
      return res.status(400).json({
        error: `Audio must be ${MAX_DURATION_SECONDS} seconds or less. Your file is ${durationSeconds.toFixed(1)}s.`,
      })
    }

    const ext = (req.file.originalname.split('.').pop() || 'mp3').slice(0, 6)
    const path = `${SOUNDBOARD_PREFIX}/${userId}/${crypto.randomUUID()}.${ext}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: false })

    if (uploadError) {
      if (uploadError.message?.includes('Bucket not found')) {
        return res.status(503).json({
          error: 'Storage not configured. Create an "attachments" bucket in Supabase Storage.',
        })
      }
      throw uploadError
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path)
    const id = 'sb-' + crypto.randomUUID()

    const { data: sound, error: insertError } = await supabase
      .from('soundboard_sounds')
      .insert({
        id,
        user_id: userId,
        name: String(name).slice(0, 64) || 'Sound',
        url: urlData.publicUrl,
        duration_seconds: Math.round(durationSeconds * 100) / 100,
        storage_path: uploadData.path,
        emoji: emojiVal,
      })
      .select('id, name, url, duration_seconds, emoji')
      .single()

    if (insertError) throw insertError
    res.status(201).json(sound)
  } catch (err) {
    console.error('Soundboard upload error:', err)
    res.status(500).json({ error: err?.message || 'Failed to upload sound' })
  }
})

// Update soundboard sound (emoji)
soundboardRouter.patch('/:id', async (req, res) => {
  const { id } = req.params
  const { userId, emoji } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  try {
    const emojiVal = (emoji && String(emoji).trim().slice(0, 8)) || '🔊'
    const { data, error } = await supabase
      .from('soundboard_sounds')
      .update({ emoji: emojiVal })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id, name, url, duration_seconds, emoji')
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Sound not found' })
    res.json(data)
  } catch (err) {
    console.error('Soundboard update error:', err)
    res.status(500).json({ error: 'Failed to update sound' })
  }
})

// Delete soundboard sound
soundboardRouter.delete('/:id', async (req, res) => {
  const { id } = req.params
  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'userId required' })

  try {
    const { data: existing } = await supabase
      .from('soundboard_sounds')
      .select('id, storage_path')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (!existing) {
      return res.status(404).json({ error: 'Sound not found' })
    }

    await supabase.storage.from(BUCKET).remove([existing.storage_path])
    const { error } = await supabase.from('soundboard_sounds').delete().eq('id', id).eq('user_id', userId)

    if (error) throw error
    res.json({ ok: true })
  } catch (err) {
    console.error('Soundboard delete error:', err)
    res.status(500).json({ error: 'Failed to delete sound' })
  }
})
