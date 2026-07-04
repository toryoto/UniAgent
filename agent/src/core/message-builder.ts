/**
 * @module core/message-builder
 * LLM に送信するユーザーメッセージの構築とリクエスト時刻コンテキストの生成。
 */

import { logger } from '@agent-marketplace/shared/logger';

interface RequestTimeContext {
  iso: string;
  timeZone: string;
}

/**
 * リクエスト時点の ISO 日時とタイムゾーンを取得する。
 * 「今週」「明日」などの相対日付を LLM が解釈するために付与する。
 *
 * @returns ISO 形式の日時文字列とタイムゾーン
 */
export function getRequestTimeContext(): RequestTimeContext {
  const now = new Date();
  let timeZone = 'UTC';
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (err) {
    logger.agent.warn('Intl timezone resolution failed; falling back to UTC', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return { iso: now.toISOString(), timeZone };
}

interface BuildStreamingMessageParams {
  message: string;
  walletId: string;
  walletAddress: string;
  autoApproveThreshold: number;
  agentId?: string;
}

/**
 * ストリーミングエージェント向けのユーザーメッセージを構築する。
 * agentId が指定されている場合はエージェント直接実行用の追加指示を含める。
 *
 * @param params - メッセージ構築に必要なパラメータ
 * @returns LLM に送信するユーザーメッセージ文字列
 */
export function buildStreamingUserMessage(params: BuildStreamingMessageParams): string {
  const { message, walletId, walletAddress, autoApproveThreshold, agentId } = params;
  const { iso: requestTimeIso, timeZone: requestTimeZone } = getRequestTimeContext();

  if (agentId) {
    return `${message}
## コンテキスト
- 現在の日時（サーバー）: ${requestTimeIso}（タイムゾーン: ${requestTimeZone}）
- wallet_id: ${walletId}
- wallet_address: ${walletAddress}
- auto_approve_threshold: $${autoApproveThreshold} USDC
- 指定エージェントID: ${agentId}`;
  }

  return `${message}\n\n[Context: requestTime=${requestTimeIso}, timeZone=${requestTimeZone}, walletId=${walletId}, walletAddress=${walletAddress}, autoApproveThreshold=${autoApproveThreshold} USDC]`;
}
