# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UniAgent is a decentralized AI agent marketplace integrating A2A (Agent-to-Agent) protocol, x402 micropayments, and blockchain. Users send messages, and the system autonomously discovers agents on-chain, executes them with automatic USDC payments, and returns results.

## Monorepo Structure

- **npm workspaces** with Yarn 1.22.19 as package manager
- **CRITICAL**: Run `npm install` only at root. Never run npm install in sub-workspaces (causes duplicate lock files)
- `.npmrc` includes `legacy-peer-deps=true`

| Workspace | Purpose | Port |
|-----------|---------|------|
| `web/` | Next.js 15 frontend + API routes | 3000 |
| `agent/` | LangChain ReAct agent service | 3002 |
| `mcp/` | A2A discovery MCP server | 3001 |
| `contracts/` | Hardhat smart contracts | - |
| `packages/shared/` | Shared types & utilities | - |

## Build & Development Commands

```bash
# Install (root only!)
npm install

# Development (run all three for full stack)
npm run dev                          # web
npm run dev --workspace=agent        # agent service
npm run dev --workspace=mcp          # MCP server

# Building
npm run build                        # all workspaces
npm run build --workspace=web        # specific workspace

# Quality checks
npm run lint                         # ESLint all
npm run lint:fix                     # Auto-fix
npm run type-check                   # TypeScript all
npm run format                       # Prettier
npm run format:check                 # Check formatting

# Testing
npm run test                         # all workspaces
npm run test --workspace=contracts   # contracts only

# Database (Prisma in web/)
npm run db:push --workspace=web      # Sync schema
npm run db:generate --workspace=web  # Generate client
npm run db:studio --workspace=web    # Prisma Studio GUI

# Contracts
npm run compile --workspace=contracts
npm run deploy:base-sepolia --workspace=contracts
```

## Architecture

```
User Message → Web UI → Agent Service → LangChain ReAct Agent
                                              ↓
                        discover_agents tool → MCP Server → AgentRegistry (blockchain)
                                              ↓
                        execute_agent tool → External A2A Agent (x402 payment)
                                              ↓
                        SSE streaming results → Web UI
```

### Key Technologies
- **A2A Protocol**: Agent-to-agent communication standard
- **x402 Protocol**: HTTP 402 with EIP-3009 (gasless USDC transfers)
- **LangChain ReAct**: Reasoning + Action loop for agent orchestration
- **Privy**: Authentication & wallet delegation
- **Base Sepolia**: L2 testnet (Chain ID: 84532)

### Deployed Contracts
- **AgentRegistry**: `0xe2B64700330af9e408ACb3A04a827045673311C1`
- **USDC**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

## Key Patterns

### Streaming Events (agent → web)
Events: `start`, `log`, `content`, `tool_call`, `payment`, `end`, `error`

### Shared Package Imports
```typescript
import { AgentCard, DiscoveredAgent } from '@agent-marketplace/shared';
import { CONTRACT_ADDRESS } from '@agent-marketplace/shared/config';
import { AgentRegistryABI } from '@agent-marketplace/shared/contract';
```

### A2A Endpoints (hosted in web/)
- `/api/agents/flight/.well-known/agent.json`
- `/api/agents/hotel/.well-known/agent.json`
- `/api/agents/tourism/.well-known/agent.json`

### Agent Tools (in agent/src/tools/)
- `discover-agents.ts`: Queries MCP server for available agents
- `execute-agent.ts`: Executes agent with x402 payment flow
- `privy-signer.ts`: EIP-3009 signing via Privy delegation

## Environment Setup

Each workspace has `.env.example`:
- `web/.env.example`: Privy, Database, RPC URLs
- `agent/.env.example`: Claude API, Privy, MCP server URL
- `mcp/.env.example`: RPC URLs, Contract addresses
- `contracts/.env.example`: Private key, RPC URLs

## CI/CD

- GitHub Actions runs lint, type-check, build on push to web/, mcp/, agent/, packages/shared/
- Web: Vercel (vercel.json)
- Agent/MCP: Railway (railway.json)