# Backend only — frontend is on Vercel
FROM node:20-alpine

WORKDIR /app

# Install backend deps (no native modules — Supabase is pure JS)
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/ ./

ENV NODE_ENV=production
ENV PORT=8080
# Supabase keys are set via Fly.io secrets (not baked into image)

EXPOSE 8080

CMD ["node", "src/index.js"]
