# Backend only — frontend is on Vercel
# Build with context: backend folder (docker build -f backend/Dockerfile backend)
FROM node:20-alpine

WORKDIR /app

# Install deps
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/src/ ./src/
COPY backend/supabase-migration.sql ./supabase-migration.sql

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "src/index.js"]
