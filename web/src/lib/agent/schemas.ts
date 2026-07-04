/**
 * @module lib/agent/schemas
 * Agent 関連 API Route の入力検証スキーマ。
 * `autoApproveThreshold` はセキュリティ境界のためクライアントから受け取らず、
 * サーバーサイドで DB (BudgetSettings) から取得する。
 */

import { z } from 'zod';

/** POST /api/agent/stream のリクエストボディ */
export const agentStreamBodySchema = z.object({
  message: z.string().min(1, 'message is required'),
  walletId: z.string().min(1, 'walletId is required'),
  walletAddress: z.string().min(1, 'walletAddress is required'),
  agentId: z.string().optional(),
  conversationId: z.string().optional(),
});

export type AgentStreamBody = z.infer<typeof agentStreamBodySchema>;

const hitlDecisionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('approve') }),
  z.object({
    type: z.literal('edit'),
    editedAction: z.object({ name: z.string(), args: z.record(z.unknown()) }),
  }),
  z.object({ type: z.literal('reject'), message: z.string().optional() }),
]);

/** POST /api/agent/resume のリクエストボディ */
export const agentResumeBodySchema = z.object({
  threadId: z.string().min(1, 'threadId is required'),
  decisions: z.array(hitlDecisionSchema).min(1, 'decisions array is required'),
  conversationId: z.string().optional(),
});

export type AgentResumeBody = z.infer<typeof agentResumeBodySchema>;
