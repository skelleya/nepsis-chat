# Backend only — frontend is on Vercel.
# Build context must be the backend/ folder:
#   docker build -f backend/Dockerfile backend
# Railway: set Root Directory to `backend` (this file is used as the Dockerfile).
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY supabase-migration.sql ./supabase-migration.sql

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "src/index.js"]
