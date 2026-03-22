FROM node:20-alpine AS base

# Build stage - install all dependencies and build everything
FROM base AS builder
WORKDIR /app

# Copy all package files
COPY package*.json ./
COPY a2a-agents/package.json ./a2a-agents/
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/

# Copy source files
COPY packages/shared ./packages/shared
COPY packages/database ./packages/database
COPY a2a-agents ./a2a-agents

# Install all dependencies at once (including dev dependencies for build)
RUN npm install

# Build shared package
RUN npm run build --workspace=packages/shared

# Build database package (tsconfig references + runtime dependency)
RUN npm run build --workspace=@agent-marketplace/database

# Build a2a-agents service
RUN npm run build --workspace=a2a-agents

# Drop devDependencies so runner can copy a lean node_modules (includes generated Prisma client)
RUN npm prune --omit=dev

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Workspace manifests (required for npm -w a2a-agents)
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/a2a-agents/package.json ./a2a-agents/
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/database/package.json ./packages/database/

COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/a2a-agents/dist ./a2a-agents/dist
COPY --from=builder /app/a2a-agents/agents.yaml ./a2a-agents/agents.yaml

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || '3003') + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npm", "run", "start", "-w", "a2a-agents"]
