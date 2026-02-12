/**
 * Alchemy Webhook エンドポイント（ERC-8004 コントラクトイベント）
 *
 * 対象イベント:
 *   - Transfer(address,address,uint256)    … ERC-721 mint/transfer
 *   - Registered(uint256,string,address)   … ERC-8004 新規登録
 *   - URIUpdated(uint256,string,address)   … ERC-8004 URI 更新
 *
 * いずれのイベントからも agentId (tokenId) を抽出し、
 * tokenURI → IPFS メタデータ取得 → Prisma upsert を行う
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ethers } from 'ethers';
import { prisma } from '@/lib/db/prisma';
import { CONTRACT_ADDRESSES } from '@/lib/blockchain/config';
import { AGENT_IDENTITY_REGISTRY_ABI } from '@/lib/blockchain/contract';
import {
  getProvider,
  fetchAgentMetadata,
} from '@agent-marketplace/shared';

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
  if (!signingKey) return;

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
    verifyAlchemySignature(rawBody, request.headers.get('x-alchemy-signature'));

    const payload = JSON.parse(rawBody) as unknown;

    const contractAddress = CONTRACT_ADDRESSES.AGENT_IDENTITY_REGISTRY;
    const iface = new ethers.Interface(AGENT_IDENTITY_REGISTRY_ABI as any);
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

      // ERC-721 Transfer: Transfer(address from, address to, uint256 tokenId)
      if (parsed.name === 'Transfer') {
        const tokenId = parsed.args?.tokenId?.toString();
        if (tokenId) agentIds.add(tokenId);
      }

      // ERC-8004 Registered: Registered(uint256 agentId, string agentURI, address owner)
      if (parsed.name === 'Registered') {
        const agentId = parsed.args?.agentId?.toString();
        if (agentId) agentIds.add(agentId);
      }

      // ERC-8004 URIUpdated: URIUpdated(uint256 agentId, string newURI, address updatedBy)
      if (parsed.name === 'URIUpdated') {
        const agentId = parsed.args?.agentId?.toString();
        if (agentId) agentIds.add(agentId);
      }
    }

    let processedCount = 0;
    const errors: Array<{ agentId: string; error: string }> = [];

    const provider = getProvider();
    const contract = new ethers.Contract(contractAddress, AGENT_IDENTITY_REGISTRY_ABI as any, provider);

    for (const agentId of agentIds) {
      try {
        const [tokenURI, owner] = await Promise.all([
          contract.tokenURI(agentId) as Promise<string>,
          contract.ownerOf(agentId) as Promise<string>,
        ]);

        const metadata = await fetchAgentMetadata(tokenURI);
        const a2aService = metadata.services?.find((s) => s.name === 'A2A');

        const agentCard = toJsonSafe({
          agentId,
          name: metadata.name,
          description: metadata.description,
          url: a2aService?.endpoint || '',
          version: a2aService?.version || '1.0.0',
          skills: a2aService?.skills || [],
          owner,
          isActive: metadata.active !== false,
          category: metadata.category || a2aService?.domains?.[0] || '',
          imageUrl: metadata.image,
        });

        await prisma.agentCache.upsert({
          where: { agentId },
          create: {
            agentId,
            owner,
            category: metadata.category || a2aService?.domains?.[0] || '',
            isActive: metadata.active !== false,
            agentCard: agentCard as any,
            lastSyncedBlock: 0,
            lastSyncedLogIdx: 0,
          },
          update: {
            owner,
            category: metadata.category || a2aService?.domains?.[0] || '',
            isActive: metadata.active !== false,
            agentCard: agentCard as any,
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
      contractAddress: contractAddrLower,
      logsFound: logs.length,
      agentIdsFound: agentIds.size,
      processedCount,
      errorsCount: errors.length,
    });

    return NextResponse.json({
      success: true,
      contractAddress: contractAddrLower,
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
