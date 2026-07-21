/**
 * @module lib/agent/build-agent-service-request
 * Web Route の検証済み入力を Agent Service 向けリクエストボディへ変換する。
 */

import type { AgentMessageHistoryEntry, AgentRequest, AgentResumeRequest } from '@agent-marketplace/shared';
import type { AgentResumeBody, AgentStreamBody } from '@/lib/agent/schemas';

type ResolvedConversationForStream = {
  conversationId: string;
  messageHistory: AgentMessageHistoryEntry[];
};

/**
 * stream 用の Agent Service リクエストボディを組み立てる。
 * `autoApproveThreshold` は DB から取得した値を渡す（クライアント入力は使わない）。
 */
export function buildAgentStreamRequest(
  body: AgentStreamBody,
  resolved: ResolvedConversationForStream,
  autoApproveThreshold: number,
): AgentRequest {
  return {
    message: body.message,
    walletId: body.walletId,
    walletAddress: body.walletAddress,
    autoApproveThreshold,
    conversationId: resolved.conversationId,
    ...(body.agentId ? { agentId: body.agentId } : {}),
    ...(resolved.messageHistory.length > 0 ? { messageHistory: resolved.messageHistory } : {}),
  };
}

/**
 * resume 用の Agent Service リクエストボディを組み立てる。
 * `autoApproveThreshold` は DB から取得した値を渡す（クライアント入力は使わない）。
 */
export function buildAgentResumeRequest(
  body: AgentResumeBody,
  autoApproveThreshold: number,
): AgentResumeRequest {
  return {
    threadId: body.threadId,
    decisions: body.decisions,
    autoApproveThreshold,
    ...(body.conversationId ? { conversationId: body.conversationId } : {}),
  };
}
