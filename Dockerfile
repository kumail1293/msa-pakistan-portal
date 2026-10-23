# MSAP Portal Docker Configuration (§145)
# Multi-stage build: build → production

# ── Build Stage ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Production Stage ─────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install production deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built files (vite → dist/public, esbuild → dist/index.js)
COPY --from=builder /app/dist ./dist

# Copy server files (needed for runtime imports that esbuild externalized)
COPY server/ ./server/
COPY drizzle/ ./drizzle/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "dist/index.js"]
