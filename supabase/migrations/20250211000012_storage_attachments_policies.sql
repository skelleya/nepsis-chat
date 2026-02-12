-- Storage policies for attachments bucket (server banners, icons, chat files, emojis, soundboard)
-- Backend uses service_role which bypasses RLS for uploads.
-- This adds public SELECT so banner/icon URLs work when displayed in the app.

-- Allow public read (critical: without this, uploaded images return 403 when loaded)
DROP POLICY IF EXISTS "Public read attachments" ON storage.objects;
CREATE POLICY "Public read attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'attachments');
