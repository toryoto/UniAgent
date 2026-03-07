/**
 * Alchemy Webhook エンドポイント（ERC-8004 + AgentStaking コントラクトイベント）
 *
 * ERC-8004 対象イベント:
 *   - Transfer(address,address,uint256)    … ERC-721 mint/transfer
 *   - Registered(uint256,string,address)   … ERC-8004 新規登録
 *   - URIUpdated(uint256,string,address)   … ERC-8004 URI 更新
 *
 * AgentStaking 対象イベント:
 *   - Staked(uint256,address,uint256,uint256)
 *   - Unstaked(uint256,address,uint256,uint256)
 *   - UnstakeRequested(uint256,uint256,uint256)
 *   - UnstakeCancelled(uint256)
 *   - Slashed(uint256,uint256,string)
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ethers } from 'ethers';
import { upsertAgentCache } from '@/lib/db/agent-cache';
import { upsertAgentStake } from '@/lib/db/agent-stakes';
import { CONTRACT_ADDRESSES } from '@/lib/blockchain/config';
import { AGENT_IDENTITY_REGISTRY_ABI } from '@/lib/blockchain/contract';
import {
  getProvider,
  fetchAgentMetadata,
  fetchPaymentFromAgentEndpoint,
  AGENT_STAKING_ABI,
} from '@agent-marketplace/shared';

export const runtime = 'nodejs';

type CandidateLog = { address?: string; data: string; topics: string[]; removed?: boolean };

function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

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

      if (parsed.name === 'Transfer') {
        const tokenId = parsed.args?.tokenId?.toString();
        if (tokenId) agentIds.add(tokenId);
      }

      if (parsed.name === 'Registered') {
        const agentId = parsed.args?.agentId?.toString();
        if (agentId) agentIds.add(agentId);
      }

      if (parsed.name === 'URIUpdated') {
        const agentId = parsed.args?.agentId?.toString();
        if (agentId) agentIds.add(agentId);
      }
    }

    // ── ERC-8004 Identity Registry: メタデータ同期 ──
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
        const category = metadata.category ?? a2aService?.domains?.[0] ?? '';
        const isActive = metadata.active !== false;

        let agentCardObj: Record<string, unknown> = { ...metadata };
        if (a2aService?.endpoint) {
          const payment = await fetchPaymentFromAgentEndpoint(a2aService.endpoint);
          if (payment?.pricePerCall) {
            agentCardObj = { ...metadata, payment };
          }
        }

        const agentCard = toJsonSafe(agentCardObj);

        await upsertAgentCache({
          agentId,
          owner,
          category,
          isActive,
          agentCard: agentCard as object,
        });
        processedCount++;
      } catch (e) {
        errors.push({ agentId, error: e instanceof Error ? e.message : String(e) });
      }
    }

    // ── AgentStaking: ステーク状態同期 ──
    const stakingContractAddr = CONTRACT_ADDRESSES.AGENT_STAKING;
    const stakingAgentIds = new Set<string>();

    if (stakingContractAddr) {
      const stakingIface = new ethers.Interface(AGENT_STAKING_ABI as any);
      const stakingAddrLower = stakingContractAddr.toLowerCase();
      const stakingEventNames = ['Staked', 'Unstaked', 'UnstakeRequested', 'UnstakeCancelled', 'Slashed'];

      for (const log of logs) {
        if (log.removed) continue;
        if (log.address && log.address.toLowerCase() !== stakingAddrLower) continue;
        if (!log.topics?.length) continue;

        let parsed: ethers.LogDescription | null = null;
        try {
          parsed = stakingIface.parseLog({ topics: log.topics, data: log.data });
        } catch {
          continue;
        }
        if (!parsed) continue;

        if (stakingEventNames.includes(parsed.name)) {
          const id = parsed.args?.agentId?.toString();
          if (id) stakingAgentIds.add(id);
        }
      }
    }

    let stakingProcessedCount = 0;
    const stakingErrors: Array<{ agentId: string; error: string }> = [];

    if (stakingAgentIds.size > 0 && stakingContractAddr) {
      const stakingContract = new ethers.Contract(
        stakingContractAddr,
        AGENT_STAKING_ABI as any,
        provider
      );

      for (const agentId of stakingAgentIds) {
        try {
          const [stakeRaw, unstakeRequestRaw] = await Promise.all([
            stakingContract.getStake(agentId) as Promise<bigint>,
            stakingContract.unstakeRequests(agentId) as Promise<[bigint, bigint]>,
          ]);

          const stakedAmount = Number(stakeRaw) / 1_000_000;
          const unstakeRequestAmount = Number(unstakeRequestRaw[0]) / 1_000_000;
          const unstakeAvailableAtUnix = Number(unstakeRequestRaw[1]);
          const unstakeAvailableAt =
            unstakeAvailableAtUnix > 0 ? new Date(unstakeAvailableAtUnix * 1000) : null;

          await upsertAgentStake({
            agentId,
            stakedAmount,
            unstakeRequestAmount,
            unstakeAvailableAt,
          });
          stakingProcessedCount++;
        } catch (e) {
          stakingErrors.push({ agentId, error: e instanceof Error ? e.message : String(e) });
        }
      }
    }

    console.log('[Alchemy Webhook] Summary', {
      identity: {
        contractAddress: contractAddrLower,
        agentIdsFound: agentIds.size,
        processedCount,
        errorsCount: errors.length,
      },
      staking: {
        agentIdsFound: stakingAgentIds.size,
        processedCount: stakingProcessedCount,
        errorsCount: stakingErrors.length,
      },
      logsFound: logs.length,
    });

    return NextResponse.json({
      success: true,
      logsFound: logs.length,
      identity: {
        contractAddress: contractAddrLower,
        agentIdsFound: agentIds.size,
        processedCount,
        errors,
      },
      staking: {
        agentIdsFound: stakingAgentIds.size,
        processedCount: stakingProcessedCount,
        errors: stakingErrors,
      },
    });
  } catch (error) {
    console.error('[Alchemy Webhook] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
