# syntax=docker/dockerfile:1

# Stage 1: Build static frontend assets
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies using reproducible lockfile
COPY package.json package-lock.json ./
RUN npm ci

# Copy full source tree and compile frontend bundle
COPY . .
RUN npm run build

# Stage 2: Minimal production runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built frontend bundle from builder
COPY --from=builder /app/dist ./dist

# Copy backend server code, types, and configs
COPY --from=builder /app/server ./server
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json /app/tsconfig.*.json ./

# Switch to non-root node user for container security
USER node

# Expose HTTP port
EXPOSE 3001

# Health check probing container health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start unified production server
CMD ["npm", "start"]
