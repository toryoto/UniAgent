/**
 * Prisma Client re-export
 *
 * packages/database のシングルトンクライアントを re-export する。
 * 既存の import { prisma } from '@/lib/db/prisma' を維持。
 */

export { prisma, PrismaClient, Prisma } from '@agent-marketplace/database';
export type * from '@agent-marketplace/database';
