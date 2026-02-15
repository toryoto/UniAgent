/**
 * Attestation DB Service
 *
 * EAS オフチェーンアテステーションの DB 保存・取得
 */

import { prisma } from '@agent-marketplace/database';
import type { Prisma } from '@agent-marketplace/database';

export interface CreateAttestationInput {
  agentId: string;
  schemaUid: string;
  attestation: Prisma.InputJsonValue;
  attester: string;
  paymentTx?: string;
  chainId: number;
  quality: number;
  reliability: number;
  latency: number;
  tags: string[];
  reasoning?: string;
}

export async function createAttestation(input: CreateAttestationInput) {
  return prisma.easAttestation.create({ data: input });
}

export async function getAttestationsByAgent(agentId: string) {
  return prisma.easAttestation.findMany({
    where: { agentId },
    orderBy: { createdAt: 'desc' },
  });
}
