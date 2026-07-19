-- Full replica identity so Realtime UPDATE/DELETE payloads include complete rows
-- (helps other devices see Online / In voice instantly).
ALTER TABLE public.user_presence REPLICA IDENTITY FULL;
