import { prisma } from './prisma';

const DEFAULTS = {
  dailyLimit: 100,
  autoApproveThreshold: 1,
} as const;

export interface BudgetSettings {
  dailyLimit: number;
  autoApproveThreshold: number;
}

/**
 * 認証済み privyUserId からDBの BudgetSettings を取得する。
 * 未設定の場合はデフォルト値を返す。ユーザーが存在しない場合は null。
 */
export async function getBudgetSettings(
  privyUserId: string,
): Promise<BudgetSettings | null> {
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
