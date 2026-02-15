/**
 * Execute & Evaluate Agent Tool
 *
 * execute_agent + evaluate_agent を統合、
 * メインエージェントはこのツール 1 回の呼び出しで「実行→評価→署名」を完結できる。
 */

import { tool } from 'langchain';
import { initChatModel } from 'langchain';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { executeAgentTool } from './execute-agent.js';
import {
  getEvaluationPrompt,
  scaleToUint8,
  type AgentCategory,
} from '../prompts/evaluation-prompt.js';
import { signAndStoreAttestation } from '../services/eas-attestation.js';

/**
 * LLM Judge の構造化出力スキーマ
 */
const evaluationResponseSchema = z.object({
  quality: z.number().min(0).max(100).describe('応答の正確性と有用性 (0-100)'),
  reliability: z.number().min(0).max(100).describe('指示への忠実度と一貫性 (0-100)'),
  tags: z.array(z.string()).describe('評価を特徴づけるタグ'),
  reasoning: z.string().describe('Chain of Thought による推論過程'),
});

const executeAndEvaluateSchema = z.object({
  agentId: z.string().describe('エージェントID (16進数文字列。discover_agents の結果から取得)'),
  category: z
    .enum(['research', 'travel', 'general'])
    .describe('エージェントのカテゴリ'),
  agentUrl: z.string().describe('エージェントのBase URL'),
  task: z.string().describe('エージェントに依頼するタスク'),
  maxPrice: z.number().describe('許容する最大価格 (USDC)'),
  walletId: z.string().describe('Privy ウォレット ID'),
  walletAddress: z.string().describe('ウォレットアドレス (0x...)'),
});

type ExecuteAndEvaluateInput = z.infer<typeof executeAndEvaluateSchema>;

async function executeAndEvaluateImpl(input: ExecuteAndEvaluateInput) {
  const { agentId, category, agentUrl, task, maxPrice, walletId, walletAddress } = input;

  // ── 1. Execute AI Agent ──────────────────────────────────────
  logger.eval.info('Execute & Evaluate started', { agentId, agentUrl });

  const startTime = Date.now();

  const executeResultRaw = await executeAgentTool.invoke({
    agentUrl,
    task,
    maxPrice,
    walletId,
    walletAddress,
  });

  const latencyMs = Date.now() - startTime;
  const executeResult = JSON.parse(executeResultRaw);

  logger.eval.info('Execution finished', {
    success: executeResult.success,
    latencyMs,
  });
  // 実行失敗なら評価せずに返す
  if (!executeResult.success) {
    return {
      success: false,
      error: executeResult.error,
      latencyMs,
    };
  }

  // ── 2. Evaluate & Attestation ──────────
  let evaluation = null;
  let attestation = null;

  try {
    const responseText =
      typeof executeResult.result === 'string'
        ? executeResult.result
        : JSON.stringify(executeResult.result);

    const baseModel = await initChatModel('claude-sonnet-4-5-20250929', {
      temperature: 0,
    });
    const evaluationModel = baseModel.withStructuredOutput(evaluationResponseSchema);

    const systemPrompt = getEvaluationPrompt(category as AgentCategory);
    const userPrompt = `## 評価対象

### ユーザーのタスク
${task}

### エージェントの応答
${responseText}

上記の内容を、定義された構造に従って厳密に評価してください。`;

    const parsed = await evaluationModel.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const quality100 = Math.min(100, Math.max(0, parsed.quality));
    const reliability100 = Math.min(100, Math.max(0, parsed.reliability));
    const qualityUint8 = scaleToUint8(quality100);
    const reliabilityUint8 = scaleToUint8(reliability100);

    logger.eval.info('Evaluation scores', {
      quality: `${quality100}/100`,
      reliability: `${reliability100}/100`,
      latencyMs,
      tags: parsed.tags,
    });

    // ── 3. EAS Attestation ─────────────────────────────
    const { dbRecord } = await signAndStoreAttestation({
      agentId,
      paymentTx: executeResult.transactionHash,
      quality: qualityUint8,
      reliability: reliabilityUint8,
      latency: Math.min(latencyMs, 4294967295),
      tags: parsed.tags,
      reasoning: parsed.reasoning,
    });

    logger.eval.success('Attestation created', { attestationId: dbRecord.id });

    // 成功時のみ値をセット
    evaluation = {
      quality: quality100,
      reliability: reliability100,
      tags: parsed.tags,
      reasoning: parsed.reasoning,
    };
    attestation = {
      id: dbRecord.id,
      schemaUid: dbRecord.schemaUid,
      signed: true,
      attester: dbRecord.attester,
    };

  } catch (evalError) {
    // 評価または署名に失敗した場合でも、実行結果はユーザーに返すためエラーを握り潰す
    const message = evalError instanceof Error ? evalError.message : 'Unknown evaluation error';
    logger.eval.error('Evaluation failed but execution succeeded', { error: message });
  }

  return {
    success: true,
    result: executeResult.result,
    paymentAmount: executeResult.paymentAmount,
    transactionHash: executeResult.transactionHash,
    latencyMs,
    evaluation,
    attestation,
  };
}

export const executeAndEvaluateAgentTool = tool(
  async (input: ExecuteAndEvaluateInput) => {
    try {
      const result = await executeAndEvaluateImpl(input);
      return JSON.stringify(result, null, 2);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.eval.error('execute_and_evaluate_agent failed', { error: message });
      return JSON.stringify({ success: false, error: message });
    }
  },
  {
    name: 'execute_and_evaluate_agent',
    description: `外部エージェントを実行し、応答品質を自動評価してEASアテステーションを作成する統合ツールです。

【処理フロー】
1. execute_agent: x402決済付きで外部エージェントを実行（実行時間を計測）
2. evaluate_agent: LLM-as-a-Judge で応答品質を評価（Quality / Reliability）
3. EAS署名: 評価結果をオフチェーンアテステーションとして署名・DB保存

【入力】
- agentId: エージェントID（discover_agents の結果から取得）
- category: エージェントカテゴリ ("research" | "travel" | "general")
- agentUrl: エージェントのBase URL
- task: エージェントに依頼するタスク
- maxPrice: 許容する最大価格 (USDC)
- walletId: Privy ウォレット ID
- walletAddress: ウォレットアドレス (0x...)

【出力】
- result: 外部エージェントの応答
- paymentAmount / transactionHash: 決済情報
- latencyMs: 実行時間（ミリ秒）
- evaluation: { quality, reliability, tags, reasoning } (失敗時は null)
- attestation: { id, schemaUid, signed, attester } (失敗時は null)`,
    schema: executeAndEvaluateSchema,
  }
);
