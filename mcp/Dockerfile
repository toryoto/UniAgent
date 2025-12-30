# Multi-stage build for MCP Server
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy all package files for workspace
COPY package*.json ./
COPY mcp/package.json ./mcp/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies (workspaces are hoisted to root node_modules)
RUN npm install --production

# Build shared package
FROM base AS shared-builder
WORKDIR /app

# Copy everything needed for build
COPY package*.json ./
COPY packages/shared ./packages/shared

# Install dev dependencies and build
RUN npm install --workspace=packages/shared && \
    npm run build --workspace=packages/shared

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy node_modules (all dependencies are in root due to hoisting)
COPY --from=deps /app/node_modules ./node_modules

# Copy built shared package
COPY --from=shared-builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=shared-builder /app/packages/shared/package.json ./packages/shared/

# Copy MCP server source
COPY mcp ./mcp
COPY package.json ./

# Expose port
EXPOSE 3001

# Health check - MCPサーバーのSSEエンドポイントを確認
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/sse', (r) => {process.exit(r.statusCode === 200 || r.statusCode === 405 ? 0 : 1)})"

# Start MCP server
CMD ["npm", "run", "start", "-w", "mcp"]

