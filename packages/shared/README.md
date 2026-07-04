# `@agent-marketplace/shared`

Lowest-layer package: framework-agnostic types, constants, and pure functions shared across workspaces. **No dependencies** — never imports Prisma, React, Next.js, or reads environment-specific state beyond contract-address overrides.

Move code here only when it is used by 2+ workspaces, has no side effects, and is framework-free ([placement rules](../../docs/coding-conventions.md)).

## Contents

| Module                     | Provides                                                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/agent-ranking`   | Pure scoring & selection for the [discovery algorithm](../../docs/discovery-algorithm.md) (Bayesian average, stake, freshness, composite score) |
| `services/agent-discovery` | `discoverAgentsFromCache`, row → `DiscoveredAgent` conversion                                                                                   |
| `config`                   | `CONTRACT_ADDRESSES` (env-overridable), USDC helpers (`parseUSDC`, 6 decimals)                                                                  |
| `contract`                 | Contract ABIs                                                                                                                                   |
| `sse` / `message-history`  | SSE event contract and message-history transforms shared by web and agent                                                                       |
| `types`                    | `AgentCacheRow`, `DiscoveredAgent`, `ScoredAgent`, etc.                                                                                         |
| `logger`                   | `createLogger`                                                                                                                                  |

## Setup

Installed and built via the repository root:

```bash
npm install                                # from repo root
npm run build --workspace=packages/shared  # other workspaces depend on dist/
npm run test  --workspace=packages/shared
```

Build this package first when building workspaces individually.
