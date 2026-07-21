# `@agent-marketplace/shared`

Lowest-layer package: framework-agnostic types, constants, pure functions, and the shared logging infrastructure used across workspaces. **No framework dependencies** — never imports Prisma, React, or Next.js. Runtime dependencies are limited to infrastructure concerns (`pino`/`pino-pretty` for logging, `ethers`, `pinata`); the logger additionally reads `NODE_ENV` / `LOG_LEVEL`.

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
| `logger`                   | pino-based structured logging: `createLogger`, `runWithLogContext`, `bindLogContext`, `getLogContext`                                          |

## Logging (`@agent-marketplace/shared/logger`)

pino-based structured logger shared by web, agent, and a2a-agents. Pretty-printed in development, single-line JSON in production (`NODE_ENV=production`). Level via `LOG_LEVEL` (default `info`). Sensitive fields (`privateKey`, `apiKey`, `authorization`, …) are redacted automatically.

```ts
import { createLogger, runWithLogContext, bindLogContext } from '@agent-marketplace/shared/logger';

const log = createLogger('payment'); // component child logger

// Request boundary: everything logged inside the scope carries requestId
runWithLogContext({ requestId }, () => handle(req));

// Enrich the current scope once the execution unit is known
bindLogContext({ threadId });

log.info({ txHash }, 'Payment settled');   // pino arg order: (obj, msg)
log.error({ err }, 'Settlement failed');   // pass Error as `err` — serialized with stack
```

Context (`requestId` / `threadId`) is stored in `AsyncLocalStorage` and injected into every log line via pino `mixin`, so call sites never pass it manually. The web proxy forwards its `requestId` to the Agent Service as an `x-request-id` header and the `conversationId` in the request body (trace metadata only), so one user request can be correlated across web and agent logs down to the conversation and LangGraph thread. See the logging section of [coding conventions](../../docs/coding-conventions.md) for the full rules.

## Setup

Installed and built via the repository root:

```bash
npm install                                # from repo root
npm run build --workspace=packages/shared  # other workspaces depend on dist/
npm run test  --workspace=packages/shared
```

Build this package first when building workspaces individually.
