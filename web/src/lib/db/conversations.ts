import { prisma } from './prisma';

export async function listConversationsByUser(userId: string) {
  return prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function createConversation(userId: string, title: string | null) {
  return prisma.conversation.create({
    data: { userId, title },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function findConversationOwner(conversationId: string) {
  return prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { userId: true },
  });
}

export async function deleteConversation(conversationId: string) {
  return prisma.conversation.delete({
    where: { id: conversationId },
  });
}

export async function findConversationWithMessages(conversationId: string) {
  return prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' as const },
        select: { id: true, role: true, content: true, totalCost: true, createdAt: true },
      },
    },
  });
}

export async function findConversationHistory(
  conversationId: string,
  userId: string,
) {
  return prisma.conversation.findUnique({
    where: { id: conversationId, userId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' as const },
        select: { role: true, content: true },
      },
    },
  });
}

export async function touchConversation(conversationId: string) {
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}
