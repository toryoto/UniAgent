/**
 * @module tools/execute-and-evaluate-agent
 * LangChain execute_and_evaluate_agent ツール定義。
 * execute_agent + evaluate_agent を統合し、1 回の呼び出しで
 * 「実行 → tx 検証 → 評価 → EAS 署名」を完結させる。
 * HITL ミドルウェアの対象ツール。
 */

import { tool } from 'langchain';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { executeAgentTool } from './execute-agent.js';
import { evaluateAndAttest } from '../services/evaluation.js';
import { verifyX402TransactionHash } from '../lib/payment/verify-tx.js';
import type { AgentCategory } from '../types/index.js';

// ── Public ────────────────────────────────────────────────────────────────

const executeAndEvaluateSchema = z
  .object({
    agentId: z.string().describe('エージェントID (16進数文字列。discover_agents の結果から取得)'),
    category: z
      .enum(['research', 'travel', 'general'])
      .describe('エージェントのカテゴリ'),
    task: z
      .string()
      .optional()
      .describe('自然言語テキスト（A2A TextPart）。テキスト入力を受け付けるエージェント向け。'),
    data: z
      .record(z.unknown())
      .optional()
      .describe(
        '構造化パラメータ（A2A DataPart）。fetch_agent_spec の inputSchema / OpenAPI に基づいて構築。',
      ),
    maxPrice: z.number().describe('許容する最大価格 (USDC)'),
    requireUserApproval: z
      .boolean()
      .optional()
      .describe(
        'true にすると、autoApproveThreshold 以下でも承認画面を表示する。' +
        'ユーザーが確認を求めている場合や、意図が曖昧で誤実行リスクが高い場合に設定する。',
      ),
    walletId: z.string().describe('Privy ウォレット ID'),
    walletAddress: z.string().describe('ウォレットアドレス (0x...)'),
  })
  .refine((d) => d.task || (d.data && Object.keys(d.data).length > 0), {
    message: 'task または data の少なくとも一方が必要です',
  });

type ExecuteAndEvaluateInput = z.infer<typeof executeAndEvaluateSchema>;

/**
 * execute_and_evaluate_agent ツール。
 * 外部エージェントを実行し、応答品質を自動評価して EAS アテステーションを作成する。
 */
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
- agentId: エージェントID（discover_agents の結果から取得。Base URL はサーバーが AgentCache から解決）
- category: エージェントカテゴリ ("research" | "travel" | "general")
- task: 自然言語テキスト（A2A TextPart、省略可）
- data: 構造化パラメータ（A2A DataPart、省略可）。fetch_agent_spec の inputSchema に基づいて構築
- ※ task と data は少なくとも一方が必須。エージェント仕様に応じて必要な方だけ渡す。
- maxPrice: 許容する最大価格 (USDC)
- requireUserApproval: true で承認画面を強制（省略時は false。ユーザーが確認を求めた場合や誤実行リスクが高い場合に使う）
- walletId: Privy ウォレット ID
- walletAddress: ウォレットアドレス (0x...)

【出力】
- result: 外部エージェントの応答
- paymentAmount / transactionHash: 決済情報
- latencyMs: 実行時間（ミリ秒）
- evaluation: { quality, reliability, tags, reasoning } (失敗時は null)
- attestation: { id, schemaUid, signed, attester } (失敗時は null)`,
    schema: executeAndEvaluateSchema,
  },
);

// ── Private ───────────────────────────────────────────────────────────────

async function executeAndEvaluateImpl(input: ExecuteAndEvaluateInput) {
  const { agentId, category, task, data, maxPrice, walletId, walletAddress } = input;

  logger.eval.info('Execute & Evaluate started', { agentId, hasData: !!data });

  const startTime = Date.now();

  const executeResultRaw = await executeAgentTool.invoke({
    agentId,
    ...(task ? { task } : {}),
    ...(data ? { data } : {}),
    maxPrice,
    walletId,
    walletAddress,
  });

  const latencyMs = Date.now() - startTime;
  const executeResult = JSON.parse(executeResultRaw);

  logger.eval.info('Execution finished', { success: executeResult.success, latencyMs });

  if (!executeResult.success) {
    return { success: false, error: executeResult.error, latencyMs };
  }

  // シビル攻撃対策: x402 txHash のオンチェーン検証 + リプレイ検出
  const txHash = executeResult.transactionHash;
  const isPaymentVerified =
    txHash !== undefined &&
    txHash !== '' &&
    (await verifyX402TransactionHash({ txHash, agentId, amount: executeResult.paymentAmount ?? 0, walletId }));

  if (!isPaymentVerified) {
    logger.eval.warn('Skipping evaluation: x402 txHash invalid or missing (Sybil protection)', {
      hasTxHash: !!txHash,
      txHash: txHash ?? '(none)',
    });
  }

  let evaluation = null;
  let attestation = null;

  if (isPaymentVerified) {
    try {
      const responseText =
        typeof executeResult.result === 'string'
          ? executeResult.result
          : JSON.stringify(executeResult.result);

      const taskDescription = task ?? `構造化リクエスト: ${JSON.stringify(data)}`;

      const result = await evaluateAndAttest({
        agentId,
        category: category as AgentCategory,
        task: taskDescription,
        response: responseText,
        latencyMs,
        paymentTx: executeResult.transactionHash,
      });

      evaluation = {
        quality: result.evaluation.quality,
        reliability: result.evaluation.reliability,
        tags: result.evaluation.tags,
        reasoning: result.evaluation.reasoning,
      };
      attestation = result.attestation;
    } catch (evalError) {
      const message = evalError instanceof Error ? evalError.message : 'Unknown evaluation error';
      logger.eval.error('Evaluation failed but execution succeeded', { error: message });
    }
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
