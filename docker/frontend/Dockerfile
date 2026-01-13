FROM node:20.18.0-slim AS builder

WORKDIR /workspace

# Build prerequisites (node-gyp + git for any dependencies that need it)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm via npm (avoid Corepack signature issues in some base images)
RUN npm install -g pnpm@9.15.5

# Build-time public env (baked into Next.js build)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_AUTH_MODE
ARG NEXT_PUBLIC_ZITADEL_ISSUER
ARG NEXT_PUBLIC_ZITADEL_CLIENT_ID
ARG NEXT_PUBLIC_ZITADEL_SCOPES
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_AUTH_MODE=$NEXT_PUBLIC_AUTH_MODE \
    NEXT_PUBLIC_ZITADEL_ISSUER=$NEXT_PUBLIC_ZITADEL_ISSUER \
    NEXT_PUBLIC_ZITADEL_CLIENT_ID=$NEXT_PUBLIC_ZITADEL_CLIENT_ID \
    NEXT_PUBLIC_ZITADEL_SCOPES=$NEXT_PUBLIC_ZITADEL_SCOPES

# Install deps with maximum cache hit:
# 1) copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY frontend/package.json frontend/tsconfig.json frontend/next.config.ts ./frontend/

# Install dependencies (pnpm will hoist to root node_modules)
# Use --shamefully-hoist to ensure all deps are available in node_modules
# Install with dev dependencies to get type definitions
RUN pnpm install --no-frozen-lockfile --shamefully-hoist --include-workspace-root

# 2) copy sources (exclude node_modules and .next)
# Remove any existing node_modules in frontend before copying
RUN rm -rf /workspace/frontend/node_modules 2>/dev/null || true
COPY shared ./shared
COPY frontend ./frontend

# Build shared first (frontend depends on its dist exports)
# Use workspace filter to ensure all dependencies are available
RUN pnpm --filter @thaliumx/shared build || (cd shared && pnpm install && pnpm build)
# Build frontend - find next in pnpm store and create proper symlink
RUN if [ ! -f /workspace/frontend/node_modules/next/dist/bin/next ]; then \
      rm -rf /workspace/frontend/node_modules/next 2>/dev/null || true; \
      NEXT_PATH=$(find /workspace/node_modules -name "next" -type d -path "*/next" | head -1); \
      if [ -n "$NEXT_PATH" ]; then \
        mkdir -p /workspace/frontend/node_modules && \
        ln -s "$NEXT_PATH" /workspace/frontend/node_modules/next; \
      fi; \
    fi
RUN cd frontend && pnpm build


FROM node:20.18.0-slim AS runner

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -m nextjs

# Set working directory (we'll later switch into the standalone app dir)
WORKDIR /app

# Next.js standalone output contains the minimal server + node_modules.
# Copy it to /app, then add static assets.
# Standalone output is at /workspace/frontend/.next/standalone
COPY --from=builder --chown=nextjs:nodejs /workspace/frontend/.next/standalone /app/
COPY --from=builder --chown=nextjs:nodejs /workspace/frontend/.next/static /app/workspace/frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /workspace/frontend/public /app/workspace/frontend/public
# Copy actual node_modules from workspace root (pnpm hoisted) to fix broken symlinks
COPY --from=builder --chown=nextjs:nodejs /workspace/node_modules /app/workspace/node_modules

# Run from the standalone app directory (where server.js and its .next folder live)
WORKDIR /app/workspace/frontend

# Switch to non-root user
USER nextjs

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
