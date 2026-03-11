FROM node:20-alpine

# better-sqlite3 needs build tools
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm rebuild better-sqlite3

COPY src/ ./src/

# Data directory for SQLite databases
RUN mkdir -p /app/data

EXPOSE 3000
CMD ["node", "src/server.js"]
