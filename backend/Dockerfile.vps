# Backend only — frontend is on Vercel.
# Build context must be the backend/ folder:
#   docker build -f backend/Dockerfile backend
# Railway: Root Directory = backend
FROM node:20-alpine

WORKDIR /app

# No native modules required (Supabase JS only). Keep image slim.
COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY supabase-migration.sql ./supabase-migration.sql

ENV NODE_ENV=production
# Do NOT set PORT here — Railway injects PORT at runtime.

EXPOSE 3000

CMD ["node", "src/index.js"]
