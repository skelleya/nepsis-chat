import { Router } from 'express'
import multer from 'multer'
import crypto from 'crypto'
import supabase from '../db/supabase.js'

export const uploadsRouter = Router()

const BUCKET = 'attachments'
const MAX_SIZE = 25 * 1024 * 1024 // 25MB for videos
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'application/pdf',
  'text/plain',
  'application/octet-stream',
]

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    const allowed =
      ALLOWED_TYPES.some((t) => t === file.mimetype) ||
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/')
    if (allowed) cb(null, true)
    else cb(new Error('File type not allowed. Use images, videos (mp4/webm), PDF, or text.'), false)
  },
})

uploadsRouter.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  try {
    const ext = (req.file.originalname.split('.').pop() || 'bin').slice(0, 10)
    const name = `uploads/${crypto.randomUUID()}.${ext}`

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(name, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      })

    if (error) {
      if (error.message?.includes('Bucket not found')) {
        return res.status(503).json({
          error: 'Storage not configured. Create an "attachments" bucket in Supabase Dashboard > Storage.',
        })
      }
      console.error('Supabase storage upload error:', error)
      return res.status(500).json({
        error: error.message || 'Failed to upload file',
      })
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
    res.json({ url: urlData.publicUrl, path: data.path })
  } catch (err) {
    console.error('Upload error:', err)
    res.status(500).json({
      error: err.message || 'Failed to upload file',
    })
  }
})
