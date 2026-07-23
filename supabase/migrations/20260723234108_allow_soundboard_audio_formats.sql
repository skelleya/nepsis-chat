-- Keep an unrestricted attachments bucket unrestricted. When a deployment has
-- configured an allowlist, extend it with the soundboard formats accepted by
-- the API instead of replacing existing image/video/document types.
UPDATE storage.buckets
SET allowed_mime_types = CASE
  WHEN allowed_mime_types IS NULL THEN NULL
  ELSE ARRAY(
    SELECT DISTINCT mime
    FROM unnest(
      allowed_mime_types || ARRAY[
        'audio/*',
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/x-wav',
        'audio/ogg',
        'audio/webm',
        'audio/mp4',
        'audio/x-m4a',
        'audio/aac',
        'audio/flac'
      ]::text[]
    ) AS mime
  )
END
WHERE id = 'attachments';
