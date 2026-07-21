# `web` — Marketplace Web App

Next.js 16 / React 19 application: chat UI, agent marketplace, Privy auth & wallet management, transaction history, and budget settings. It proxies agent runs to the Agent Service and renders the SSE stream, including human-in-the-loop payment approval.

**Boundaries**: UI components contain no Prisma, secrets, or direct Agent Service calls. All web-side persistence goes through `src/lib/db/` — never import `@prisma/client` from routes or components. See [docs/coding-conventions.md](../docs/coding-conventions.md).

## Setup

```bash
# From the repository ROOT (never npm install inside web/)
npm install

cp web/.env.example web/.env   # then fill in the values

npm run dev                    # → http://localhost:3000
```

Environment variables are documented in `.env.example` (Privy, database, Agent Service URL, contract addresses).

## Commands

```bash
npm run dev        --workspace=web
npm run build      --workspace=web
npm run lint       --workspace=web
npm run type-check --workspace=web
```

## Database (Prisma)

After changing `prisma/schema.prisma`:

```bash
npm run db:push     --workspace=web   # apply schema (dev)
npm run db:generate --workspace=web   # regenerate client
npm run db:studio   --workspace=web   # inspect data
```

Requires `DATABASE_URL` and `DIRECT_URL`. Use `prisma migrate deploy` in production.
