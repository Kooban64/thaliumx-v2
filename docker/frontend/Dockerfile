FROM node:20.18.0-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -m nextjs

# Set working directory
WORKDIR /app

# Copy built application from local build (context is parent docker directory)
COPY --chown=nextjs:nodejs frontend/.next ./.next
COPY --chown=nextjs:nodejs frontend/public ./public
COPY --chown=nextjs:nodejs frontend/package.json ./
COPY --chown=nextjs:nodejs frontend/next.config.ts ./
COPY --chown=nextjs:nodejs frontend/node_modules ./node_modules

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
