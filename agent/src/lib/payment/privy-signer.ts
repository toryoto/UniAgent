/**
 * @module lib/payment/privy-signer
 * Privy delegated wallet を使用した EIP-712 署名アダプター。
 * x402/evm が期待する ClientEvmSigner インターフェースに適合する。
 */

import type { Hex, TypedDataDefinition } from 'viem';
import { PrivyClient } from '@privy-io/server-auth';
import { logger } from '../../utils/logger.js';

/**
 * Privy ベースの EIP-712 署名アダプター。
 *
 * 前提条件:
 * 1. ユーザーがクライアント側でウォレットを委譲済み (delegateWallet)
 * 2. サーバーに PRIVY_AUTHORIZATION_KEY が設定済み
 */
export class PrivyEIP712Signer {
  public address: `0x${string}`;

  constructor(
    private privyClient: PrivyClient,
    private walletId: string,
    walletAddress: string,
  ) {
    this.address = walletAddress as `0x${string}`;
  }

  /**
   * EIP-712 署名を作成する。
   * x402/evm はこのメソッドを呼び出して決済署名を生成する。
   *
   * @param typedData - EIP-712 TypedData 定義
   * @returns 署名済みの Hex 文字列
   * @throws Privy API エラー（認証失敗、委譲未完了など）
   */
  async signTypedData(typedData: TypedDataDefinition): Promise<Hex> {
    logger.payment.info('Signing EIP-712 typed data via Privy delegated wallet', {
      walletId: this.walletId,
      walletAddress: this.address,
      primaryType: typedData.primaryType,
    });

    try {
      const serializedTypedData = this.serializeTypedData(typedData);

      const result = await this.privyClient.walletApi.ethereum.signTypedData({
        walletId: this.walletId,
        typedData: serializedTypedData as any,
      });

      logger.payment.success('EIP-712 signature created via delegated wallet', {
        signature: `${result.signature.slice(0, 10)}...`,
        walletId: this.walletId,
      });

      return result.signature as Hex;
    } catch (error) {
      this.handleSignError(error);
      throw error;
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────

  /**
   * TypedDataDefinition を Privy API 用にシリアライズする。
   * BigInt 値を文字列に変換して JSON 化可能にする。
   */
  private serializeTypedData(typedData: TypedDataDefinition): unknown {
    return JSON.parse(
      JSON.stringify(typedData, (_, value) => {
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      }),
    );
  }

  /**
   * 署名エラーを種別ごとにログ出力する。
   */
  private handleSignError(error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown';

    if (errorMessage.includes('authorization')) {
      logger.payment.error(
        'Authorization key error - check if PRIVY_AUTHORIZATION_KEY is set correctly',
        { error: errorMessage, walletId: this.walletId },
      );
    } else if (errorMessage.includes('delegated') || errorMessage.includes('permission')) {
      logger.payment.error('Wallet not delegated - user must delegate wallet from client first', {
        error: errorMessage,
        walletId: this.walletId,
      });
    } else {
      logger.payment.error('Failed to sign EIP-712 typed data', {
        error: errorMessage,
        walletId: this.walletId,
      });
    }
  }
}
