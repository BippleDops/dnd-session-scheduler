import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

// Express API origin proxied by `next dev` (see rewrites below).
const API_DEV_ORIGIN = process.env.API_DEV_ORIGIN || 'http://localhost:3000';

const baseConfig: NextConfig = {
  trailingSlash: false,
  images: { unoptimized: true },
};

export default function config(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    // `output: 'export'` is omitted in development: `next dev` never produces an export, and
    // setting it makes Next warn that rewrites "will not work" even though the dev server
    // applies them. The static-export constraints are still enforced by `next build`.
    return {
      ...baseConfig,
      // Proxy API/auth calls to the Express server so the browser stays on one origin and
      // session cookies work without CORS. In production nginx does this (apps/web/nginx.conf).
      async rewrites() {
        return [
          { source: '/api/:path*', destination: `${API_DEV_ORIGIN}/api/:path*` },
          { source: '/auth/:path*', destination: `${API_DEV_ORIGIN}/auth/:path*` },
          { source: '/health', destination: `${API_DEV_ORIGIN}/health` },
        ];
      },
    };
  }
  return { ...baseConfig, output: 'export' };
}
