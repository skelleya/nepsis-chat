# AGENTS.md

## Cursor Cloud specific instructions

Nepsis Chat is a Discord-like chat/voice app with three parts. Standard commands live in `docs/commands.md`, `README.md`, and each `package.json`; only non-obvious caveats are noted here.

### Services

| Service | Dir | Dev command | Port | Notes |
|---|---|---|---|---|
| Backend (Express + Socket.io) | `backend/` | `npm run dev` | 3000 | REST `/api/*` + voice/chat/call signaling. |
| Frontend (React + Vite) | `frontend/` | `npm run dev` | 5173 | Uses `frontend/.env.development` → `VITE_API_URL=http://localhost:3000/api`. |
| Electron desktop | `electron/` | `npm start` | — | Optional; wraps the frontend. Not needed for web dev/testing. |

Run backend and frontend in separate long-lived shells (e.g. tmux), then open `http://localhost:5173`.

### Database / Supabase (important)

- There is **no local database**. Both backend and frontend talk to a **hosted** Supabase project (`qeopqyquskszzgprghiy`). Internet access is required.
- Despite `README.md` mentioning SQLite, `backend/src/db/init.js` is dead code — the live app uses Supabase (Postgres) exclusively via `backend/src/db/supabase.js`.
- The backend reads `backend/.env` (gitignored, so it does NOT persist to fresh VMs). Without it the process still boots but every `/api/*` route fails (`supabaseConfigured:false`). Create it with the public URL + anon key (already committed in `frontend/.env.production`):
  ```
  PORT=3000
  CORS_ORIGINS=*
  SUPABASE_URL=https://qeopqyquskszzgprghiy.supabase.co
  SUPABASE_ANON_KEY=<anon key from frontend/.env.production>
  SUPABASE_SERVICE_ROLE_KEY=
  ```
  The startup update script recreates this file if missing.
- The **anon key is sufficient** for core dev/testing (auth, servers, channels, messages all work). `SUPABASE_SERVICE_ROLE_KEY` (a real secret, not in the repo) is only needed for RLS-bypassing admin ops and Storage file uploads. If you need uploads/admin flows, add it to `backend/.env` and to the `SUPABASE_SERVICE_ROLE_KEY` secret.

### Testing / lint / build

- There are **no automated tests and no lint config** anywhere in the repo. Do not expect `npm test`/`npm run lint` to exist.
- Frontend production build: `cd frontend && npm run build` (`tsc && vite build`). Dev work should use `npm run dev`, not the build.
- Easiest end-to-end smoke test: open `http://localhost:5173`, "Use Web App" → Guest tab → enter a username → "Continue as Guest", join a server, open a text channel, send a message.
