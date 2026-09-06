# ── Stage 1: Build the Next.js static export ──
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Public site URL baked into the static export (metadata, canonical/OpenGraph URLs).
ARG NEXT_PUBLIC_SITE_URL=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build

# ── Stage 2: Serve with nginx ──
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/out /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
