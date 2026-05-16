/**
 * @module core/auto-approve
 * HITL (Human-in-the-Loop) 自動承認判定ロジック。
 * autoApproveThreshold と requireUserApproval に基づいて、
 * ユーザー承認画面の表示要否を決定する。
 */

import type { HITLRequest } from 'langchain';
import type { StreamProcessingContext } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * HITL リクエストを自動承認すべきかを判定する。
 *
 * 以下の条件を全て満たす場合に自動承認:
 * - いずれの action も requireUserApproval !== true
 * - 合計 maxPrice が autoApproveThreshold 以下
 * - 合計 maxPrice が 0 より大きい
 *
 * @param hitlRequest - HITL ミドルウェアからの割り込みリクエスト
 * @param ctx - ストリーム処理コンテキスト（閾値情報を含む）
 * @returns 自動承認すべきなら true
 */
export function shouldAutoApprove(
  hitlRequest: HITLRequest,
  ctx: StreamProcessingContext,
): boolean {
  const actions = hitlRequest.actionRequests as Array<{ name: string; args: Record<string, unknown> }>;

  if (actions.some((a) => a.args?.requireUserApproval === true)) {
    logger.agent.info('HITL required: agent set requireUserApproval');
    return false;
  }

  const totalMaxPrice = actions.reduce(
    (sum, a) => sum + (Number(a.args?.maxPrice) || 0),
    0,
  );

  if (totalMaxPrice <= 0) {
    logger.agent.info('HITL required: no valid maxPrice found');
    return false;
  }

  if (totalMaxPrice > ctx.autoApproveThreshold) {
    logger.agent.info('HITL required: totalMaxPrice exceeds threshold', {
      totalMaxPrice,
      autoApproveThreshold: ctx.autoApproveThreshold,
    });
    return false;
  }

  logger.agent.info('Auto-approving: within threshold', {
    totalMaxPrice,
    autoApproveThreshold: ctx.autoApproveThreshold,
  });
  return true;
}
