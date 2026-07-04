import { prisma } from './prisma';

const DEFAULTS = {
  dailyLimit: 100,
  autoApproveThreshold: 1,
} as const;

export interface BudgetSettingsData {
  dailyLimit: number;
  autoApproveThreshold: number;
}

/**
 * 認証済み privyUserId からDBの BudgetSettings を取得する。
 * 未設定の場合はデフォルト値を返す。ユーザーが存在しない場合は null。
 */
export async function getBudgetSettings(
  privyUserId: string,
): Promise<BudgetSettingsData | null> {
  const user = await prisma.user.findUnique({
    where: { privyUserId },
    select: { budgetSettings: true },
  });

  if (!user) return null;

  return {
    dailyLimit: user.budgetSettings
      ? Number(user.budgetSettings.dailyLimit)
      : DEFAULTS.dailyLimit,
    autoApproveThreshold: user.budgetSettings
      ? Number(user.budgetSettings.autoApproveThreshold)
      : DEFAULTS.autoApproveThreshold,
  };
}

/**
 * 当日（UTC）の累積支出を assistant メッセージの totalCost から集計する。
 * dailyLimit enforcement 用。
 */
export async function getSpentToday(userId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const result = await prisma.message.aggregate({
    _sum: { totalCost: true },
    where: {
      role: 'assistant',
      createdAt: { gte: startOfDay },
      totalCost: { not: null },
      conversation: { userId },
    },
  });

  return result._sum.totalCost ? Number(result._sum.totalCost) : 0;
}

export async function upsertBudgetSettings(
  userId: string,
  data: { dailyLimit?: number; autoApproveThreshold?: number },
) {
  const update: Record<string, number> = {};
  if (data.dailyLimit !== undefined) update.dailyLimit = data.dailyLimit;
  if (data.autoApproveThreshold !== undefined)
    update.autoApproveThreshold = data.autoApproveThreshold;

  return prisma.budgetSettings.upsert({
    where: { userId },
    create: {
      userId,
      dailyLimit: data.dailyLimit ?? DEFAULTS.dailyLimit,
      autoApproveThreshold: data.autoApproveThreshold ?? DEFAULTS.autoApproveThreshold,
    },
    update,
  });
}
