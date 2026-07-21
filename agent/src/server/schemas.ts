/**
 * @module server/schemas
 * Agent Service HTTP 境界の入力検証スキーマ。
 * web プロキシ経由とはいえ外部入力として扱い、core へ渡す前にここで検証する。
 */

import { z } from 'zod';

/** POST /api/agent/stream のリクエストボディ */
export const agentStreamRequestSchema = z.object({
  message: z.string().min(1, 'message is required'),
  walletId: z.string().min(1, 'walletId is required'),
  walletAddress: z.string().min(1, 'walletAddress is required'),
  autoApproveThreshold: z
    .number()
    .nonnegative('autoApproveThreshold must be a non-negative number'),
  agentId: z.string().optional(),
  /** ログ相関用メタデータ（web の Conversation ID）。ロジックでは使わない */
  conversationId: z.string().min(1).max(64).optional(),
  messageHistory: z
    .array(
      z.discriminatedUnion('role', [
        z.object({ role: z.literal('user'), content: z.string() }),
        z.object({
          role: z.literal('assistant'),
          content: z.string(),
          toolRounds: z
            .array(
              z.object({
                id: z.string(),
                name: z.string(),
                args: z.record(z.unknown()),
                result: z.string(),
              }),
            )
            .optional(),
        }),
      ]),
    )
    .optional(),
});

const hitlDecisionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('approve') }),
  z.object({
    type: z.literal('edit'),
    editedAction: z.object({ name: z.string(), args: z.record(z.unknown()) }),
  }),
  z.object({ type: z.literal('reject'), message: z.string().optional() }),
]);

/** POST /api/agent/resume のリクエストボディ */
export const agentResumeRequestSchema = z.object({
  threadId: z.string().min(1, 'threadId is required'),
  decisions: z.array(hitlDecisionSchema).min(1, 'decisions array is required'),
  autoApproveThreshold: z
    .number()
    .nonnegative('autoApproveThreshold must be a non-negative number'),
  /** ログ相関用メタデータ（web の Conversation ID）。ロジックでは使わない */
  conversationId: z.string().min(1).max(64).optional(),
});
