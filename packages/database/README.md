# `@agent-marketplace/database`

Prisma Client and the DB queries shared by multiple workspaces (e.g. agent discovery reads used by both `web` and `agent`). Transformation and filtering logic is delegated to `@agent-marketplace/shared`; web-only persistence (User, Conversation, BudgetSettings, …) lives in `web/src/lib/db/` instead.

Dependency direction: `shared → database → app workspaces`.

## Contents

- `prisma` — singleton Prisma Client
- `discovery` — `discoverAgents` / `discoverAgentsWithStats`: raw `agent_cache` + attestation/stake stats for the [ranking algorithm](../../docs/discovery-algorithm.md) (scoring itself happens in `shared`)

## Setup

```bash
npm install   # from repo root
```

Prisma CLI commands run through the `web` workspace:

```bash
npm run db:generate --workspace=web
npm run db:push     --workspace=web
npm run db:studio   --workspace=web
```

For running Prisma CLI directly against this package, create a local env file:

```bash
cp packages/database/.env.example packages/database/.env
# set DATABASE_URL and DIRECT_URL (same values as web/.env)
```
