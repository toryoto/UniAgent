FROM node:20-alpine AS base

# Build stage
FROM base AS builder
WORKDIR /app

# Copy package manifests (only the workspaces we need)
COPY package*.json ./
COPY a2a-agents/hotel-agent/package.json ./a2a-agents/hotel-agent/
COPY packages/shared/package.json ./packages/shared/

# Copy source
COPY packages/shared ./packages/shared
COPY a2a-agents/hotel-agent ./a2a-agents/hotel-agent

# Install all deps (including devDeps for build)
RUN npm install

# Build shared first (hotel-agent depends on it)
RUN npm run build --workspace=packages/shared

# Build hotel-agent
RUN npm run build --workspace=@agent-marketplace/hotel-agent

# Prune devDeps
RUN npm prune --omit=dev

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/a2a-agents/hotel-agent/package.json ./a2a-agents/hotel-agent/
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/a2a-agents/hotel-agent/dist ./a2a-agents/hotel-agent/dist

EXPOSE 3004

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || '3004') + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npm", "run", "start", "--workspace=@agent-marketplace/hotel-agent"]
