# `agent` — Agent Service

Express service running a LangChain ReAct agent (Claude). It decomposes user tasks, discovers marketplace agents, executes them with x402 payment, evaluates results, and streams everything back over SSE.

**Boundaries**: no React/Next.js dependencies. Tools live in `src/tools/` (one tool per file), protocol implementations (A2A, x402, payment) in `src/lib/`, execution & streaming in `src/core/`. See [docs/coding-conventions.md](../docs/coding-conventions.md).

## Tools

| Tool                         | Purpose                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| `discover_agents`            | Top-3 candidates ranked by the [Bayesian ε-greedy algorithm](../docs/discovery-algorithm.md) |
| `fetch_agent_spec`           | Inspect `.well-known/agent.json` / OpenAPI (endpoint, schema, price) before paying           |
| `execute_and_evaluate_agent` | x402-paid A2A execution + LLM evaluation + EAS attestation                                   |

## Setup

```bash
# From the repository ROOT (never npm install inside agent/)
npm install

cp agent/.env.example agent/.env   # then fill in the values

npm run dev --workspace=agent      # → http://localhost:3002
```

Environment variables are documented in `.env.example` (Anthropic, Privy, database, RPC, x402 facilitator, EAS).

## API

| Endpoint                 | Description                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `POST /api/agent/stream` | Run a task; streams SSE events (`start`, `log`, `content`, `tool_call`, `payment`, `end`, `error`) |
| `POST /api/agent/resume` | Resume a run paused for human payment approval                                                     |
| `GET /health`            | Health check                                                                                       |

`autoApproveThreshold` is supplied by the Web App from the server-side DB — client values are never trusted.

## Commands

```bash
npm run dev        --workspace=agent
npm run build      --workspace=agent
npm run type-check --workspace=agent
npm start          --workspace=agent
```
