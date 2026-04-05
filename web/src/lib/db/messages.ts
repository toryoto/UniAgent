import { prisma, type Prisma } from './prisma';

export async function createMessage(data: {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  toolRounds?: Prisma.InputJsonValue | null;
  totalCost?: number | null;
}) {
  return prisma.message.create({
    data: {
      conversationId: data.conversationId,
      role: data.role,
      content: data.content,
      toolRounds: data.toolRounds ?? undefined,
      totalCost: data.totalCost ?? null,
    },
  });
}
