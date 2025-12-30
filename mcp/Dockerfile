# Multi-stage build for MCP Server
FROM node:20-alpine AS base

# Build stage - install all dependencies and build everything
FROM base AS builder
WORKDIR /app

# Copy all package files
COPY package*.json ./
COPY mcp/package.json ./mcp/
COPY packages/shared/package.json ./packages/shared/

# Copy source files
COPY packages/shared ./packages/shared
COPY mcp ./mcp

# Install all dependencies at once (including dev dependencies for build)
RUN npm install

# Build shared package
RUN npm run build --workspace=packages/shared

# Build MCP server
RUN npm run build --workspace=mcp

# Production image  
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy package files for production install
COPY package*.json ./
COPY mcp/package.json ./mcp/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies only
# Using npm install instead of npm ci to handle lock file inconsistencies
RUN npm install --omit=dev

# Copy built packages from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/mcp/dist ./mcp/dist

# Expose port
EXPOSE 3001

# Health check - MCPサーバーのSSEエンドポイントを確認
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/sse', (r) => {process.exit(r.statusCode === 200 || r.statusCode === 405 ? 0 : 1)})"

# Start MCP server
CMD ["npm", "run", "start", "-w", "mcp"]

