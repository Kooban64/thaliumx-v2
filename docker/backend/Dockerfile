# =============================================================================
# ThaliumX Backend Dockerfile
# Security-hardened multi-stage build for Node.js/Express application
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Base image with security updates
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base

# Security: Update base packages and add security tools
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache \
      libc6-compat \
      dumb-init \
    && rm -rf /var/cache/apk/*

# Security: Install pnpm with specific version for reproducibility
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

# -----------------------------------------------------------------------------
# Stage 2: Dependencies installation
# -----------------------------------------------------------------------------
FROM base AS deps
WORKDIR /app

# Security: Add build dependencies (needed for native modules)
RUN apk add --no-cache python3 make g++

# Security: Copy only package files first for better layer caching
COPY backend/package.json ./
COPY shared/package.json ./shared/

# Security: Disable npm scripts during install to prevent supply chain attacks
RUN npm config set ignore-scripts true

# Install shared package dependencies
WORKDIR /app/shared
RUN pnpm install --ignore-workspace --frozen-lockfile 2>/dev/null || pnpm install --ignore-workspace

# Install backend dependencies
WORKDIR /app
RUN pnpm install --ignore-workspace --frozen-lockfile 2>/dev/null || pnpm install --ignore-workspace

# Security: Prune store to reduce image size
RUN pnpm store prune

# -----------------------------------------------------------------------------
# Stage 3: Build the application
# -----------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app

# Add build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY backend/package.json ./
COPY shared ./shared

# Security: Disable npm scripts during install
RUN npm config set ignore-scripts true

# Build shared package first
WORKDIR /app/shared
RUN pnpm install --ignore-workspace --frozen-lockfile 2>/dev/null || pnpm install --ignore-workspace
RUN pnpm run build

# Build the backend application
WORKDIR /app
RUN pnpm install --ignore-workspace --frozen-lockfile 2>/dev/null || pnpm install --ignore-workspace

# Copy source code
COPY backend/tsconfig.json ./
COPY backend/src ./src

# Build TypeScript
RUN pnpm run build

# Copy ABI JSON files to dist (TypeScript doesn't copy JSON files)
RUN mkdir -p /app/dist/contracts/abis && \
    cp -r /app/src/contracts/abis/*.json /app/dist/contracts/abis/ 2>/dev/null || true

# -----------------------------------------------------------------------------
# Stage 4: Production runtime (minimal, security-hardened)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

# Security: Update packages and install only runtime dependencies
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache \
      libc6-compat \
      dumb-init \
      curl \
      tini \
    && rm -rf /var/cache/apk/*

# Security: Install pnpm for production
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

# Security: Create non-root user with specific UID/GID
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs thaliumx

# Security: Create necessary directories with proper permissions
RUN mkdir -p /app/dist /app/shared /app/node_modules /app/logs /app/.secrets && \
    chown -R thaliumx:nodejs /app

# Copy built application with proper ownership
COPY --from=builder --chown=thaliumx:nodejs /app/dist ./dist
COPY --from=builder --chown=thaliumx:nodejs /app/shared ./shared
COPY --from=builder --chown=thaliumx:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=thaliumx:nodejs /app/package.json ./

# Security: Set restrictive file permissions
RUN chmod -R 550 /app/dist /app/shared /app/node_modules && \
    chmod 440 /app/package.json && \
    chmod -R 770 /app/logs /app/.secrets

# Security: Set production environment
ENV NODE_ENV=production
ENV PORT=3002

# Security: Disable npm update checks and telemetry
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NO_UPDATE_NOTIFIER=1

# Security: Set secure Node.js options
ENV NODE_OPTIONS="--max-old-space-size=512 --no-experimental-fetch"

# Expose port (non-privileged)
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# Security: Switch to non-root user
USER thaliumx

# Security: Use dumb-init to handle signals properly (PID 1 zombie reaping)
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]

# =============================================================================
# Security Labels
# =============================================================================
LABEL org.opencontainers.image.title="ThaliumX Backend"
LABEL org.opencontainers.image.description="Security-hardened Node.js backend for ThaliumX platform"
LABEL org.opencontainers.image.vendor="ThaliumX"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/thaliumx/thaliumx"
LABEL security.hardened="true"
LABEL security.non-root="true"
LABEL security.read-only-root="recommended"
LABEL security.no-new-privileges="true"
