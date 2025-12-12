# DEX Compliance Service Dockerfile
# Multi-stage build for optimized production image

# ==================== BUILD STAGE ====================
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# ==================== PRODUCTION STAGE ====================
FROM node:20-alpine AS production

# Security: Run as non-root user
RUN addgroup -g 1001 -S compliance && \
    adduser -S compliance -u 1001 -G compliance

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=compliance:compliance /app/dist ./dist
COPY --from=builder --chown=compliance:compliance /app/node_modules ./node_modules
COPY --from=builder --chown=compliance:compliance /app/package*.json ./

# Copy migrations
COPY --chown=compliance:compliance migrations/ ./migrations/

# Create logs directory
RUN mkdir -p /app/logs && chown compliance:compliance /app/logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3002
ENV LOG_LEVEL=info

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3002/health || exit 1

# Switch to non-root user
USER compliance

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]
