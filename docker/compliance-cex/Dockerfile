# CEX Compliance Service Dockerfile
# Multi-stage build for production-ready container

# ==================== BUILD STAGE ====================
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

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

# Run linting (optional, can be removed for faster builds)
# RUN npm run lint

# ==================== PRODUCTION STAGE ====================
FROM node:20-alpine AS production

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S compliance && \
    adduser -S compliance -u 1001 -G compliance

# Install production dependencies and wget for health checks
COPY package*.json ./
RUN apk add --no-cache wget && \
    npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy migrations
COPY migrations/ ./migrations/

# Create logs directory
RUN mkdir -p logs && chown -R compliance:compliance logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Switch to non-root user
USER compliance

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]
