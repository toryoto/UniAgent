/**
 * @module services/evaluation
 * LLM-as-a-Judge による評価 + EAS アテステーション署名・保存の統合サービス。
 * execute-and-evaluate-agent ツールの評価ロジックを一元化する。
 */

import { initChatModel } from 'langchain';
import { z } from 'zod';
import { logger } from '@agent-marketplace/shared/logger';
import { AGENT_MODEL } from '../config/constants.js';
import { getEvaluationPrompt, RAW_SCORE_TO_100, scaleToUint8 } from '../prompts/evaluation-prompt.js';
import { signAndStoreAttestation } from './eas-attestation.js';
import type { AgentCategory, EvaluationScores, EvaluationWithAttestation } from '../types/index.js';

/**
 * LLM Judge の構造化出力スキーマ。
 * 各ツールが独自に定義していたものを統一。
 */
const evaluationResponseSchema = z.object({
  qualityRaw: z.number().int().min(1).max(5).describe('品質スコア (1-5)'),
  reliabilityRaw: z.number().int().min(1).max(5).describe('信頼性スコア (1-5)'),
  tags: z.array(z.string()).describe('評価を特徴づけるタグ'),
  reasoning: z.string().describe('Chain of Thought による推論過程'),
});

export interface EvaluateAndAttestInput {
  agentId: string;
  category: AgentCategory;
  task: string;
  response: string;
  latencyMs: number;
  paymentTx?: string;
}

// ── Public ────────────────────────────────────────────────────────────────

/**
 * エージェント応答を LLM Judge で評価し、EAS アテステーションとして署名・DB 保存する。
 *
 * フロー:
 * 1. LLM (Claude) に withStructuredOutput で品質・信頼性を 1-5 で評価させる
 * 2. 1-5 スコアを 0-100 / uint8 に変換
 * 3. signAndStoreAttestation でオフチェーン署名 + DB 保存
 *
 * @param input - 評価に必要なエージェント情報・タスク・応答・レイテンシ
 * @returns 評価スコアとアテステーション情報
 * @throws LLM 呼び出しまたはアテステーション署名の失敗
 */
export async function evaluateAndAttest(input: EvaluateAndAttestInput): Promise<EvaluationWithAttestation> {
  const { agentId, category, task, response, latencyMs, paymentTx } = input;

  logger.eval.info('Starting structured agent evaluation', { agentId, category });

  const baseModel = await initChatModel(AGENT_MODEL, { temperature: 0 });
  const evaluationModel = baseModel.withStructuredOutput(evaluationResponseSchema);

  const systemPrompt = getEvaluationPrompt(category);
  const userPrompt = buildEvaluationUserPrompt(task, response);

  const parsed = await evaluationModel.invoke([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  const quality100 = parsed.qualityRaw * RAW_SCORE_TO_100;
  const reliability100 = parsed.reliabilityRaw * RAW_SCORE_TO_100;
  const qualityUint8 = scaleToUint8(quality100);
  const reliabilityUint8 = scaleToUint8(reliability100);

  logger.eval.info('Evaluation scores', {
    quality: `${quality100}/100`,
    reliability: `${reliability100}/100`,
    latencyMs,
    tags: parsed.tags,
  });

  const { dbRecord } = await signAndStoreAttestation({
    agentId,
    paymentTx,
    quality: qualityUint8,
    reliability: reliabilityUint8,
    latency: Math.min(latencyMs, 4294967295),
    tags: parsed.tags,
    reasoning: parsed.reasoning,
  });

  logger.eval.success('Evaluation and attestation completed', {
    agentId,
    dbRecordId: dbRecord.id,
  });

  return {
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

// ── Private ───────────────────────────────────────────────────────────────

function buildEvaluationUserPrompt(task: string, response: string): string {
  return `## 評価対象

### ユーザーのタスク
${task}

### エージェントの応答
${response}

上記の内容を、定義された構造に従って厳密に評価してください。`;
}
