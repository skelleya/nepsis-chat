import { Router } from 'express'
import multer from 'multer'
import crypto from 'crypto'
import { parseBuffer } from 'music-metadata'
import supabase from '../db/supabase.js'

export const soundboardRouter = Router()

const BUCKET = 'attachments'
const SOUNDBOARD_PREFIX = 'soundboard'
const MAX_DURATION_SECONDS = 10
const MAX_SIZE = 3 * 1024 * 1024 // 3MB for ~10s audio
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
]

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    const allowed =
      ALLOWED_TYPES.includes(file.mimetype) ||
      file.mimetype.startsWith('audio/')
    if (allowed) cb(null, true)
    else cb(new Error('Only audio files allowed (MP3, WAV, OGG, WebM, M4A)'), false)
  },
})

// List user's soundboard sounds
soundboardRouter.get('/', async (req, res) => {
  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'userId required' })

  try {
    const { data, error } = await supabase
      .from('soundboard_sounds')
      .select('id, name, url, duration_seconds')
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

// Upload soundboard sound (max 10 seconds)
soundboardRouter.post('/', upload.single('file'), async (req, res) => {
  const { userId, name } = req.body
  if (!userId || !name || !req.file) {
    return res.status(400).json({ error: 'userId, name, and file required' })
  }

  try {
    let durationSeconds = 0
    try {
      const metadata = await parseBuffer(req.file.buffer, { mimeType: req.file.mimetype })
      durationSeconds = metadata.format.duration ?? 0
    } catch (parseErr) {
      return res.status(400).json({ error: 'Could not read audio file. Use MP3, WAV, OGG, or WebM.' })
    }

    if (durationSeconds <= 0 || durationSeconds > MAX_DURATION_SECONDS) {
      return res.status(400).json({
        error: `Audio must be between 1 and ${MAX_DURATION_SECONDS} seconds. Your file is ${durationSeconds.toFixed(1)}s.`,
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
      })
      .select('id, name, url, duration_seconds')
      .single()

    if (insertError) throw insertError
    res.status(201).json(sound)
  } catch (err) {
    console.error('Soundboard upload error:', err)
    res.status(500).json({ error: err?.message || 'Failed to upload sound' })
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
