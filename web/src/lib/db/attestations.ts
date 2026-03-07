import { prisma } from './prisma';

export async function findAttestationsByAgent(agentId: string) {
  return prisma.easAttestation.findMany({
    where: { agentId },
    orderBy: { createdAt: 'desc' },
  });
}
