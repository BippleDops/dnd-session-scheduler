FROM node:20-alpine

# better-sqlite3 needs build tools
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm rebuild better-sqlite3

COPY src/ ./src/

# Data directory for SQLite databases (bind-mounted from ./data by docker-compose).
# Run as the unprivileged `node` user (uid 1000) instead of root.
RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "src/server.js"]
