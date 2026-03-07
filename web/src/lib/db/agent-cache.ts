import { prisma } from './prisma';

export async function upsertAgentCache(data: {
  agentId: string;
  owner: string;
  category: string;
  isActive: boolean;
  agentCard: object;
}) {
  return prisma.agentCache.upsert({
    where: { agentId: data.agentId },
    create: {
      agentId: data.agentId,
      owner: data.owner,
      category: data.category,
      isActive: data.isActive,
      agentCard: data.agentCard,
      lastSyncedBlock: 0,
      lastSyncedLogIdx: 0,
    },
    update: {
      owner: data.owner,
      category: data.category,
      isActive: data.isActive,
      agentCard: data.agentCard,
      lastSyncedBlock: 0,
      lastSyncedLogIdx: 0,
    },
  });
}
