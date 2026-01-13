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
};

export default nextConfig;
