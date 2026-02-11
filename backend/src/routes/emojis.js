import { Router } from 'express'
import multer from 'multer'
import crypto from 'crypto'
import supabase from '../db/supabase.js'

export const emojisRouter = Router()

const BUCKET = 'attachments'
const EMOJI_PREFIX = 'emojis'
const MAX_SIZE = 256 * 1024 // 256KB per emoji
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/gif', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.mimetype)
    if (allowed) cb(null, true)
    else cb(new Error('Only PNG, GIF, JPG, WebP, SVG allowed for emojis'), false)
  },
})

// Get server emojis
emojisRouter.get('/servers/:serverId', async (req, res) => {
  const { serverId } = req.params
  try {
    const { data, error } = await supabase
      .from('server_emojis')
      .select('id, name, image_url')
      .eq('server_id', serverId)
      .order('name')
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('Get emojis error:', err)
    res.status(500).json({ error: 'Failed to fetch emojis' })
  }
})

// Upload server emoji (owner/admin only)
emojisRouter.post('/servers/:serverId', upload.single('file'), async (req, res) => {
  const { serverId } = req.params
  const { userId, name } = req.body
  if (!userId || !name || !req.file) {
    return res.status(400).json({ error: 'userId, name, and file required' })
  }

  try {
    const { data: member } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', serverId)
      .eq('user_id', userId)
      .single()

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ error: 'Only server owner or admin can upload emojis' })
    }

    const { data: user } = await supabase
      .from('users')
      .select('is_guest')
      .eq('id', userId)
      .single()

    if (user?.is_guest) {
      return res.status(403).json({ error: 'Email account required to upload custom emojis' })
    }

    const safeName = String(name).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32) || 'emoji'
    const ext = (req.file.originalname.split('.').pop() || 'png').slice(0, 6)
    const path = `${EMOJI_PREFIX}/${serverId}/${crypto.randomUUID()}.${ext}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: false })

    if (uploadError) {
      if (uploadError.message?.includes('Bucket not found')) {
        return res.status(503).json({ error: 'Storage not configured. Create an "attachments" bucket in Supabase.' })
      }
      throw uploadError
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path)
    const emojiId = 'emoji-' + crypto.randomUUID()

    const { data: emoji, error: insertError } = await supabase
      .from('server_emojis')
      .insert({
        id: emojiId,
        server_id: serverId,
        name: safeName,
        image_url: urlData.publicUrl,
        uploaded_by: userId,
      })
      .select('id, name, image_url')
      .single()

    if (insertError) throw insertError
    res.status(201).json(emoji)
  } catch (err) {
    console.error('Upload emoji error:', err)
    res.status(500).json({ error: err?.message || 'Failed to upload emoji' })
  }
})
