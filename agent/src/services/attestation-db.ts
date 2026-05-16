/**
 * @module services/attestation-db
 * EAS オフチェーンアテステーションの DB 保存・取得レイヤー。
 */

import { prisma } from '@agent-marketplace/database';
import type { CreateAttestationInput } from '../types/index.js';

/**
 * EAS アテステーションレコードを DB に保存する。
 *
 * @param input - 保存するアテステーションデータ
 * @returns 作成された DB レコード
 */
export async function createAttestation(input: CreateAttestationInput) {
  return prisma.easAttestation.create({ data: input });
}

/**
 * 指定エージェントのアテステーション一覧を取得する。
 *
 * @param agentId - エージェント ID
 * @returns 作成日時降順のアテステーション配列
 */
export async function getAttestationsByAgent(agentId: string) {
  return prisma.easAttestation.findMany({
    where: { agentId },
    orderBy: { createdAt: 'desc' },
  });
}
