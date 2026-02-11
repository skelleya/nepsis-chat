# Backend only — frontend is on Vercel
# Build context: backend/ (so Fly only uploads ~50MB, not 11GB)
FROM node:20-alpine

WORKDIR /app

# Install deps (no native modules — Supabase is pure JS)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
# Supabase keys are set via Fly.io secrets (not baked into image)

EXPOSE 8080

CMD ["node", "src/index.js"]
