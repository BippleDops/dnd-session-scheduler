FROM node:20-alpine

WORKDIR /app

# Install build deps for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Create data directories
RUN mkdir -p /app/data/backups

EXPOSE 3000

CMD ["node", "src/server.js"]

