/**
 * @agent-marketplace/database
 *
 * Prisma クライアント + DB ベースのエージェント検索
 */

export { prisma } from './client.js';
export { PrismaClient, Prisma } from '@prisma/client';
export type * from '@prisma/client';

export { discoverAgents } from './discovery.js';
