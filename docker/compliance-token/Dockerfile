# Token Compliance Service Dockerfile
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
COPY .eslintrc.js ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# ==================== PRODUCTION STAGE ====================
FROM node:20-alpine AS production

# Install security updates
RUN apk upgrade --no-cache

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S compliance -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=compliance:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=compliance:nodejs /app/dist ./dist
COPY --from=builder --chown=compliance:nodejs /app/package*.json ./

# Copy migrations
COPY --chown=compliance:nodejs migrations/ ./migrations/

# Install runtime tools (healthcheck + privilege drop helper)
RUN apk add --no-cache wget su-exec

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3004

# Expose port
EXPOSE 3004

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3004/health || exit 1

# Switch to non-root user
USER compliance

# Start the service
CMD ["node", "dist/index.js"]
