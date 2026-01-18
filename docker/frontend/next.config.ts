import type { NextConfig } from "next";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone', // Enable standalone output for Docker
  // Monorepo/workspace support: ensure tracing includes the actual repo root.
  // This avoids Next selecting an unexpected root when multiple lockfiles exist.
  outputFileTracingRoot: path.join(__dirname, '..', '..'),
  eslint: {
    ignoreDuringBuilds: true, // Warnings are acceptable, don't fail build
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Disable HTTPS redirect for development/localhost
  // This prevents browser from redirecting HTTP to HTTPS when no certificate is configured
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=0', // Disable HSTS for localhost
          },
        ],
      },
    ];
  },
  // For development: allow HTTP on localhost
  // In production, this should be handled by a reverse proxy (APISIX) with proper SSL
};

export default nextConfig;
