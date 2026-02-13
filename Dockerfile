# Stage 1: Build React frontend
FROM node:20-alpine AS frontend
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Build native dependencies (better-sqlite3)
FROM node:20-alpine AS backend-deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --only=production

# Stage 3: Final runtime image (no build tools)
FROM node:20-alpine
WORKDIR /app

# Only curl needed for healthcheck at runtime
RUN apk add --no-cache curl

# Copy pre-built node_modules (includes native better-sqlite3)
COPY --from=backend-deps /app/node_modules ./node_modules
COPY package*.json ./

COPY src/ ./src/
COPY views/ ./views/

# Copy React static build into Express public dir
COPY public/ ./public/
COPY --from=frontend /app/client/out/ ./public/

# Create data directories
RUN mkdir -p /app/data/backups

# Run as non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app/data
USER appuser

EXPOSE 3000
STOPSIGNAL SIGTERM
CMD ["node", "src/server.js"]
