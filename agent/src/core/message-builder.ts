/**
 * @module core/message-builder
 * LLM に送信するユーザーメッセージの構築とリクエスト時刻コンテキストの生成。
 * agent.ts と agent-streaming.ts の重複メッセージ構築を共通化する。
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
- 指定エージェントID: ${agentId}

## 重要な指示（指定エージェントの場合）
※まず discover_agents({ agentId: "${agentId}" }) でエージェント情報を取得してください
※そのエージェントがタスクに適している場合のみ execute_and_evaluate_agent で実行してください
※タスクに合わない場合や追加エージェントが必要な場合は、カテゴリやスキル名で discover_agents を再実行してください`;
  }

  return `${message}\n\n[Context: requestTime=${requestTimeIso}, timeZone=${requestTimeZone}, walletId=${walletId}, walletAddress=${walletAddress}, autoApproveThreshold=${autoApproveThreshold} USDC]`;
}

interface BuildNonStreamingMessageParams {
  message: string;
  walletId: string;
  walletAddress: string;
  autoApproveThreshold: number;
  totalCost: number;
  agentId?: string;
}

/**
 * 非ストリーミング（invoke）エージェント向けのユーザーメッセージを構築する。
 *
 * @param params - メッセージ構築に必要なパラメータ
 * @returns LLM に送信するユーザーメッセージ文字列
 */
export function buildNonStreamingUserMessage(params: BuildNonStreamingMessageParams): string {
  const { message, walletId, walletAddress, autoApproveThreshold, totalCost, agentId } = params;

  return `
## ユーザーのリクエスト
${message}

## コンテキスト
- wallet_id: ${walletId}
- wallet_address: ${walletAddress}
- auto_approve_threshold: $${autoApproveThreshold} USDC
- 現在の予算使用額: $${totalCost} USDC${
    agentId
      ? `
- 指定エージェントID: ${agentId}
  ※まず discover_agents({ agentId: "${agentId}" }) でエージェント情報を取得してください
  ※そのエージェントがタスクに適している場合のみ execute_agent で実行してください
  ※タスクに合わない場合やタスク遂行するために追加エージェントが必要な場合は、カテゴリやスキル名で discover_agents を再実行してください`
      : ''
  }

## 重要な指示
- discover_agents（検索）はコストフリーなので、必要に応じて積極的に使用してください
- execute_agent（実行）は課金されるため、タスクに適したエージェントのみ実行してください
- エージェントを実行する場合は execute_agent に以下を指定:
  - agentId: discover_agents の結果の agentId（Base URL はサーバーが解決）
  - walletId: "${walletId}"
  - walletAddress: "${walletAddress}"
  - maxPrice: auto_approve_threshold以下に設定
`;
}
