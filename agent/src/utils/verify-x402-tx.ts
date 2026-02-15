/**
 * x402 Transaction Hash 検証ユーティリティ
 *
 * シビル・リプレイ攻撃対策:
 * - オンチェーンで有効か検証
 * - Transaction テーブルでリプレイ検出（二重使用を防止）
 */

import { ethers } from 'ethers';
import { prisma } from '@agent-marketplace/database';
import { CHAIN_ID } from '../tools/constants.js';
import { logger } from './logger.js';

/** 0x + 64文字の16進数 (32バイトハッシュ) */
const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

export interface VerifyX402TxInput {
  txHash: string;
  agentId: string;
  amount: number;
  walletId: string;
}

/**
 * x402決済のtxHashを検証する（オンチェーン + リプレイチェック）
 *
 * 検証通過時は Transaction に保存して二重使用を防止する。
 */
export async function verifyX402TransactionHash(input: VerifyX402TxInput): Promise<boolean> {
  const { txHash, agentId, amount, walletId } = input;
  if (!txHash || typeof txHash !== 'string') {
    logger.eval.warn('TxHash verification skipped: empty or invalid type', { txHash });
    return false;
  }

  const normalizedHash = txHash.startsWith('0x') ? txHash : `0x${txHash}`;
  if (!TX_HASH_REGEX.test(normalizedHash)) {
    logger.eval.warn('TxHash verification failed: invalid format', {
      txHash: normalizedHash,
    });
    return false;
  }

  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    logger.eval.error('TxHash verification failed: RPC_URL not configured');
    return false;
  }

  try {
    // 1. オンチェーン検証
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const receipt = await provider.getTransactionReceipt(normalizedHash);

    if (!receipt) {
      logger.eval.warn('TxHash verification failed: transaction not found on-chain', {
        txHash: normalizedHash,
      });
      return false;
    }

    if (receipt.status !== 1) {
      logger.eval.warn('TxHash verification failed: transaction reverted', {
        txHash: normalizedHash,
      });
      return false;
    }

    const network = await provider.getNetwork();
    if (Number(network.chainId) !== CHAIN_ID) {
      logger.eval.warn('TxHash verification failed: chain mismatch', {
        txHash: normalizedHash,
        expectedChainId: CHAIN_ID,
      });
      return false;
    }

    // 2. リプレイ検出: 既に保存済みなら二重使用
    const existing = await prisma.transaction.findUnique({
      where: { txHash: normalizedHash },
    });
    if (existing) {
      logger.eval.warn('TxHash verification failed: replay attack (already used)', {
        txHash: normalizedHash,
      });
      return false;
    }

    // 3. Transaction に保存して二重使用を防止
    await prisma.transaction.create({
      data: {
        txHash: normalizedHash,
        agentId,
        amount,
        walletId,
        status: 'SUCCESS',
      },
    });

    logger.eval.info('TxHash verified and recorded', {
      txHash: normalizedHash,
      blockNumber: receipt.blockNumber,
    });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.eval.error('TxHash verification error', { txHash: normalizedHash, error: message });
    return false;
  }
}
