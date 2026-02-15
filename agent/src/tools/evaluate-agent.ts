/**
 * Evaluate Agent Tool (v1.x Optimized)
 * * withStructuredOutput を使用し、LLM-as-a-Judge による評価と
 * EAS オフチェーンアテステーション作成を型安全に行うツール。
 */

import { tool } from 'langchain';
import { initChatModel } from 'langchain';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import {
  getEvaluationPrompt,
  RAW_SCORE_TO_100,
  scaleToUint8,
  type AgentCategory,
} from '../prompts/evaluation-prompt.js';
import { signAndStoreAttestation } from '../services/eas-attestation.js';

/**
 * ツールの入力スキーマ (エージェントの行動ログなど)
 */
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
 * LLM（Judge）が出力すべき構造化データのスキーマ
 * プロンプトで「JSONで出力して」と頼む代わりに、このスキーマをモデルに渡します。
 */
const evaluationResponseSchema = z.object({
  qualityRaw: z.number().int().min(1).max(5).describe('品質スコア (1-5)'),
  reliabilityRaw: z.number().int().min(1).max(5).describe('信頼性スコア (1-5)'),
  tags: z.array(z.string()).describe('評価を特徴づけるタグ (例: "accurate", "fast", "creative")'),
  reasoning: z.string().describe('なぜそのスコアになったかの論理的な推論過程 (Chain of Thought)'),
});

type EvaluateAgentInput = z.infer<typeof evaluateAgentSchema>;


async function evaluateAgentImpl(input: EvaluateAgentInput) {
  const { agentId, category, task, response, latencyMs, paymentTx } = input;

  logger.logic.info('Starting structured agent evaluation', { agentId, category });

  const baseModel = await initChatModel('claude-sonnet-4-5-20250929', {
    temperature: 0,
  });

  // .withStructuredOutput を適用することで、invoke の返り値が自動的に evaluationResponseSchema の型になる
  const evaluationModel = baseModel.withStructuredOutput(evaluationResponseSchema);

  const systemPrompt = getEvaluationPrompt(category as AgentCategory);
  const userPrompt = `
## 評価対象

### ユーザーのタスク
${task}

### エージェントの応答
${response}

上記の内容を、定義された構造に従って厳密に評価してください。`;

  const parsed = await evaluationModel.invoke([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  // 1-5 離散値をアプリ側で 0-100 に変換（LLM による変換誤差を回避）
  const quality100 = parsed.qualityRaw * RAW_SCORE_TO_100;
  const reliability100 = parsed.reliabilityRaw * RAW_SCORE_TO_100;
  const qualityUint8 = scaleToUint8(quality100);
  const reliabilityUint8 = scaleToUint8(reliability100);

  logger.logic.info('Evaluation scores derived from structured output', {
    quality: `${quality100}/100`,
    reliability: `${reliability100}/100`,
    tags: parsed.tags,
  });

  // 3. EAS オフチェーンアテステーション署名 + DB 保存
  const { attestation, dbRecord } = await signAndStoreAttestation({
    agentId,
    paymentTx,
    quality: qualityUint8,
    reliability: reliabilityUint8,
    latency: Math.min(latencyMs, 4294967295), // uint32 上限
    tags: parsed.tags,
    reasoning: parsed.reasoning,
  });

  logger.logic.success('Evaluation and attestation completed', {
    agentId,
    dbRecordId: dbRecord.id,
  });

  return {
    success: true,
    evaluation: {
      quality: quality100,
      reliability: reliability100,
      qualityUint8,
      reliabilityUint8,
      tags: parsed.tags,
      reasoning: parsed.reasoning,
    },
    attestation: {
      id: dbRecord.id,
      schemaUid: dbRecord.schemaUid,
      signed: true,
      attester: dbRecord.attester,
    },
  };
}

/**
 * ツールとして公開
 */
export const evaluateAgentTool = tool(
  async (input: EvaluateAgentInput) => {
    try {
      const result = await evaluateAgentImpl(input);
      return JSON.stringify(result, null, 2);
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
  }
);