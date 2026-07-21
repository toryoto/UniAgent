/**
 * @module lib/agent/route-guards
 * Agent stream / resume Route のセキュリティ境界チェック。
 * いずれも「条件を満たさない場合に早期リターン用の Response を返し、
 * 満たす場合は null を返す」共通シグネチャを持つ。
 */

import { jsonResponse } from '@/lib/api/json-response';
import { getSpentToday, type BudgetSettingsData } from '@/lib/db/budget-settings';

/**
 * クライアント申告の walletAddress が認証ユーザーの DB 上のアドレスと一致するか検証する。
 * 一致しない（または DB にアドレスが無い）場合は 403 を返し、他人のウォレットでの
 * 課金処理起動を防ぐ。大文字小文字・前後空白は正規化して比較する。
 *
 * @param bodyWalletAddress - クライアントが送信したアドレス（信用しない）
 * @param userWalletAddress - DB 上の認証ユーザーのアドレス
 */
export function verifyWalletAddress(
  bodyWalletAddress: string,
  userWalletAddress: string | null,
): Response | null {
  const normalize = (value: string) => value.trim().toLowerCase();
  if (!userWalletAddress || normalize(bodyWalletAddress) !== normalize(userWalletAddress)) {
    return jsonResponse({ success: false, error: 'Wallet address mismatch' }, 403);
  }
  return null;
}

/**
 * ウォレットが session signer に委託済みであることをサーバー側で強制する。
 * 未委託の場合は 403 を返す（UI のボタン無効化だけに依存しない）。
 */
export function enforceDelegation(isDelegated: boolean): Response | null {
  if (isDelegated !== true) {
    return jsonResponse({ success: false, error: 'Wallet delegation required' }, 403);
  }
  return null;
}

/**
 * 当日の累積支出が dailyLimit を超えていないか検証する。
 * 超過時は 402 相当の JSON エラーを返す。
 */
export async function enforceDailyBudget(
  userId: string,
  budget: BudgetSettingsData,
): Promise<Response | null> {
  const spentToday = await getSpentToday(userId);
  if (spentToday >= budget.dailyLimit) {
    return jsonResponse(
      {
        success: false,
        error: `Daily budget limit reached (${spentToday.toFixed(4)} / ${budget.dailyLimit} USDC)`,
      },
      402,
    );
  }
  return null;
}
