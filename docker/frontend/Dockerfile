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
ARG NEXT_PUBLIC_KEYCLOAK_URL
ARG NEXT_PUBLIC_KEYCLOAK_REALM
ARG NEXT_PUBLIC_KEYCLOAK_CLIENT_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_KEYCLOAK_URL=$NEXT_PUBLIC_KEYCLOAK_URL \
    NEXT_PUBLIC_KEYCLOAK_REALM=$NEXT_PUBLIC_KEYCLOAK_REALM \
    NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=$NEXT_PUBLIC_KEYCLOAK_CLIENT_ID

# Install deps with maximum cache hit:
# 1) copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY frontend/package.json frontend/tsconfig.json frontend/next.config.ts ./frontend/

RUN pnpm install --frozen-lockfile

# 2) copy sources
COPY shared ./shared
COPY frontend ./frontend

# Build shared first (frontend depends on its dist exports)
RUN pnpm --filter @thaliumx/shared build
RUN pnpm --filter @thaliumx/frontend build


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
COPY --from=builder --chown=nextjs:nodejs /workspace/frontend/.next/standalone /app/
COPY --from=builder --chown=nextjs:nodejs /workspace/frontend/.next/static /app/workspace/frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /workspace/frontend/public /app/workspace/frontend/public

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
