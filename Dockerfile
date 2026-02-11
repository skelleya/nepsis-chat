# ── Stage 1: Build the frontend ──────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Production backend ─────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Install backend deps (no native modules needed — Supabase is pure JS)
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/ ./

# Copy built frontend into backend/public for static serving
COPY --from=frontend-build /app/frontend/dist ./public

ENV NODE_ENV=production
ENV PORT=8080
# Supabase keys are set via Fly.io secrets (not baked into image)

EXPOSE 8080

CMD ["node", "src/index.js"]
