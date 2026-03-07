import { prisma } from './prisma';

export async function createMessage(data: {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  totalCost?: number | null;
}) {
  return prisma.message.create({
    data: {
      conversationId: data.conversationId,
      role: data.role,
      content: data.content,
      totalCost: data.totalCost ?? null,
    },
  });
}
