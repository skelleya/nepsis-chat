# ── Stage 1: Build the frontend ──────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Production backend ─────────────────────────────────
FROM node:20-alpine AS production
RUN apk add --no-cache python3 make g++
WORKDIR /app

# Install backend deps
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/ ./

# Copy built frontend into backend/public for static serving
COPY --from=frontend-build /app/frontend/dist ./public

# Create data directory for SQLite (Fly volume will mount here)
RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/data
# Allow all origins in production (Electron app + web)
ENV CORS_ORIGINS=*

EXPOSE 8080

CMD ["node", "src/index.js"]
