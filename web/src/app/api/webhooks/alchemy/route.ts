/**
 * Alchemy Webhook エンドポイント（コントラクトイベント）
 *
 * - AgentRegistry の AgentRegistered / AgentUpdated を受信
 * - event log から agentId を抽出
 * - getAgentCard(agentId) でオンチェーンの完全データを取得
 * - Prisma に JSON（BigIntは文字列化）で upsert
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ethers } from 'ethers';
import { prisma } from '@/lib/db/prisma';
import { CONTRACT_ADDRESSES } from '@/lib/blockchain/config';
import { AGENT_REGISTRY_ABI, getAgentCard } from '@/lib/blockchain/contract';

export const runtime = 'nodejs';

type CandidateLog = { address?: string; data: string; topics: string[]; removed?: boolean };

function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Alchemy Webhook 署名検証（HMAC-SHA256）
 */
function verifyAlchemySignature(rawBody: string, signatureHeader: string | null) {
  const signingKey = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY;
  if (!signingKey) return; // キー未設定なら検証しない

  // Header: X-Alchemy-Signature: <hex>
  if (!signatureHeader) throw new Error('Missing X-Alchemy-Signature');

  const signature = signatureHeader.trim().replace(/^sha256=/i, '');
  if (!/^[0-9a-f]{64}$/i.test(signature)) throw new Error('Invalid X-Alchemy-Signature format');

  const expectedHex = crypto.createHmac('sha256', signingKey).update(rawBody, 'utf8').digest('hex');
  if (!timingSafeEqualHex(expectedHex, signature)) throw new Error('Invalid X-Alchemy-Signature');
}

function extractLogs(value: unknown, out: CandidateLog[]) {
  if (!value) return;
  if (Array.isArray(value)) return value.forEach((v) => extractLogs(v, out));
  if (typeof value !== 'object') return;

  const obj = value as any;
  if (
    typeof obj.data === 'string' &&
    Array.isArray(obj.topics) &&
    obj.topics.every((t: any) => typeof t === 'string')
  ) {
    const address: string | undefined =
      typeof obj.address === 'string'
        ? obj.address
        : typeof obj?.account?.address === 'string'
          ? obj.account.address
          : undefined;
    out.push({
      address,
      data: obj.data,
      topics: obj.topics,
      removed: typeof obj.removed === 'boolean' ? obj.removed : undefined,
    });
  }
  Object.values(obj).forEach((v) => extractLogs(v, out));
}

function toJsonSafe<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // WebhookからのリクエストHeaderはX-Alchemy-Signatureで受け取る
    verifyAlchemySignature(rawBody, request.headers.get('x-alchemy-signature'));

    const payload = JSON.parse(rawBody) as unknown;

    const contractAddress = CONTRACT_ADDRESSES.AGENT_REGISTRY;

    const iface = new ethers.Interface(AGENT_REGISTRY_ABI as any);
    const logs: CandidateLog[] = [];
    extractLogs(payload, logs);

    const contractAddrLower = contractAddress.toLowerCase();
    const agentIds = new Set<string>();

    for (const log of logs) {
      if (log.removed) continue;
      if (log.address && log.address.toLowerCase() !== contractAddrLower) continue;
      if (!log.topics?.length) continue;

      let parsed: ethers.LogDescription | null = null;
      try {
        parsed = iface.parseLog({ topics: log.topics, data: log.data });
      } catch {
        // ignore
      }
      if (!parsed) continue;
      if (parsed.name !== 'AgentRegistered' && parsed.name !== 'AgentUpdated') continue;

      const agentId = (parsed.args as any)?.agentId ?? (parsed.args as any)?.[0];
      if (typeof agentId === 'string' && agentId.startsWith('0x')) agentIds.add(agentId);
    }

    let processedCount = 0;
    const errors: Array<{ agentId: string; error: string }> = [];

    for (const agentId of agentIds) {
      try {
        const agentCard = await getAgentCard(agentId);
        const agentCardJson = toJsonSafe(agentCard);

        await prisma.agentCache.upsert({
          where: { agentId },
          create: {
            agentId,
            owner: agentCard.owner,
            category: agentCard.category,
            isActive: agentCard.isActive,
            agentCard: agentCardJson as any,
            lastSyncedBlock: 0,
            lastSyncedLogIdx: 0,
          },
          update: {
            owner: agentCard.owner,
            category: agentCard.category,
            isActive: agentCard.isActive,
            agentCard: agentCardJson as any,
            lastSyncedBlock: 0,
            lastSyncedLogIdx: 0,
          },
        });
        processedCount++;
      } catch (e) {
        errors.push({ agentId, error: e instanceof Error ? e.message : String(e) });
      }
    }

    console.log('[Alchemy Webhook] Summary', {
      contractAddress: contractAddress.toLowerCase(),
      logsFound: logs.length,
      agentIdsFound: agentIds.size,
      processedCount,
      errorsCount: errors.length,
    });

    return NextResponse.json({
      success: true,
      contractAddress: contractAddress.toLowerCase(),
      logsFound: logs.length,
      agentIdsFound: agentIds.size,
      processedCount,
      errors,
    });
  } catch (error) {
    console.error('[Alchemy Webhook] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
