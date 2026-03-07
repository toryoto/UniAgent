import { prisma } from './prisma';

export async function findUserIdByPrivyId(privyUserId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { privyUserId },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function findUserByPrivyId(privyUserId: string) {
  return prisma.user.findUnique({
    where: { privyUserId },
    select: {
      id: true,
      walletAddress: true,
      isDelegated: true,
    },
  });
}

export async function findUserWithBudget(privyUserId: string) {
  return prisma.user.findUnique({
    where: { privyUserId },
    select: { id: true, budgetSettings: true },
  });
}

export async function updateUserDelegation(
  privyUserId: string,
  isDelegated: boolean,
) {
  return prisma.user.update({
    where: { privyUserId },
    data: { isDelegated },
    select: {
      id: true,
      walletAddress: true,
      isDelegated: true,
    },
  });
}

export async function createUser(data: {
  privyUserId: string;
  walletAddress: string | null;
}) {
  return prisma.user.create({
    data: {
      privyUserId: data.privyUserId,
      walletAddress: data.walletAddress,
      budgetSettings: {
        create: {
          dailyLimit: 100,
          autoApproveThreshold: 1,
        },
      },
    },
  });
}

export async function upsertUserWithWallet(data: {
  privyUserId: string;
  walletAddress: string | null;
}) {
  return prisma.user.upsert({
    where: { privyUserId: data.privyUserId },
    create: {
      privyUserId: data.privyUserId,
      walletAddress: data.walletAddress,
      budgetSettings: {
        create: {
          dailyLimit: 100,
          autoApproveThreshold: 1,
        },
      },
    },
    update: {
      walletAddress: data.walletAddress,
    },
  });
}

export async function updateUserWallet(
  privyUserId: string,
  walletAddress: string | null,
) {
  return prisma.user.update({
    where: { privyUserId },
    data: { walletAddress },
  });
}
