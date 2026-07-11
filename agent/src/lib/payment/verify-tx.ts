/**
 * @module lib/payment/verify-tx
 * x402 決済トランザクションのオンチェーン検証とリプレイ攻撃防止。
 * シビル攻撃対策として、tx が有効かつ未使用であることを保証する。
 */

import { ethers } from 'ethers';
import { prisma } from '@agent-marketplace/database';
import { CHAIN_ID } from '../../config/constants.js';
import { createLogger } from '@agent-marketplace/shared/logger';

const log = createLogger('eval');
import type { VerifyX402TxInput } from '../../types/index.js';

/** 0x + 64文字の16進数 (32バイトハッシュ) */
const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

/**
 * x402 決済の txHash をオンチェーン + リプレイチェックで検証する。
 * 検証通過時は Transaction テーブルに保存し、二重使用を防止する。
 *
 * @param input - 検証に必要な txHash, agentId, amount, walletId
 * @returns 検証成功なら true、失敗またはスキップなら false
 */
export async function verifyX402TransactionHash(input: VerifyX402TxInput): Promise<boolean> {
  const { txHash, agentId, amount, walletId } = input;
  if (!txHash || typeof txHash !== 'string') {
    log.warn({ txHash }, 'TxHash verification skipped: empty or invalid type');
    return false;
  }

  const normalizedHash = txHash.startsWith('0x') ? txHash : `0x${txHash}`;
  if (!TX_HASH_REGEX.test(normalizedHash)) {
    log.warn({ txHash: normalizedHash }, 'TxHash verification failed: invalid format');
    return false;
  }

  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    log.error('TxHash verification failed: RPC_URL not configured');
    return false;
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const receipt = await provider.getTransactionReceipt(normalizedHash);

    if (!receipt) {
      log.warn({ txHash: normalizedHash }, 'TxHash verification failed: transaction not found on-chain');
      return false;
    }

    if (receipt.status !== 1) {
      log.warn({ txHash: normalizedHash }, 'TxHash verification failed: transaction reverted');
      return false;
    }

    const network = await provider.getNetwork();
    if (Number(network.chainId) !== CHAIN_ID) {
      log.warn({ txHash: normalizedHash, expectedChainId: CHAIN_ID }, 'TxHash verification failed: chain mismatch');
      return false;
    }

    const existing = await prisma.transaction.findUnique({
      where: { txHash: normalizedHash },
    });
    if (existing) {
      log.warn({ txHash: normalizedHash }, 'TxHash verification failed: replay attack (already used)');
      return false;
    }

    await prisma.transaction.create({
      data: {
        txHash: normalizedHash,
        agentId,
        amount,
        walletId,
        status: 'SUCCESS',
      },
    });

    log.info({ txHash: normalizedHash, blockNumber: receipt.blockNumber }, 'TxHash verified and recorded');
    return true;
  } catch (err) {
    log.error({ err, txHash: normalizedHash }, 'TxHash verification error');
    return false;
  }
}
