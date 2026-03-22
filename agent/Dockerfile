FROM node:20-alpine AS base

# Build stage - install all dependencies and build everything
FROM base AS builder
WORKDIR /app

# Copy all package files
COPY package*.json ./
COPY agent/package.json ./agent/
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/

# Copy source files
COPY packages/shared ./packages/shared
COPY packages/database ./packages/database
COPY agent ./agent

# Install all dependencies at once (including dev dependencies for build)
RUN npm install

# Build shared package
RUN npm run build --workspace=packages/shared

# Build database package (agent tsconfig references + runtime dependency)
RUN npm run build --workspace=@agent-marketplace/database

# Build agent service
RUN npm run build --workspace=agent

# Drop devDependencies so runner can copy a lean node_modules (includes generated Prisma client)
RUN npm prune --omit=dev

# Production image  
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Workspace manifests (required for npm -w agent)
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/agent/package.json ./agent/
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/database/package.json ./packages/database/

# Pruned install from builder: includes @prisma/client + generated .prisma (workspace postinstall skips prisma CLI in prod-only installs)
COPY --from=builder /app/node_modules ./node_modules

# Built workspace outputs
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/agent/dist ./agent/dist

# Expose port
EXPOSE 3002

# Health check - Agentサービスのヘルスチェックエンドポイントを確認
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start agent service
CMD ["npm", "run", "start", "-w", "agent"]

