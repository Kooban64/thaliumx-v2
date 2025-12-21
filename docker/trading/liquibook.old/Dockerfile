# Multi-stage build for Liquibook (Node.js with C++ bindings)
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    gcc \
    libc-dev \
    linux-headers

# Set working directory
WORKDIR /app

# Copy binding and package files first so native build can detect them
COPY package*.json ./
COPY binding.gyp ./
COPY src ./src
COPY liquibook-src ./liquibook-src

# Install production dependencies without requiring a lockfile
RUN npm install --omit=dev

# Copy remaining sources
COPY . .

# Build native modules if applicable
RUN npm run build || npm run compile || true

# Runtime stage
FROM node:18-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    dumb-init

# Create app user
RUN addgroup -g 1001 -S liquibook && \
    adduser -S liquibook -u 1001 -G liquibook

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/index-simple.js ./index.js
COPY --from=builder /app/server.js ./

# Change ownership to app user
RUN chown -R liquibook:liquibook /app

# Switch to app user
USER liquibook

# Expose port
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8081/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Run the application
CMD ["node", "server.js"]