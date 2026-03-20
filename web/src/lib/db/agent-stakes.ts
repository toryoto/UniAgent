import { prisma } from './prisma';
import { Decimal } from '@prisma/client/runtime/library';

export async function upsertAgentStake(data: {
  agentId: string;
  stakedAmount: number;
  unstakeRequestAmount?: number;
  unstakeAvailableAt?: Date | null;
}) {
  const stakedAmount = new Decimal(data.stakedAmount);
  const unstakeRequestAmount = new Decimal(data.unstakeRequestAmount ?? 0);

  return prisma.agentStake.upsert({
    where: { agentId: data.agentId },
    create: {
      agentId: data.agentId,
      stakedAmount,
      unstakeRequestAmount,
      unstakeAvailableAt: data.unstakeAvailableAt ?? null,
    },
    update: {
      stakedAmount,
      unstakeRequestAmount,
      unstakeAvailableAt: data.unstakeAvailableAt ?? null,
    },
  });
}

export async function getAgentStake(agentId: string) {
  return prisma.agentStake.findUnique({
    where: { agentId },
  });
}
