# Stage 1: Build React frontend
FROM node:20-alpine AS frontend
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Express server
FROM node:20-alpine

WORKDIR /app

# Install build deps for better-sqlite3 + curl for healthcheck
RUN apk add --no-cache python3 make g++ curl

COPY package*.json ./
RUN npm ci --only=production

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
