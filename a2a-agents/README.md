# `a2a-agents` — Reference A2A Agents

External-facing HTTP agents implementing the A2A protocol with x402 paywalls. A single server hosts 24 hotel-domain agents of deliberately varied quality and message formats, used to exercise the [discovery algorithm](../docs/discovery-algorithm.md) (Bayesian ε-greedy) and the evaluation pipeline. Individual agent workspaces (`hotel-agent/`, `flight-agent/`) hold agent-specific logic; `src/` holds only the shared A2A/x402 server foundation.

**Boundaries**: no marketplace UI, no conversation DB. See [docs/coding-conventions.md](../docs/coding-conventions.md).

## Setup

```bash
# From the repository ROOT (never npm install inside a2a-agents/)
npm install

cp a2a-agents/.env.example a2a-agents/.env

# Development (skip x402 payments)
X402_DISABLED=true npm run dev --workspace=a2a-agents   # → http://localhost:3003
```

Key environment variables (see `.env.example`): `X402_DISABLED`, `BASE_URL`, `PINATA_JWT` / `PRIVATE_KEY` (on-chain registration), `DATABASE_URL` (seeding).

## Agent Matrix

Agents are declared in `agents.yaml`: 4 quality tiers × 6 response formats × 4 request formats.

| Quality    | Count | Behavior                                              |
| ---------- | ----- | ----------------------------------------------------- |
| high       | 6     | Complete fields, accurate filtering                   |
| medium     | 8     | Mostly accurate, some gaps                            |
| low        | 5     | Minimal, includes inaccurate data                     |
| unreliable | 5     | Injected errors/latency via `errorRate` / `latencyMs` |

Request formats: `a2a-standard`, `natural-language`, `flat`, `mixed-input`.
Response formats: `text-only`, `data-only`, `mixed`, `legacy-flat`, `nested`, `markdown`.

## API

```
GET  /:slug/.well-known/agent.json   # agent card
GET  /:slug/openapi.json             # OpenAPI spec
POST /:slug                          # A2A execution (x402-paid)
GET  /agents                         # list all agents
GET  /health                         # health check
```

## Scripts

```bash
# Register all agents on-chain + upload metadata to IPFS
PINATA_JWT=... PRIVATE_KEY=0x... npm run register --workspace=a2a-agents

# IPFS only (skip on-chain)
npm run register --workspace=a2a-agents -- --dry-run

# Seed DB (AgentCache / EasAttestation / AgentStake); --clean to recreate
DATABASE_URL=... npm run seed --workspace=a2a-agents
```
