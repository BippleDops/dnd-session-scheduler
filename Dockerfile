FROM node:20-alpine

WORKDIR /app

# Install build deps for better-sqlite3 + curl for healthcheck
RUN apk add --no-cache python3 make g++ curl

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Create data directories
RUN mkdir -p /app/data/backups

# Run as non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app/data
USER appuser

EXPOSE 3000

# Graceful shutdown support
STOPSIGNAL SIGTERM

CMD ["node", "src/server.js"]

