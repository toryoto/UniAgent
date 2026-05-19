/**
 * @module tools/evaluate-agent
 * LangChain evaluate_agent ツール定義。
 * エージェント応答を LLM-as-a-Judge で評価し、
 * EAS オフチェーンアテステーションを作成するスタンドアロンツール。
 */

import { tool } from 'langchain';
import { z } from 'zod';
import { logger } from '@agent-marketplace/shared/logger';
import { evaluateAndAttest } from '../services/evaluation.js';
import type { AgentCategory } from '../types/index.js';

// ── Public ────────────────────────────────────────────────────────────────

const evaluateAgentSchema = z.object({
  agentId: z.string().describe('評価対象エージェントのID (16進数文字列)'),
  category: z
    .enum(['research', 'travel', 'general'])
    .describe('エージェントのカテゴリ ("research" | "travel" | "general")'),
  task: z.string().describe('ユーザーが依頼した元のタスク'),
  response: z.string().describe('エージェントが返した応答テキスト'),
  latencyMs: z.number().describe('エージェント応答のレイテンシ（ミリ秒）'),
  paymentTx: z.string().optional().describe('決済トランザクションハッシュ（存在する場合）'),
});

/**
 * evaluate_agent ツール。
 * エージェントの応答品質を LLM Judge で評価し、EAS アテステーションを作成する。
 */
export const evaluateAgentTool = tool(
  async (input: z.infer<typeof evaluateAgentSchema>) => {
    try {
      const result = await evaluateAndAttest({
        agentId: input.agentId,
        category: input.category as AgentCategory,
        task: input.task,
        response: input.response,
        latencyMs: input.latencyMs,
        paymentTx: input.paymentTx,
      });

      return JSON.stringify({
        success: true,
        evaluation: result.evaluation,
        attestation: result.attestation,
      }, null, 2);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.logic.error('evaluate_agent failed', { error: message });
      return JSON.stringify({ success: false, error: message });
    }
  },
  {
    name: 'evaluate_agent',
    description: `エージェントの応答品質を LLM-as-a-Judge で評価し、EASオフチェーンアテステーションを作成します。
出力は常に構造化され、品質・信頼性スコアと EAS の署名メタデータを含みます。`,
    schema: evaluateAgentSchema,
  },
);
